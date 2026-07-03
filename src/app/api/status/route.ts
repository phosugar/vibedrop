import { NextRequest, NextResponse } from 'next/server'
import { store } from '@/lib/store'
import type { StatusResponse, TransferStatus } from '@/lib/types'

/**
 * GET /api/status?code=XXXX
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
    return NextResponse.json({ error: '提取码无效或已过期', status: 'expired' }, { status: 404 })
  }

  let status: TransferStatus = 'waiting'
  if (session.done && !session.consumerAttached) {
    status = 'ready'
  } else if (session.done && session.consumerAttached) {
    status = 'downloading'
  } else if (session.uploadedBytes > 0) {
    status = 'uploading'
  }

  const res: StatusResponse = {
    code: session.code,
    status,
    meta: session.done ? session.meta : null,
    uploadedBytes: session.uploadedBytes,
    totalBytes: session.totalBytes,
    createdAt: session.createdAt,
  }

  return NextResponse.json(res)
}
