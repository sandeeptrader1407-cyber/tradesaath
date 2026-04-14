'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { showToast } from '@/components/ui/Toast'

interface PendingSession {
  id: string
  trade_date: string | null
  created_at: string
  trade_count: number | null
  net_pnl: number | null
}

interface PendingResponse {
  pending: PendingSession[]
  analysed: PendingSession[]
  total: number
  analysedCount: number
  pendingCount: number
}

type RunnerState = 'idle' | 'loading' | 'running' | 'done' | 'error'
type SessionStatus = 'queued' | 'running' | 'waiting' | 'done' | 'failed' | 'skipped'

interface Row {
  session: PendingSession
  status: SessionStatus
  error?: string
}

const SESSION_DELAY_MS = 5000
const RATE_LIMIT_WAIT_MS = 10_000
const MAX_RETRIES = 3

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fmtDate(s: string | null): string {
  if (!s) return 'Unknown date'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtINR(n: number | null): string {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : '-'
  return `${sign}\u20B9${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

interface Props {
  /** Called after the whole batch completes (success or partial). */
  onComplete?: (result: { analysed: number; failed: number }) => void
  /** Auto-start the batch on mount. */
  autoStart?: boolean
  /** Compact inline style (for upload flow); default is card style. */
  compact?: boolean
}

export default function BatchAnalysisRunner({ onComplete, autoStart = false, compact = false }: Props) {
  const [state, setState] = useState<RunnerState>('idle')
  const [rows, setRows] = useState<Row[]>([])
  const [analysedCount, setAnalysedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/user/sessions/pending-analysis')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PendingResponse = await res.json()
      setAnalysedCount(data.analysedCount)
      setTotalCount(data.total)
      setRows(data.pending.map((s) => ({ session: s, status: 'queued' as SessionStatus })))
      setState('idle')
      return data
    } catch (err) {
      console.warn('pending-analysis load error:', err)
      setState('error')
      return null
    }
  }, [])

  const runOne = async (
    sessionId: string,
  ): Promise<{ ok: boolean; skipped?: boolean; rateLimited?: boolean; retryAfter?: number; error?: string }> => {
    try {
      const res = await fetch('/api/analyse/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429 || data?.error === 'rate_limited' || data?.code === 'RATE_LIMIT') {
        const retryAfter = Number(data?.retryAfter) || 10
        return { ok: false, rateLimited: true, retryAfter, error: 'Rate limited' }
      }
      if (!res.ok) {
        return { ok: false, error: data?.error || `HTTP ${res.status}` }
      }
      return { ok: true, skipped: !!data?.skipped }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
    }
  }

  const runWithRetry = async (
    sessionId: string,
  ): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await runOne(sessionId)
      if (result.ok) return result
      if (!result.rateLimited) return result
      // Rate-limited: show waiting status, sleep, retry
      const waitMs = (result.retryAfter || 10) * 1000
      setRows((prev) =>
        prev.map((r) =>
          r.session.id === sessionId
            ? { ...r, status: 'waiting', error: `API busy — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})` }
            : r,
        ),
      )
      await sleep(waitMs)
      setRows((prev) =>
        prev.map((r) => (r.session.id === sessionId ? { ...r, status: 'running', error: undefined } : r)),
      )
    }
    return { ok: false, error: 'Still rate limited after 3 retries — try again later' }
  }

  const runBatch = useCallback(async () => {
    cancelledRef.current = false
    setState('running')

    let done = 0
    let failed = 0

    // Work through the queue sequentially to respect Vercel 60s function limits
    const snapshot = await load()
    const queue = snapshot?.pending || []
    if (queue.length === 0) {
      setState('done')
      onComplete?.({ analysed: 0, failed: 0 })
      return
    }

    for (let i = 0; i < queue.length; i++) {
      if (cancelledRef.current) break
      const s = queue[i]
      setRows((prev) => prev.map((r) => (r.session.id === s.id ? { ...r, status: 'running' } : r)))

      const result = await runWithRetry(s.id)

      setRows((prev) =>
        prev.map((r) =>
          r.session.id === s.id
            ? {
                ...r,
                status: result.ok ? (result.skipped ? 'skipped' : 'done') : 'failed',
                error: result.error,
              }
            : r,
        ),
      )

      if (result.ok) done++
      else failed++

      // Rate-limit friendly delay between sessions
      if (i < queue.length - 1 && !cancelledRef.current) {
        await sleep(SESSION_DELAY_MS)
      }
    }

    setState('done')
    if (done > 0) showToast.success(`Analysed ${done} session${done === 1 ? '' : 's'}`)
    if (failed > 0) showToast.warning(`${failed} session${failed === 1 ? '' : 's'} failed — you can retry`)
    onComplete?.({ analysed: done, failed })
  }, [load, onComplete])

  const retry = async (sessionId: string) => {
    setRows((prev) => prev.map((r) => (r.session.id === sessionId ? { ...r, status: 'running', error: undefined } : r)))
    const result = await runOne(sessionId)
    setRows((prev) =>
      prev.map((r) =>
        r.session.id === sessionId
          ? { ...r, status: result.ok ? 'done' : 'failed', error: result.error }
          : r,
      ),
    )
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (autoStart && state === 'idle' && rows.length > 0) {
      runBatch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, rows.length])

  const doneCount = rows.filter((r) => r.status === 'done' || r.status === 'skipped').length
  const failedCount = rows.filter((r) => r.status === 'failed').length

  if (state === 'loading') {
    return (
      <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>
        Loading analysis status...
      </div>
    )
  }

  // Nothing to analyse — hide entirely in compact mode, show success card otherwise
  if (state !== 'running' && rows.length === 0) {
    if (compact) return null
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          border: '1px solid rgba(62,232,196,.25)',
          background: 'rgba(62,232,196,.06)',
          color: 'var(--text2)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ color: 'var(--accent)', fontSize: 16 }}>{'\u2713'}</span>
        <span>All {analysedCount} of {totalCount} sessions are fully analysed.</span>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: compact ? 10 : 14,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--s1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          AI Analysis — {doneCount + analysedCount} of {totalCount} sessions analysed
        </div>
        {state !== 'running' && (
          <button
            type="button"
            onClick={runBatch}
            disabled={rows.length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent)',
              color: '#071a15',
              fontSize: 12,
              fontWeight: 700,
              cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
              opacity: rows.length === 0 ? 0.5 : 1,
            }}
          >
            {state === 'done' && failedCount > 0 ? 'Retry failed' : `Run AI analysis \u2192`}
          </button>
        )}
      </div>

      {state === 'running' && (
        <div
          style={{
            height: 4,
            background: 'var(--s3)',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.round(((doneCount + failedCount) / Math.max(1, rows.length)) * 100)}%`,
              background: 'var(--accent)',
              transition: 'width 0.3s',
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {rows.map((r) => (
          <div
            key={r.session.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'var(--s2)',
              fontSize: 12,
            }}
          >
            <span style={{ width: 16, textAlign: 'center' }}>
              {r.status === 'done' || r.status === 'skipped' ? (
                <span style={{ color: 'var(--accent)' }}>{'\u2713'}</span>
              ) : r.status === 'failed' ? (
                <span style={{ color: '#fca5a5' }}>{'\u2717'}</span>
              ) : r.status === 'running' ? (
                <span style={{ color: 'var(--accent)' }}>{'\u22EF'}</span>
              ) : r.status === 'waiting' ? (
                <span style={{ color: '#fbbf24' }}>{'\u29D6'}</span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>{'\u25CB'}</span>
              )}
            </span>
            <span style={{ color: 'var(--text)', minWidth: 100 }}>{fmtDate(r.session.trade_date || r.session.created_at)}</span>
            <span style={{ color: 'var(--muted)', minWidth: 70 }}>{r.session.trade_count ?? 0} trades</span>
            <span style={{ color: (r.session.net_pnl ?? 0) >= 0 ? 'var(--accent)' : '#fca5a5', minWidth: 80 }}>
              {fmtINR(r.session.net_pnl)}
            </span>
            <span style={{ flex: 1, color: 'var(--muted)', fontSize: 11 }}>
              {r.status === 'running' && 'Analysing...'}
              {r.status === 'waiting' && (r.error || 'Waiting (API busy) \u2014 retrying...')}
              {r.status === 'failed' && (r.error || 'Failed')}
              {r.status === 'done' && 'Analysed'}
              {r.status === 'skipped' && 'Already analysed'}
              {r.status === 'queued' && 'Queued'}
            </span>
            {r.status === 'failed' && (
              <button
                type="button"
                onClick={() => retry(r.session.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
