'use client'

import { useRef, useState, useCallback } from 'react'
import { useUploadStore } from '@/lib/uploadStore'

const ACCEPT = '.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg'
const MAX_FILES = 40
const TYPE_TAGS = ['PDF', 'CSV', 'XLSX', 'XLS', 'PNG', 'JPG', 'JPEG']

export default function Dropzone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const addFiles = useUploadStore((s) => s.addFiles)
  const filesCount = useUploadStore((s) => s.files.length)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const arr = Array.from(fileList)
      addFiles(arr)
    },
    [addFiles],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const atLimit = filesCount >= MAX_FILES

  return (
    <div>
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !atLimit && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200"
        style={{
          background: isDragging ? 'var(--accent2)' : 'var(--s1)',
          borderColor: isDragging ? 'var(--accent)' : 'var(--border2)',
          opacity: atLimit ? 0.5 : 1,
          cursor: atLimit ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="text-4xl">📂</span>

        <div className="text-center">
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>
            Drop files here or click to browse
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            PDF, CSV, Excel, screenshots — up to 40 files · any broker worldwide
          </p>
        </div>

        {/* File type tags */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {TYPE_TAGS.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[11px] font-medium rounded-md"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: 'var(--s3)',
                color: 'var(--muted2)',
                border: '1px solid var(--border)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
