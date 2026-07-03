'use client'

import { useRef, useState } from 'react'
import { Copy, Check, ScanQrCode } from 'lucide-react'

interface CodeDisplayProps {
  code: string
}

export default function CodeDisplay({ code }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  const pageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/download/${code}`
    : ''

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = pageUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 提取码卡片 */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-md">
        <p className="text-sm font-medium text-white/40">提取码</p>
        <p className="mt-2 select-all text-5xl font-bold tracking-[0.3em] text-white">
          {code}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            {copied ? '已复制' : '复制代码'}
          </button>
          <button
            onClick={() => setShowQR(!showQR)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            <ScanQrCode className="size-4" />
            {showQR ? '隐藏二维码' : '显示二维码'}
          </button>
        </div>
      </div>

      {/* 二维码区域 */}
      {showQR && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pageUrl)}`}
              alt={`提取码 ${code} 二维码`}
              className="rounded-lg"
              width={180}
              height={180}
            />
            <p className="text-xs text-white/40">扫码打开下载页</p>
          </div>
        </div>
      )}

      {/* 链接 */}
      <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <input
            ref={urlRef}
            readOnly
            value={pageUrl}
            className="min-w-0 flex-1 bg-transparent text-xs text-white/40 outline-none"
            onClick={(e) => e.currentTarget.select()}
          />
          <button
            onClick={handleCopyLink}
            className="shrink-0 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
          >
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      </div>
    </div>
  )
}
