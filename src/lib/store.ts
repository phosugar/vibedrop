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
  create(fileName: string, fileSize: number, mimeType: string): string {
    let code: string
    // 避免碰撞
    do {
      code = generateCode()
    } while (this.sessions.has(code))

    const now = Date.now()
    const session: TransferSession = {
      code,
      meta: { fileName, fileSize, mimeType },
      chunks: [],
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

  /** 追加数据块 */
  appendChunk(code: string, chunk: Buffer): boolean {
    const session = this.sessions.get(code)
    if (!session || session.done) return false
    session.chunks.push(chunk)
    session.uploadedBytes += chunk.length
    if (session.uploadedBytes >= session.totalBytes) {
      session.done = true
    }
    return true
  }

  /** 获取 session（只读） */
  get(code: string): TransferSession | undefined {
    return this.sessions.get(code)
  }

  /** 标记消费者已挂载 */
  markConsumerAttached(code: string): boolean {
    const session = this.sessions.get(code)
    if (!session) return false
    session.consumerAttached = true
    return true
  }

  /** 读完所有数据块并销毁 */
  consume(code: string): { meta: TransferSession['meta']; chunks: Buffer[] } | null {
    const session = this.sessions.get(code)
    if (!session) return null
    const result = { meta: session.meta, chunks: session.chunks }
    this.sessions.delete(code)
    return result
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

  /** 获取当前活跃 session 数量 */
  get activeCount(): number {
    return this.sessions.size
  }
}

/** 全局单例 */
export const store = new MemoryStore()
