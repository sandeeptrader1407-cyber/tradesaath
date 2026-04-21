'use client'

import { useUploadStore } from '@/lib/uploadStore'

export default function AutoDetectBar() {
  const detectedMarket = useUploadStore((s) => s.detectedMarket)
  const detectedBroker = useUploadStore((s) => s.detectedBroker)
  const filesCount = useUploadStore((s) => s.files.length)

  const hasDetection = detectedMarket || detectedBroker

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
      style={{
        background: 'var(--s2)',
        borderColor: hasDetection ? 'var(--accent3)' : 'var(--border)',
      }}
    >
      <span className="text-sm" style={{ color: 'var(--text2)' }}>
        {hasDetection
          ? 'Auto-detected from your file'
          : 'Market, broker, and currency will be auto-detected'
        }
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {detectedBroker && (
          <span
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{
              fontFamily: 'var(--font-dm-mono, DM Mono, monospace)',
              background: 'rgba(15,76,129,.08)',
              color: 'var(--color-accent)',
              border: '0.5px solid rgba(15,76,129,.2)',
            }}
          >
            {detectedBroker}
          </span>
        )}
        <span
          className="px-3 py-1 rounded-lg text-xs font-medium"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: detectedMarket ? 'var(--accent2)' : 'var(--s3)',
            color: detectedMarket ? 'var(--accent)' : 'var(--muted)',
            border: `1px solid ${detectedMarket ? 'var(--accent3)' : 'var(--border)'}`,
          }}
        >
          {filesCount === 0 ? 'Awaiting file\u2026' : detectedMarket ?? 'Detecting\u2026'}
        </span>
      </div>
    </div>
  )
}
