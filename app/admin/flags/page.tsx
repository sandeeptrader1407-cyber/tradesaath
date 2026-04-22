'use client'

import { useEffect, useState } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'

interface FlagRow {
  key: string
  value: boolean
  updated_by: string | null
  updated_at: string
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  DISABLE_AI_ANALYSIS: 'Disables all Claude API calls in /api/analyse, /api/chat, and /api/coach. All AI routes return 503.',
  DISABLE_BATCH_ANALYSIS: 'Prevents the batch analysis runner from starting new batch jobs.',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/admin/flags')
      .then(r => r.json())
      .then(d => { setFlags(d.flags ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function toggle(key: string, currentValue: boolean) {
    setToggling(key)
    setError(null)
    const res = await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: !currentValue }),
    })
    const d = await res.json()
    if (!res.ok) setError(d.error || 'Failed to update flag')
    load()
    setToggling(null)
  }

  return (
    <div>
      <AdminPageHeader
        title="Feature Flags"
        subtitle="Runtime toggles stored in the database. Changes take effect immediately."
      />

      {error && (
        <div style={{ fontSize: 13, color: 'var(--admin-red)', fontFamily: 'var(--font-sans)', marginBottom: 16, padding: '10px 14px', background: 'rgba(192,57,43,.06)', border: '1px solid rgba(192,57,43,.2)', borderRadius: 6 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ fontSize: 13, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Loading...</div>
        )}
        {!loading && flags.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>No records.</div>
        )}
        {flags.map(flag => (
          <div
            key={flag.key}
            style={{
              background: 'var(--admin-card-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 20,
              boxShadow: 'var(--admin-shadow)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--admin-ink)' }}>
                  {flag.key}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: flag.value ? 'rgba(192,57,43,.08)' : 'var(--admin-accent-dim)',
                    color: flag.value ? 'var(--admin-red)' : 'var(--admin-accent)',
                    border: `1px solid ${flag.value ? 'rgba(192,57,43,.2)' : 'rgba(29,158,117,.2)'}`,
                  }}
                >
                  {flag.value ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', lineHeight: 1.5, marginBottom: 6 }}>
                {FLAG_DESCRIPTIONS[flag.key] ?? 'No description available.'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}>
                Last updated: {fmtDate(flag.updated_at)}
                {flag.updated_by && ` by ${flag.updated_by}`}
              </div>
            </div>

            <button
              disabled={toggling === flag.key}
              onClick={() => toggle(flag.key, flag.value)}
              style={{
                flexShrink: 0,
                height: 28,
                padding: '0 16px',
                fontSize: 12,
                fontFamily: 'var(--font-sans)',
                border: '1px solid var(--admin-border)',
                borderRadius: 4,
                background: flag.value ? 'var(--admin-red)' : 'var(--admin-card-bg)',
                color: flag.value ? '#fff' : 'var(--admin-ink)',
                cursor: toggling ? 'not-allowed' : 'pointer',
                minWidth: 72,
              }}
            >
              {toggling === flag.key ? 'Saving...' : flag.value ? 'Turn OFF' : 'Turn ON'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
