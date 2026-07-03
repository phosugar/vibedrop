/// <reference types="node" />

export interface FileMeta {
  fileName: string
  fileSize: number
  mimeType: string
}

export interface TransferSession {
  code: string
  meta: FileMeta
  chunks: Buffer[]
  uploadedBytes: number
  totalBytes: number
  createdAt: number
  expiresAt: number
  done: boolean
  /** 是否有接收端正在挂载下载流 */
  consumerAttached: boolean
}

export interface UploadChunk {
  index: number
  data: string // base64
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
