import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'

/**
 * GET /api/download?code=XXXX                → 完整文件下载（兼容旧版）
 * GET /api/download?code=XXXX&chunkIndex=N   → 单个 chunk 下载（并发模式）
 *
 * 5 分钟内支持多次下载，文件由定时器统一过期销毁。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const chunkIndexStr = searchParams.get('chunkIndex')

  if (!code) {
    return NextResponse.json({ error: '缺少提取码' }, { status: 400 })
  }

  const session = store.get(code)
  if (!session) {
    return NextResponse.json({ error: '提取码无效或已过期' }, { status: 404 })
  }

  if (!session.done) {
    return NextResponse.json(
      { error: '文件尚未上传完成', uploadedBytes: session.uploadedBytes, totalBytes: session.totalBytes },
      { status: 425 }
    )
  }

  store.markConsumerAttached(code)

  // === 单 chunk 下载（并发模式）===
  if (chunkIndexStr !== null) {
    const chunkIndex = parseInt(chunkIndexStr, 10)
    if (isNaN(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.chunkCount) {
      return NextResponse.json(
        { error: `非法 chunkIndex: ${chunkIndexStr}，范围 0-${session.chunkCount - 1}` },
        { status: 400 }
      )
    }

    const chunk = session.chunks[chunkIndex]
    if (!chunk) {
      return NextResponse.json({ error: '该分片尚未到达' }, { status: 404 })
    }

    return new Response(new Uint8Array(chunk), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(chunk.length),
        'X-Chunk-Index': String(chunkIndex),
        'X-File-Name': encodeURIComponent(session.meta.fileName),
      },
    })
  }

  // === 完整文件下载（传统模式）===
  const result = store.getChunks(code)
  if (!result) {
    return NextResponse.json({ error: '文件读取失败' }, { status: 500 })
  }

  const { meta, chunks } = result
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)

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