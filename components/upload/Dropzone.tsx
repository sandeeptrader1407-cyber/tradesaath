'use client'

import { useRef, useState, useCallback } from 'react'
import { useUploadStore } from '@/lib/uploadStore'
import { showToast } from '@/components/ui/Toast'

const ACCEPT = '.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg'
const MAX_FILES = 40
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = new Set(['pdf', 'csv', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'])
const TYPE_TAGS = ['PDF', 'CSV', 'XLSX', 'XLS', 'PNG', 'JPG', 'JPEG']

export default function Dropzone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const addFiles = useUploadStore((s) => s.addFiles)
  const filesCount = useUploadStore((s) => s.files.length)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return

      const arr = Array.from(fileList)
      const valid: File[] = []
      const rejected: string[] = []
      const tooLarge: string[] = []

      for (const file of arr) {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''

        if (!ALLOWED_EXTENSIONS.has(ext)) {
          rejected.push(file.name)
          continue
        }

        if (file.size > MAX_FILE_SIZE) {
          tooLarge.push(file.name)
          continue
        }

        if (file.size === 0) {
          rejected.push(file.name)
          continue
        }

        valid.push(file)
      }

      // Show errors for rejected files
      if (rejected.length > 0) {
        const names = rejected.length <= 2 ? rejected.join(', ') : `${rejected.length} files`
        showToast.error(`Unsupported format: ${names}. Please upload PDF, CSV, Excel, or image files.`)
      }

      if (tooLarge.length > 0) {
        const names = tooLarge.length <= 2 ? tooLarge.join(', ') : `${tooLarge.length} files`
        showToast.error(`File too large: ${names}. Maximum size is 10MB per file.`)
      }

      // Check total file limit
      const remaining = MAX_FILES - filesCount
      if (valid.length > remaining) {
        showToast.warning(`Only ${remaining} more file(s) can be added. Maximum is ${MAX_FILES} files.`)
        valid.splice(remaining)
      }

      if (valid.length > 0) {
        addFiles(valid)
        if (rejected.length === 0 && tooLarge.length === 0) {
          showToast.success(`${valid.length} file${valid.length > 1 ? 's' : ''} added successfully.`)
        }
      }
    },
    [addFiles, filesCount],
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
        className="flex flex-col items-center justify-center gap-3 px-4 py-8 md:px-6 md:py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200"
        style={{
          background: isDragging ? '#F0F5FB' : 'var(--color-surface)',
          borderColor: isDragging ? 'var(--color-accent)' : 'var(--color-border-strong)',
          opacity: atLimit ? 0.5 : 1,
          cursor: atLimit ? 'not-allowed' : 'pointer',
          border: '1.5px dashed',
          borderRadius: 10,
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)', fontSize: 14, color: 'var(--color-muted)', marginBottom: 8 }}>
          Drop your broker statement here
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '12px auto', maxWidth: 240 }} />
        <p style={{ fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)', fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>
          CSV, XLSX, or PDF — up to 10 MB
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          {TYPE_TAGS.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--s2)',
                color: 'var(--color-muted)',
                border: '0.5px solid var(--color-border)',
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
        onChange={(e) => {
          handleFiles(e.target.files)
          // Reset input so re-uploading same file triggers onChange
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
    </div>
  )
}
