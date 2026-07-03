import type { TransferSession } from './types'
import { generateCode } from './codegen'

/** 默认超时: 5 分钟 */
const DEFAULT_TTL_MS = 5 * 60 * 1000

/** 每分钟清理间隔 */
const CLEANUP_INTERVAL_MS = 60 * 1000

class MemoryStore {
  private sessions = new Map<string, TransferSession>()

  constructor() {
    // 定时清理过期 session
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS)
  }

  /** 创建一个新传输会话，返回 4 位提取码 */
  create(fileName: string, fileSize: number, mimeType: string, chunkCount: number): string {
    let code: string
    do {
      code = generateCode()
    } while (this.sessions.has(code))

    const now = Date.now()
    const session: TransferSession = {
      code,
      meta: { fileName, fileSize, mimeType },
      chunks: new Array(chunkCount), // 预分配按 index 存储
      chunkCount,
      uploadedBytes: 0,
      totalBytes: fileSize,
      createdAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
      done: false,
      consumerAttached: false,
    }
    this.sessions.set(code, session)
    return code
  }

  /** 按 index 追加数据块（支持并发乱序到达） */
  appendChunk(code: string, index: number, chunk: Buffer): boolean {
    const session = this.sessions.get(code)
    if (!session || session.done) return false
    if (index < 0 || index >= session.chunkCount) return false
    if (session.chunks[index]) return false // 重复块，忽略
    session.chunks[index] = chunk
    session.uploadedBytes += chunk.length

    // 检查是否所有 chunk 都已到达
    const allArrived = session.chunks.every(c => c !== undefined)
    if (allArrived && session.uploadedBytes >= session.totalBytes) {
      session.done = true
    }
    return true
  }

  /** 获取 session（只读） */
  get(code: string): TransferSession | undefined {
    return this.sessions.get(code)
  }

  /** 显式标记上传完成 */
  finalize(code: string): boolean {
    const session = this.sessions.get(code)
    if (!session) return false
    session.done = true
    session.uploadedBytes = session.totalBytes
    return true
  }

  /** 标记消费者已挂载 */
  markConsumerAttached(code: string): boolean {
    const session = this.sessions.get(code)
    if (!session) return false
    session.consumerAttached = true
    return true
  }

  /** 获取 session 的所有 chunks（只读，不删除）。
   *  5 分钟内支持多次下载，销毁只由 cleanup() 定时器负责。 */
  getChunks(code: string): { meta: TransferSession['meta']; chunks: Buffer[] } | null {
    const session = this.sessions.get(code)
    if (!session || !session.done) return null
    // 过滤掉稀疏数组中未收到的 chunk（理论上 done 时应该全到齐了）
    const chunks = session.chunks.filter((c): c is Buffer => c !== undefined)
    return { meta: session.meta, chunks }
  }

  /** 获取指定 index 范围的 chunks（用于 Range 请求） */
  getChunksRange(
    code: string,
    startIndex: number,
    endIndex: number,
  ): { meta: TransferSession['meta']; chunks: Buffer[]; range: { start: number; end: number; total: number } } | null {
    const session = this.sessions.get(code)
    if (!session || !session.done) return null
    const actualStart = Math.max(0, startIndex)
    const actualEnd = Math.min(endIndex, session.chunkCount - 1)
    const selected = session.chunks
      .slice(actualStart, actualEnd + 1)
      .filter((c): c is Buffer => c !== undefined)
    const totalBytes = session.totalBytes
    const startByte = actualStart > 0
      ? session.chunks.slice(0, actualStart).reduce((s, c) => s + (c?.length ?? 0), 0)
      : 0
    const endByte = startByte + selected.reduce((s, c) => s + c.length, 0) - 1
    return {
      meta: session.meta,
      chunks: selected,
      range: { start: startByte, end: endByte, total: totalBytes },
    }
  }

  /** 获取 chunk 大小（用于将 byte range 映射到 chunk index） */
  getChunkSize(code: string): number {
    const session = this.sessions.get(code)
    if (!session || session.chunkCount === 0) return 0
    return Math.ceil(session.totalBytes / session.chunkCount)
  }

  /** 获取 chunk 数量 */
  getChunkCount(code: string): number {
    const session = this.sessions.get(code)
    return session?.chunkCount ?? 0
  }

  /** 销毁 session */
  destroy(code: string): void {
    this.sessions.delete(code)
  }

  /** 清理过期 session */
  private cleanup(): void {
    const now = Date.now()
    for (const [code, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(code)
      }
    }
  }

  get activeCount(): number {
    return this.sessions.size
  }
}

/** 全局单例 */
export const store = new MemoryStore()