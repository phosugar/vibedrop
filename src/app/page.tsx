'use client'

import { useState, useCallback } from 'react'
import { Globe, ArrowLeftRight } from 'lucide-react'
import FileDropzone from '@/components/FileDropzone'
import TransferProgress from '@/components/TransferProgress'
import CodeDisplay from '@/components/CodeDisplay'

type PageStep = 'idle' | 'uploading' | 'done' | 'error'

export default function HomePage() {
  const [step, setStep] = useState<PageStep>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [code, setCode] = useState<string>('')
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const handleFileSelected = useCallback((file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小超过 50MB 限制 —— 免费服务器内存有限，请压缩或分批传输喵～')
      return
    }
    setSelectedFile(file)
    setStep('uploading')
    setError('')
    setLoaded(0)
    setTotal(file.size)
    startUpload(file)
  }, [])

  async function startUpload(file: File) {
    try {
      // Step 1: 初始化会话
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        }),
      })
      if (!initRes.ok) {
        const err = await initRes.json()
        throw new Error(err.error || '初始化失败')
      }
      const { code: sessionCode } = await initRes.json()
      setCode(sessionCode)

      // Step 2: 分块流式上传 — 每次 256KB，减少握手次数最大化带宽
      const CHUNK_SIZE = 256 * 1024 // 256KB
      let offset = 0

      while (offset < file.size) {
        const end = Math.min(offset + CHUNK_SIZE, file.size)
        const chunk = file.slice(offset, end)

        const uploadRes = await fetch(`/api/upload?code=${sessionCode}`, {
          method: 'POST',
          body: chunk,
          headers: { 'Content-Type': 'application/octet-stream' },
        })
        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          throw new Error(err.error || '上传失败')
        }

        offset = end
        setLoaded(offset)
      }

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

  return (
    <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-[#0b0b10] via-[#0e0e15] to-[#0b0b10]">
      {/* 顶部导航 */}
      <header className="flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-500/15">
            <ArrowLeftRight className="size-4 text-indigo-400" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white/90">VibeDrop</span>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-24">
        {/* 标题 */}
        {step === 'idle' && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white/90">
              跨网络文件快传
            </h1>
            <p className="mt-2 text-sm text-white/40">
              拖拽文件 · 生成提取码 · 另一端输入即可下载
            </p>
          </div>
        )}

        {step === 'idle' && (
          <div className="w-full space-y-4">
            <FileDropzone onFileSelected={handleFileSelected} />
            <div className="flex items-center justify-center gap-1.5 text-xs text-white/25">
              <Globe className="size-3" />
              <span>无需同一局域网 · 纯内存中转 · 即用即走</span>
            </div>
          </div>
        )}

        {/* 上传中 */}
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

        {/* 上传完成 → 展示提取码 */}
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

        {/* 错误状态 */}
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

      {/* 底部 */}
      <footer className="w-full max-w-2xl px-6 py-4 text-center text-xs text-white/15">
        VibeDrop · 纯内存中转，数据不留存
      </footer>
    </div>
  )
}
