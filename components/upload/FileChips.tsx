'use client'

import { useUploadStore } from '@/lib/uploadStore'

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function truncate(name: string, max = 28) {
  if (name.length <= max) return name
  const ext = name.lastIndexOf('.')
  if (ext > 0) {
    const base = name.slice(0, ext)
    const extension = name.slice(ext)
    const allowed = max - extension.length - 1
    return base.slice(0, allowed) + '…' + extension
  }
  return name.slice(0, max - 1) + '…'
}

export default function FileChips() {
  const files = useUploadStore((s) => s.files)
  const removeFile = useUploadStore((s) => s.removeFile)

  if (files.length === 0) return null

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {files.map((file, i) => (
          <div
            key={`${file.name}-${i}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: 'var(--s2)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
            }}
          >
            <span className="truncate max-w-[180px]" title={file.name}>
              {truncate(file.name)}
            </span>
            <span
              className="text-xs shrink-0"
              style={{
                color: 'var(--muted)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {fmtSize(file.size)}
            </span>
            <button
              onClick={() => removeFile(i)}
              className="ml-1 text-xs rounded-full w-5 h-5 flex items-center justify-center transition-colors hover:bg-[var(--s3)]"
              style={{ color: 'var(--muted)' }}
              title="Remove file"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {files.length >= 40 && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--orange)' }}
        >
          Maximum 40 files reached
        </p>
      )}
    </div>
  )
}
