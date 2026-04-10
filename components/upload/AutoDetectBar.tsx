'use client'

import { useUploadStore } from '@/lib/uploadStore'

export default function AutoDetectBar() {
  const detectedMarket = useUploadStore((s) => s.detectedMarket)
  const filesCount = useUploadStore((s) => s.files.length)

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
      style={{
        background: 'var(--s2)',
        borderColor: 'var(--border)',
      }}
    >
      <span className="text-sm" style={{ color: 'var(--text2)' }}>
        🔍 Market, exchange &amp; currency will be auto-detected from your file
      </span>
      <span
        className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          background: detectedMarket ? 'var(--accent2)' : 'var(--s3)',
          color: detectedMarket ? 'var(--accent)' : 'var(--muted)',
          border: `1px solid ${detectedMarket ? 'var(--accent3)' : 'var(--border)'}`,
        }}
      >
        {filesCount === 0 ? 'Awaiting file…' : detectedMarket ?? 'Detecting…'}
      </span>
    </div>
  )
}
