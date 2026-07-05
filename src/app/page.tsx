'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Send, Download } from 'lucide-react'
import FileDropzone from '@/components/FileDropzone'
import TransferProgress from '@/components/TransferProgress'
import CodeDisplay from '@/components/CodeDisplay'

type PageStep = 'idle' | 'uploading' | 'done' | 'error'

/** 单个 chunk 大小 (2MB，兼顾速度和可靠性) */
const CHUNK_SIZE = 2 * 1024 * 1024
/** 滑动窗口并发数 */
const CONCURRENT_UPLOADS = 8

export default function HomePage() {
  const router = useRouter()
  const [step, setStep] = useState<PageStep>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [code, setCode] = useState<string>('')
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [receiveCode, setReceiveCode] = useState('')
  const [receiveError, setReceiveError] = useState('')

  const handleFileSelected = useCallback((file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      setError('文件大小超过 500MB 限制 —— 免费服务器内存有限，请压缩或分批传输')
      return
    }
    setSelectedFile(file)
    setStep('uploading')
    setError('')
    setLoaded(0)
    setTotal(file.size)
    startUpload(file)
  }, [])

  /** 滑动窗口并发上传：同时最多 N 个请求，传完一个补一个 */
  async function uploadWithConcurrency(
    sessionCode: string,
    tasks: Array<{ chunk: Blob; index: number; size: number }>
  ) {
    let completedBytes = 0
    let nextIndex = 0

    async function worker() {
      while (nextIndex < tasks.length) {
        const i = nextIndex++
        const { chunk, index, size } = tasks[i]
        const startTime = Date.now()
        const res = await fetch(`/api/upload?code=${sessionCode}&index=${index}`, {
          method: 'POST',
          body: chunk,
          headers: { 'Content-Type': 'application/octet-stream' },
        }).catch(() => null)
        if (!res || !res.ok) {
          const err = await res?.json().catch(() => ({}))
          throw new Error(err?.error || '上传失败，请检查网络连接')
        }
        completedBytes += size
        setLoaded(completedBytes)
      }
    }

    // 启动 N 个 worker 形成滑动窗口
    await Promise.all(Array.from({ length: CONCURRENT_UPLOADS }, () => worker()))
  }

  async function startUpload(file: File) {
    try {
      // 预计算 chunk 信息
      const chunkCount = Math.ceil(file.size / CHUNK_SIZE)
      const tasks: Array<{ chunk: Blob; index: number; size: number }> = []
      let offset = 0
      for (let i = 0; i < chunkCount; i++) {
        const end = Math.min(offset + CHUNK_SIZE, file.size)
        tasks.push({ chunk: file.slice(offset, end), index: i, size: end - offset })
        offset = end
      }

      // Step 1: 初始化会话
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          chunkCount,
        }),
      })
      if (!initRes.ok) {
        const err = await initRes.json()
        throw new Error(err.error || '初始化失败')
      }
      const { code: sessionCode } = await initRes.json()
      setCode(sessionCode)

      // Step 2: 并发上传所有 chunk（4 线程）
      await uploadWithConcurrency(sessionCode, tasks)

      // Step 3: 显式标记上传完成
      const finalizeRes = await fetch(`/api/upload?code=${sessionCode}&finalize=1`, {
        method: 'POST',
      })
      if (!finalizeRes.ok) {
        const err = await finalizeRes.json()
        throw new Error(err.error || '标记完成失败')
      }

      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传出错')
      setStep('error')
    }
  }

  const handleReset = () => {
    setStep('idle')
    setSelectedFile(null)
    setCode('')
    setLoaded(0)
    setTotal(0)
    setError('')
  }

  const handleReceive = () => {
    const trimmed = receiveCode.trim()
    if (!/^\d{4}$/.test(trimmed)) {
      setReceiveError('请输入 4 位数字提取码')
      return
    }
    setReceiveError('')
    router.push(`/download/${trimmed}`)
  }

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
        {step === 'idle' && (
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white/90">
              跨网络文件快传
            </h1>
            <p className="mt-2 text-sm text-white/40">
              拖拽文件 · 输入提取码 · 即传即收
            </p>
          </div>
        )}

        {step === 'idle' && (
          <div className="w-full max-w-md space-y-6">
            {/* 发送文件卡片 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10">
                  <Send className="size-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">发送文件</p>
                  <p className="text-xs text-white/40">拖拽或点击选择</p>
                </div>
              </div>
              <FileDropzone onFileSelected={handleFileSelected} />
            </div>

            {/* 接收文件卡片 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10">
                  <Download className="size-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">接收文件</p>
                  <p className="text-xs text-white/40">输入 4 位提取码</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={receiveCode}
                    onChange={(e) => {
                      setReceiveCode(e.target.value.replace(/\D/g, ''))
                      setReceiveError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleReceive()
                    }}
                    placeholder="0000"
                    className="w-32 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-2xl font-mono tracking-[0.35em] text-white/80 outline-none placeholder:text-white/20 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-400/10"
                  />
                  <button
                    onClick={handleReceive}
                    disabled={!/^\d{4}$/.test(receiveCode)}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all duration-200 hover:shadow-violet-500/30 disabled:opacity-40 disabled:hover:shadow-violet-500/20"
                  >
                    接收
                  </button>
                </div>
                {receiveError && (
                  <p className="text-center text-xs text-red-400">{receiveError}</p>
                )}
                <p className="text-center text-xs text-white/25">
                  或扫描二维码快速接收
                </p>
              </div>
            </div>
          </div>
        )}

        {(step === 'uploading' || (step === 'done' && loaded < total)) && (
          <div className="w-full space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm">
              <p className="mb-3 text-sm font-medium text-white/70">{selectedFile?.name}</p>
              <TransferProgress
                direction="upload"
                loaded={loaded}
                total={total}
                done={loaded >= total}
              />
            </div>
          </div>
        )}

        {step === 'done' && code && (
          <div className="w-full space-y-4 text-center">
            <div className="space-y-1">
              <p className="text-sm text-emerald-400/80">✓ 上传完成</p>
              <p className="text-xs text-white/40">{selectedFile?.name}</p>
            </div>
            <CodeDisplay code={code} />
            <button
              onClick={handleReset}
              className="mt-4 text-sm text-white/30 underline underline-offset-2 transition-colors hover:text-white/50"
            >
              传输另一个文件
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="w-full space-y-4 text-center">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-sm">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-white/40 underline underline-offset-2 transition-colors hover:text-white/60"
            >
              重试
            </button>
          </div>
        )}
      </main>

      <footer className="w-full max-w-2xl px-6 py-4 text-center text-xs text-white/15">
        VibeDrop · 纯内存中转，数据不留存 · 最大 500MB
      </footer>
    </div>
  )
}