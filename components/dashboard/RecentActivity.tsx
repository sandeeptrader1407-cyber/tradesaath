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
  dqsScore?: number
}

interface Props {
  recentTrades?: Trade[]
  recentSessions?: Session[]
}

function fmtPnl(v: number) {
  if (v === 0) return null
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

function cleanSymbol(s?: string): string {
  if (!s) return 'Unknown'
  return s.replace(/\.0+$/, '')
}

function isTagFlagged(tag?: string): boolean {
  if (!tag) return false
  const t = tag.toLowerCase()
  return t.includes('revenge') || t.includes('fomo') || t.includes('oversize') || t.includes('over') || t.includes('avg') || t.includes('panic') || t.includes('late')
}

function isTagDisciplined(tag?: string): boolean {
  if (!tag) return false
  const t = tag.toLowerCase()
  return t.includes('win') || t.includes('disciplin')
}

function tagBadgeStyle(tag?: string): React.CSSProperties {
  if (isTagFlagged(tag)) return { background: 'rgba(192,57,43,0.08)', color: 'var(--color-loss)', border: '1px solid rgba(192,57,43,0.2)' }
  if (isTagDisciplined(tag)) return { background: 'rgba(29,158,117,0.08)', color: 'var(--color-profit)', border: '1px solid rgba(29,158,117,0.2)' }
  return { background: 'var(--s2)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }
}

function dqsColor(score: number): string {
  if (score >= 70) return 'var(--color-profit)'
  if (score >= 50) return '#C07B2A'
  return 'var(--color-loss)'
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

  const mostRecentSessionDate = uniqueTrades.find(t => t.sessionDate)?.sessionDate
  const firstFlaggedIdx = uniqueTrades.findIndex(t => isTagFlagged(t.tag))
  const allDisciplined = uniqueTrades.length > 0 && uniqueTrades.every(t => !isTagFlagged(t.tag) || isTagDisciplined(t.tag))

  // Best session (highest P&L)
  const maxPnl = recentSessions.length > 0 ? Math.max(...recentSessions.map(s => s.pnl ?? 0)) : 0

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
            No trades yet. Upload your first file.
          </p>
        ) : (
          <>
            {/* Session header */}
            {mostRecentSessionDate && (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: 8, marginTop: 0 }}>
                From: {fmtDate(mostRecentSessionDate)}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {uniqueTrades.map((t, i) => {
                const ts = tagBadgeStyle(t.tag)
                const isHovered = tradeHover === i
                const dest = t.sessionDate ? `/journal?date=${t.sessionDate}` : '/journal'
                const pnlStr = fmtPnl(t.pnl || 0)
                return (
                  <div
                    key={`${t.time}-${t.symbol}-${i}`}
                    onClick={() => router.push(dest)}
                    onMouseEnter={() => setTradeHover(i)}
                    onMouseLeave={() => setTradeHover(null)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 6px', borderRadius: 6, cursor: 'pointer',
                      background: isHovered ? 'var(--color-canvas)' : 'transparent',
                      transition: 'background 0.15s', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>
                        {t.time || '--:--'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cleanSymbol(t.symbol)}
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
                          padding: '1px 5px', borderRadius: 3, flexShrink: 0, ...ts,
                        }}>
                          {t.tag}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {pnlStr ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: (t.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {pnlStr}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic' }}>Breakeven</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-border)', opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                        →
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sequence insight */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid var(--color-border)' }}>
              {firstFlaggedIdx >= 0 ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic', margin: 0 }}>
                  Trade {firstFlaggedIdx + 1} was flagged.{' '}
                  <Link href="/journal" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Review in Journal</Link>
                </p>
              ) : allDisciplined ? (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-profit)', fontStyle: 'italic', margin: 0 }}>
                  Clean session. All trades followed your rules.
                </p>
              ) : null}
            </div>

            <Link href="/journal" style={{
              display: 'block', marginTop: 8,
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400,
              color: 'var(--color-muted)', textDecoration: 'none', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-muted)')}>
              Open Journal →
            </Link>
          </>
        )}
      </div>

      {/* Recent Sessions */}
      <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 10, padding: '16px 16px 12px' }}>
        <SectionTitle>Recent Sessions</SectionTitle>
        {recentSessions.length === 0 ? (
          <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', padding: '16px 0', textAlign: 'center', margin: 0 }}>
            No sessions yet. Analyse your first trade file.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentSessions.slice(0, 4).map((s, i) => {
                const isHovered = sessionHover === i
                const dest = s.date ? `/journal?date=${s.date}` : '/journal'
                const wr = Math.round((s.winRate || 0) * 10) / 10
                const pnlStr = fmtPnl(s.pnl || 0)
                const isBest = (s.pnl ?? 0) === maxPnl && maxPnl > 0
                const isLuckyWin = (s.pnl ?? 0) > 0 && (s.dqsScore ?? 0) > 0 && (s.dqsScore ?? 0) < 50
                return (
                  <div
                    key={`${s.date}-${i}`}
                    onClick={() => router.push(dest)}
                    onMouseEnter={() => setSessionHover(i)}
                    onMouseLeave={() => setSessionHover(null)}
                    style={{
                      padding: '8px 6px', borderRadius: 6, cursor: 'pointer',
                      background: isHovered ? 'var(--color-canvas)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: 'var(--color-ink)' }}>
                        {fmtDate(s.date)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {pnlStr ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: (s.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pnlStr}
                          </span>
                        ) : (
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)', fontStyle: 'italic' }}>Breakeven</span>
                        )}
                        {isBest && (
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(29,158,117,0.1)', color: 'var(--color-profit)', border: '1px solid rgba(29,158,117,0.3)' }}>
                            Best
                          </span>
                        )}
                        {isLuckyWin && (
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(192,123,42,0.1)', color: '#C07B2A', border: '1px solid rgba(192,123,42,0.3)' }}
                            title="Good result but low discipline. Review this session.">
                            Review
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-border)', opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                          →
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)' }}>
                        {s.trades || 0} {(s.trades || 0) === 1 ? 'trade' : 'trades'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
                        {wr}%
                      </span>
                      {(s.dqsScore ?? 0) > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: dqsColor(s.dqsScore!) }}>
                          DQS {s.dqsScore}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <Link href="/journal" style={{
              display: 'block', marginTop: 10, paddingTop: 10,
              borderTop: '0.5px solid var(--color-border)',
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400,
              color: 'var(--color-muted)', textDecoration: 'none', transition: 'color 0.15s',
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
