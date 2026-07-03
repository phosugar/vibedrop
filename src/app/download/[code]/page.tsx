'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeftRight, Download, File, AlertCircle } from 'lucide-react'
import TransferProgress from '@/components/TransferProgress'
import type { StatusResponse } from '@/lib/types'

type PageStep = 'loading' | 'ready' | 'downloading' | 'done' | 'error'

export default function DownloadPage() {
  const params = useParams()
  const code = params.code as string

  const [step, setStep] = useState<PageStep>('loading')
  const [meta, setMeta] = useState<StatusResponse['meta']>(null)
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** 轮询状态，知道上传完成 */
  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`/api/status?code=${code}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('提取码无效或已过期')
            setStep('error')
            return
          }
          throw new Error('状态查询失败')
        }
        const data: StatusResponse = await res.json()
        setMeta(data.meta)
        setTotal(data.totalBytes)
        if (data.status === 'ready' || data.status === 'downloading') {
          if (!cancelled) {
            setStep('ready')
            if (pollingRef.current) clearInterval(pollingRef.current)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '查询失败')
          setStep('error')
        }
      }
    }

    // 立即查一次
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
    try {
      const res = await fetch(`/api/download?code=${code}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '下载失败' }))
        throw new Error(err.error || `服务器错误 ${res.status}`)
      }

      const contentLength = Number(res.headers.get('Content-Length') || '0')
      const disposition = res.headers.get('Content-Disposition') || ''
      const fileNameMatch = disposition.match(/filename="(.+?)"/)
      const fileName = fileNameMatch
        ? decodeURIComponent(fileNameMatch[1])
        : meta?.fileName || 'download'

      const reader = res.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const chunks: BlobPart[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          setLoaded(received)
        }
      }

      // 构造 Blob 并触发下载
      const blob = new Blob(chunks as BlobPart[], { type: meta?.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setLoaded(received)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '下载出错')
      setStep('error')
    }
  }, [code, meta])

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-[#0b0b10] via-[#0e0e15] to-[#0b0b10]">
      {/* 顶部 */}
      <header className="flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/15">
            <ArrowLeftRight className="size-4 text-indigo-400" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white/90">VibeDrop</span>
        </div>
      </header>

      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-24">
        {/* 标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white/90">接收文件</h1>
          <p className="mt-1 text-sm text-white/40">提取码: <span className="font-mono tracking-widest text-indigo-400">{code}</span></p>
        </div>

        {/* 等待中 */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
            <p className="text-sm text-white/40">正在等待发送方上传…</p>
          </div>
        )}

        {/* 准备就绪 */}
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
              className="
                inline-flex w-full items-center justify-center gap-2 rounded-xl
                bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3.5
                text-sm font-medium text-white shadow-lg shadow-indigo-500/20
                transition-all duration-200 hover:shadow-indigo-500/30 active:scale-[0.98]
              "
            >
              <Download className="size-4" />
              开始下载
            </button>
          </div>
        )}

        {/* 下载中 */}
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

        {/* 完成 */}
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

        {/* 错误 */}
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
