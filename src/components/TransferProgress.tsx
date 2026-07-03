'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react'

interface TransferProgressProps {
  /** 已上传/下载的字节数 */
  loaded: number
  /** 总字节数 */
  total: number
  /** 传输方向: upload | download */
  direction: 'upload' | 'download'
  /** 是否完成 */
  done: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分${s}秒`
}

export default function TransferProgress({ loaded, total, direction, done }: TransferProgressProps) {
  const [startTime] = useState(Date.now())
  const [speed, setSpeed] = useState(0)
  const [eta, setEta] = useState(0)
  const prevLoaded = useRef(0)
  const prevTime = useRef(Date.now())

  const percent = total > 0 ? Math.min((loaded / total) * 100, 100) : 0

  useEffect(() => {
    if (done || total <= 0) return
    const now = Date.now()
    const elapsed = now - prevTime.current
    if (elapsed > 300) {
      const deltaBytes = loaded - prevLoaded.current
      const currentSpeed = deltaBytes / (elapsed / 1000)
      setSpeed(currentSpeed)
      prevLoaded.current = loaded
      prevTime.current = now
      if (currentSpeed > 0) {
        setEta((total - loaded) / currentSpeed)
      }
    }
  }, [loaded, total, done])

  // 方向图标
  const Icon = direction === 'upload' ? ArrowUp : ArrowDown
  const label = direction === 'upload' ? '上传中' : '下载中'

  if (done) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 px-5 py-4 backdrop-blur-sm">
        <CheckCircle2 className="size-6 text-emerald-400" />
        <div>
          <p className="text-sm font-medium text-emerald-300">传输完成</p>
          <p className="text-xs text-white/40">{formatBytes(total)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 状态行 */}
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Icon className="size-4" />
        <span>{label}</span>
        <span className="ml-auto font-mono text-xs text-white/40">
          {formatBytes(loaded)} / {formatBytes(total)}
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 速度 & 剩余时间 */}
      <div className="flex items-center justify-between text-xs text-white/35">
        <span>{formatSpeed(speed)}</span>
        {loaded < total && (
          <span>剩余 {formatTime(eta)}</span>
        )}
      </div>
    </div>
  )
}
