/// <reference types="node" />

export interface FileMeta {
  fileName: string
  fileSize: number
  mimeType: string
}

export interface TransferSession {
  code: string
  meta: FileMeta
  /** 按 index 存储的数据块（预分配数组，支持并发乱序写入） */
  chunks: (Buffer | undefined)[]
  /** chunk 总数量 */
  chunkCount: number
  uploadedBytes: number
  totalBytes: number
  createdAt: number
  expiresAt: number
  done: boolean
  consumerAttached: boolean
}

export type TransferStatus = 'waiting' | 'uploading' | 'ready' | 'downloading' | 'finished' | 'expired'

export interface StatusResponse {
  code: string
  status: TransferStatus
  meta: FileMeta | null
  uploadedBytes: number
  totalBytes: number
  createdAt: number
}
