import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'

/**
 * GET /api/download?code=XXXX
 *
  */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: '缺少提取码' }, { status: 400 })
  }

  const session = store.get(code)
  if (!session) {
    return NextResponse.json({ error: '提取码无效或已过期' }, { status: 404 })
  }

  if (!session.done) {
    // 上传尚未完成 — 等待模式（轮询）
    // 为简化不做长轮询，直接返回状态让前端轮询
    return NextResponse.json({ error: '文件尚未上传完成', uploadedBytes: session.uploadedBytes, totalBytes: session.totalBytes }, { status: 425 })
  }

  // 标记消费者已挂载（用于状态展示）
  store.markConsumerAttached(code)

  const result = store.consume(code)
  if (!result) {
    return NextResponse.json({ error: '文件已被取走' }, { status: 410 })
  }

  const { meta, chunks } = result
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)

  // 构建可读流 — 逐块吐出
  let index = 0
  const readable = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index])
        index++
      } else {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': meta.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.fileName)}"`,
      'Content-Length': String(totalLength),
      'X-File-Name': encodeURIComponent(meta.fileName),
    },
  })
}
