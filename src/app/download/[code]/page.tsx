'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeftRight, Download, File, AlertCircle } from 'lucide-react'
import TransferProgress from '@/components/TransferProgress'
import type { StatusResponse } from '@/lib/types'

type PageStep = 'loading' | 'ready' | 'downloading' | 'done' | 'error'

/** 滑动窗口下载并发数 */
const CONCURRENT_DOWNLOADS = 16

export default function DownloadPage() {
  const params = useParams()
  const code = params.code as string

  const [step, setStep] = useState<PageStep>('loading')
  const [meta, setMeta] = useState<StatusResponse['meta']>(null)
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const receivedRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`/api/status?code=${code}`)
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) { setError('提取码无效或已过期'); setStep('error') }
            return
          }
          throw new Error('状态查询失败')
        }
        const data: StatusResponse = await res.json()
        if (!cancelled) {
          setMeta(data.meta)
          setTotal(data.totalBytes)
          if (data.status === 'ready' || data.status === 'downloading') {
            setStep('ready')
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '查询失败')
          setStep('error')
        }
      }
    }
    poll()
    pollingRef.current = setInterval(poll, 2000)
    return () => {
      cancelled = true
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [code])

  const handleDownload = useCallback(async () => {
    setStep('downloading')
    setLoaded(0)
    receivedRef.current = 0
    try {
      // Step 1: 获取文件元信息（chunkCount + chunkSize）
      const infoRes = await fetch(`/api/status?code=${code}`)
      if (!infoRes.ok) throw new Error('获取文件信息失败')
      const info: StatusResponse = await infoRes.json()
      if (!info.totalBytes || !info.meta) throw new Error('文件未就绪')
      setMeta(info.meta)
      setTotal(info.totalBytes)

      // Step 2: 计算 chunk 数量和每 chunk 大小
      // 用 4MB 作为下载 chunk 单元，跟上传一致
      const DL_CHUNK_BYTES = 4 * 1024 * 1024
      const chunkCount = Math.ceil(info.totalBytes / DL_CHUNK_BYTES)

      // Step 3: 滑动窗口并发下载（同时最多 16 个请求）
      const results = new Array(chunkCount).fill(null as Uint8Array | null)
      receivedRef.current = 0
      let nextChunkIdx = 0

      const worker = async () => {
        while (nextChunkIdx < chunkCount) {
          const i = nextChunkIdx++

          const res = await fetch(
            `/api/download?code=${code}&chunkIndex=${i}`,
            { method: 'GET' }
          )
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '下载失败' }))
            throw new Error(err.error || `HTTP ${res.status}`)
          }

          const arrayBuf = await res.arrayBuffer()
          const chunk = new Uint8Array(arrayBuf)
          results[i] = chunk
          receivedRef.current += chunk.length
          // 直接 setLoaded，不经过 rAF 节流——TransferProgress 自己会做 EMA 平滑
          setLoaded(receivedRef.current)
        }
      }

      // 启动 4 个 worker 形成滑动窗口
      await Promise.all(
        Array.from({ length: CONCURRENT_DOWNLOADS }, () => worker())
      )

      // 验证所有 chunk 都到了
      if (results.some(c => c === null)) {
        throw new Error('部分分片下载失败')
      }

      // Step 4: 拼接所有分片
      const fullBuffer = new Uint8Array(info.totalBytes)
      let offset = 0
      for (let i = 0; i < chunkCount; i++) {
        const c = results[i]!
        fullBuffer.set(c, offset)
        offset += c.length
      }

      // Step 5: 触发浏览器下载
      const blob = new Blob([fullBuffer], { type: info.meta.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = info.meta.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setLoaded(info.totalBytes)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '下载出错')
      setStep('error')
    }
  }, [code])

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-[#0b0b10] via-[#0e0e15] to-[#0b0b10]">
      <header className="flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/15">
            <ArrowLeftRight className="size-4 text-indigo-400" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white/90">VibeDrop</span>
        </div>
      </header>

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-24">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white/90">接收文件</h1>
          <p className="mt-1 text-sm text-white/40">
            提取码: <span className="font-mono tracking-widest text-indigo-400">{code}</span>
          </p>
        </div>

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
            <p className="text-sm text-white/40">正在等待发送方上传…</p>
          </div>
        )}

        {step === 'ready' && meta && (
          <div className="w-full space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10">
                  <File className="size-6 text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/80">{meta.fileName}</p>
                  <p className="text-xs text-white/40">{formatSize(meta.fileSize)}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl
                bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3.5
                text-sm font-medium text-white shadow-lg shadow-indigo-500/20
                transition-all duration-200 hover:shadow-indigo-500/30 active:scale-[0.98]"
            >
              <Download className="size-4" />
              开始下载 · 16线程并发
            </button>
          </div>
        )}

        {step === 'downloading' && (
          <div className="w-full">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm">
              <p className="mb-3 text-sm font-medium text-white/70">
                {meta?.fileName || '文件'}
              </p>
              <TransferProgress
                direction="download"
                loaded={loaded}
                total={total}
                done={loaded >= total}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="w-full space-y-4 text-center">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-8 backdrop-blur-sm">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                <Download className="size-6 text-emerald-400" />
              </div>
              <p className="text-lg font-medium text-white/90">下载完成</p>
              <p className="mt-1 text-xs text-white/40">
                {meta?.fileName || '文件'}
              </p>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="w-full space-y-4 text-center">
            <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-8 backdrop-blur-sm">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle className="size-6 text-red-400" />
              </div>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full max-w-2xl px-6 py-4 text-center text-xs text-white/15">
        VibeDrop · 纯内存中转，数据不留存
      </footer>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}