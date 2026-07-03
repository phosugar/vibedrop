'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { Upload, File } from 'lucide-react'

interface FileDropzoneProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export default function FileDropzone({ onFileSelected, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      if (file.size <= 0) return
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [disabled, handleFile]
  )

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      if (!disabled) setDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback(() => setDragging(false), [])

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset 以便再次选择同一文件
    e.target.value = ''
  }

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center
        transition-all duration-300 ease-out
        ${dragging
          ? 'border-indigo-400/80 bg-indigo-500/10 shadow-[0_0_30px_-8px_rgba(99,102,241,0.3)]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
        }
        ${disabled ? 'pointer-events-none opacity-40' : ''}
        backdrop-blur-sm
      `}
      role="button"
      tabIndex={0}
      aria-label="选择文件"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        aria-hidden
      />
      <div className="flex flex-col items-center gap-4">
        <div
          className={`
            flex size-14 items-center justify-center rounded-full
            transition-all duration-300
            ${dragging ? 'scale-110 bg-indigo-500/20' : 'bg-white/5'}
          `}
        >
          {dragging ? (
            <File className="size-7 text-indigo-400" />
          ) : (
            <Upload className="size-7 text-white/60" />
          )}
        </div>
        <div>
          <p className="text-lg font-medium text-white/90">
            {dragging ? '松开以选择' : '拖拽文件到此处'}
          </p>
          <p className="mt-1 text-sm text-white/40">或点击选择文件</p>
        </div>
        <p className="text-xs text-white/25">单文件 · 最大 500MB</p>
      </div>
    </div>
  )
}
