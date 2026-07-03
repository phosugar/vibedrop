import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import type { FileMeta } from '@/lib/types'

/**
 * POST /api/upload
 *
 * 三步握手协议:
 *   1. 客户端先 POST { fileName, fileSize, mimeType } → 服务端返回 4 位提取码
 *   2. 客户端以 Transfer-Encoding: chunked 流式 POST /api/upload?code=XXXX
 *   3. 服务端逐块读取并写入内存 store
 *
 * 实际上我们用两步:
 *   Step A: POST JSON body → 返回 code (第1次请求)
 *   Step B: POST 带查询参数 code + body 为文件流 (第2次请求)
 */

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // --- Step A: 初始化会话 ---
  if (!code) {
    try {
      const body: FileMeta = await request.json()
      if (!body.fileName || !body.fileSize || !body.mimeType) {
        return NextResponse.json({ error: '缺少必要字段: fileName, fileSize, mimeType' }, { status: 400 })
      }
      if (body.fileSize <= 0) {
        return NextResponse.json({ error: '文件大小必须大于 0' }, { status: 400 })
      }
      const sessionCode = store.create(body.fileName, body.fileSize, body.mimeType)
      return NextResponse.json({ code: sessionCode })
    } catch {
      return NextResponse.json({ error: '请求体必须是有效的 JSON' }, { status: 400 })
    }
  }

  // --- Step B: 上传文件流 ---
  const session = store.get(code)
  if (!session) {
    return NextResponse.json({ error: '提取码无效或已过期' }, { status: 404 })
  }
  if (session.done) {
    return NextResponse.json({ error: '文件已上传完成' }, { status: 400 })
  }

  try {
    const reader = request.body?.getReader()
    if (!reader) {
      return NextResponse.json({ error: '请求体为空' }, { status: 400 })
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.byteLength > 0) {
        store.appendChunk(code, Buffer.from(value))
      }
    }

    return NextResponse.json({
      code,
      uploadedBytes: session.uploadedBytes,
      totalBytes: session.totalBytes,
      done: session.done,
    })
  } catch (err) {
    // 上传中断 — 清理 session
    store.destroy(code)
    const message = err instanceof Error ? err.message : '上传中断'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// config 已弃用，bodyParser 默认关闭；Next.js 16 App Router 自带流式支持
