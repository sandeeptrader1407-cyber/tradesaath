'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Trade {
  time?: string
  symbol?: string
  side?: string
  pnl?: number
  tag?: string
  sessionDate?: string
}

interface Session {
  date?: string
  trades?: number
  pnl?: number
  winRate?: number
}

interface Props {
  recentTrades?: Trade[]
  recentSessions?: Session[]
}

function fmtPnl(v: number) {
  const s = Math.abs(Math.round(v)).toLocaleString('en-IN')
  return v >= 0 ? `+₹${s}` : `−₹${s}`
}

function fmtDate(d?: string): string {
  if (!d) return '—'
  try {
    const date = new Date(d + 'T12:00:00')
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return d }
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  win:        { bg: 'rgba(29,158,117,0.08)',  color: 'var(--green)' },
  disciplined:{ bg: 'rgba(29,158,117,0.08)',  color: 'var(--green)' },
  revenge:    { bg: 'rgba(192,57,43,0.08)',   color: 'var(--red)' },
  fomo:       { bg: 'rgba(192,57,43,0.08)',   color: 'var(--red)' },
}

function tagStyle(tag?: string): { bg: string; color: string } {
  if (!tag) return { bg: 'var(--s2)', color: 'var(--color-muted)' }
  const t = tag.toLowerCase()
  for (const [k, v] of Object.entries(TAG_COLORS)) {
    if (t.includes(k)) return v
  }
  return { bg: 'var(--s2)', color: 'var(--color-muted)' }
}

export default function RecentActivity({ recentTrades = [], recentSessions = [] }: Props) {
  const router = useRouter()
  const [tradeHover, setTradeHover] = useState<number | null>(null)
  const [sessionHover, setSessionHover] = useState<number | null>(null)

  const uniqueTrades = (() => {
    const seen = new Set<string>()
    return recentTrades.filter(t => {
      const key = `${t.time}|${t.symbol}|${t.side}|${t.pnl ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 5)
  })()

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 12 }}>
      {children}
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="section-activity">
      {/* Recent Trades */}
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 10, padding: '16px 16px 12px' }}>
        <SectionTitle>Recent Trades</SectionTitle>
        {uniqueTrades.length === 0 ? (
          <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', padding: '16px 0', textAlign: 'center', margin: 0 }}>
            No trades yet — upload your first file
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {uniqueTrades.map((t, i) => {
                const ts = tagStyle(t.tag)
                const isHovered = tradeHover === i
                const dest = t.sessionDate ? `/journal?date=${t.sessionDate}` : '/journal'
                return (
                  <div
                    key={`${t.time}-${t.symbol}-${i}`}
                    onClick={() => router.push(dest)}
                    onMouseEnter={() => setTradeHover(i)}
                    onMouseLeave={() => setTradeHover(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 6px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isHovered ? 'var(--color-canvas)' : 'transparent',
                      transition: 'background 0.15s',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>
                        {t.time || '--:--'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.symbol || 'Unknown'}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 400,
                        padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                        background: t.side === 'BUY' ? 'rgba(29,158,117,0.1)' : 'rgba(192,57,43,0.1)',
                        color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)',
                      }}>
                        {t.side || '—'}
                      </span>
                      {t.tag && (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 400,
                          padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                          background: ts.bg, color: ts.color,
                        }}>
                          {t.tag}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: (t.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtPnl(t.pnl || 0)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-border)', opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                        →
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link href="/journal" style={{
              display: 'block', marginTop: 10, paddingTop: 10,
              borderTop: '0.5px solid var(--color-border)',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400,
              color: 'var(--color-muted)', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
              View all in Journal →
            </Link>
          </>
        )}
      </div>

      {/* Recent Sessions */}
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 10, padding: '16px 16px 12px' }}>
        <SectionTitle>Recent Sessions</SectionTitle>
        {recentSessions.length === 0 ? (
          <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', padding: '16px 0', textAlign: 'center', margin: 0 }}>
            No sessions yet — analyse your first trade file
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentSessions.slice(0, 4).map((s, i) => {
                const isHovered = sessionHover === i
                const dest = s.date ? `/journal?date=${s.date}` : '/journal'
                const wr = Math.round((s.winRate || 0) * 10) / 10
                return (
                  <div
                    key={`${s.date}-${i}`}
                    onClick={() => router.push(dest)}
                    onMouseEnter={() => setSessionHover(i)}
                    onMouseLeave={() => setSessionHover(null)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isHovered ? 'var(--color-canvas)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: 'var(--color-ink)' }}>
                        {fmtDate(s.date)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: (s.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmtPnl(s.pnl || 0)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-border)', opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                          →
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)' }}>
                        {s.trades || 0} {(s.trades || 0) === 1 ? 'trade' : 'trades'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
                        {wr}%
                      </span>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${Math.min(100, s.winRate || 0)}%`,
                          background: (s.winRate || 0) >= 50 ? 'var(--green)' : 'var(--red)',
                          transition: 'width 0.6s',
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link href="/journal" style={{
              display: 'block', marginTop: 10, paddingTop: 10,
              borderTop: '0.5px solid var(--color-border)',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400,
              color: 'var(--color-muted)', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
              View all sessions →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
