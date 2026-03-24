'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Trade {
  id: number; time: string; symbol: string; side: 'BUY' | 'SELL'
  qty: number; entry: number; exit: number; pnl: number; cumPnl: number
  fills: { qty: number; price: number }[]
}

interface PerTrade {
  tradeIndex: number; tag: string; tagColor: string; label: string
  quickSummary: string; psychologyNote: string; technicalNote: string
}

interface Analysis {
  summary: string; dqsScore: number
  perTrade: PerTrade[]
  patterns: { name: string; icon: string; costInRupees: number; frequency: string }[]
  rulesForNextSession: string[]
}

interface Session {
  id: string
  created_at: string
  broker: string | null
  trades: Trade[]
  analysis: Analysis | null
  total_pnl: number
  trade_count: number
  win_rate: number
  dqs_score: number
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  green: { bg: 'rgba(54,211,153,.1)', color: 'var(--green)' },
  blue: { bg: 'rgba(91,141,239,.1)', color: 'var(--blue)' },
  orange: { bg: 'rgba(242,155,75,.1)', color: 'var(--orange)' },
  red: { bg: 'rgba(240,93,108,.1)', color: 'var(--red)' },
  purple: { bg: 'rgba(157,122,247,.1)', color: 'var(--purple)' },
  gold: { bg: 'rgba(240,180,41,.1)', color: 'var(--gold)' },
}

function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(n).toLocaleString('en-IN')
}

export default function JournalPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap"><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading journal...</div></div>
      </section>
    )
  }

  if (sessions.length === 0) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 4 }}>Trading Journal</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>0 sessions</div>
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8 }}>No Sessions Yet</h3>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20 }}>
              Upload and analyse trades to build your journal. Each session becomes a journal entry with AI insights.
            </p>
            <Link href="/upload" className="btn btn-accent">Upload Trades &rarr;</Link>
          </div>
        </div>
      </section>
    )
  }

  const filtered = sessions.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    const d = new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    return d.toLowerCase().includes(q) || (s.broker || '').toLowerCase().includes(q)
  })

  const selected = filtered[selectedIdx] || filtered[0]

  // Aggregate stats
  const totalPnl = sessions.reduce((s, sess) => s + (sess.total_pnl || 0), 0)
  const totalTrades = sessions.reduce((s, sess) => s + (sess.trade_count || 0), 0)
  const totalWins = sessions.reduce((s, sess) => {
    return s + Math.round((sess.win_rate || 0) / 100 * (sess.trade_count || 0))
  }, 0)
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0

  // Most common mistake tag
  const tagCounts: Record<string, number> = {}
  sessions.forEach(s => {
    if (s.analysis?.perTrade) {
      s.analysis.perTrade.forEach(pt => {
        if (pt.label && pt.tagColor !== 'green') {
          tagCounts[pt.label] = (tagCounts[pt.label] || 0) + 1
        }
      })
    }
  })
  const topMistake = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]

  // Pattern Intelligence: check last 5 sessions for >35% recurring tags
  const last5 = sessions.slice(0, 5)
  const last5Total = last5.reduce((s, sess) => s + (sess.analysis?.perTrade?.length || 0), 0)
  const last5Tags: Record<string, number> = {}
  last5.forEach(s => {
    if (s.analysis?.perTrade) {
      s.analysis.perTrade.forEach(pt => {
        if (pt.label && pt.tagColor !== 'green') {
          last5Tags[pt.label] = (last5Tags[pt.label] || 0) + 1
        }
      })
    }
  })
  const patternAlerts = Object.entries(last5Tags)
    .filter(([, count]) => last5Total > 0 && (count / last5Total) > 0.35)
    .sort((a, b) => b[1] - a[1])

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 4 }}>Trading Journal</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{sessions.length} sessions &middot; Pattern intelligence active</div>
          </div>
          <Link href="/upload" className="btn btn-ghost btn-sm">New Analysis &rarr;</Link>
        </div>

        <div className="journal-layout">
          {/* Sidebar */}
          <div className="journal-sidebar">
            <div className="j-sb-head">
              <div className="j-sb-title">Sessions</div>
              <input className="j-search" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setSelectedIdx(0) }} />
            </div>
            <div className="j-sess-list">
              {filtered.map((s, i) => {
                const d = new Date(s.created_at)
                const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                return (
                  <div key={s.id} className={`j-sess${i === selectedIdx ? ' active' : ''}`} onClick={() => setSelectedIdx(i)}>
                    <div className="j-sess-date">{dateStr}</div>
                    <div className="j-sess-meta">
                      <span>{s.broker || 'Trades'}</span>
                      <span>{s.trade_count || 0} trades</span>
                      <span className="j-sess-pnl" style={{ color: (s.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtPnl(s.total_pnl || 0)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Main */}
          <div className="journal-main">
            {/* Stats Strip */}
            <div className="j-stats-row">
              <div className="j-stat">
                <div className="j-stat-lbl">Total Sessions</div>
                <div className="j-stat-val">{sessions.length}</div>
              </div>
              <div className="j-stat">
                <div className="j-stat-lbl">Total P&L</div>
                <div className="j-stat-val" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 16 }}>{fmtPnl(totalPnl)}</div>
              </div>
              <div className="j-stat">
                <div className="j-stat-lbl">Win Rate</div>
                <div className="j-stat-val">{winRate}%</div>
              </div>
              <div className="j-stat">
                <div className="j-stat-lbl">Most Common Mistake</div>
                <div className="j-stat-val" style={{ fontSize: 14 }}>{topMistake ? topMistake[0] : 'None'}</div>
                {topMistake && <div className="j-stat-sub">{topMistake[1]} times</div>}
              </div>
            </div>

            {/* Pattern Alerts */}
            {patternAlerts.length > 0 && (
              <div className="pattern-alert">
                <div className="pa-title">Pattern Intelligence: Recurring Behaviour Detected</div>
                <div className="pa-body">
                  {patternAlerts.map(([tag, count]) => (
                    <div key={tag} style={{ marginBottom: 4 }}>
                      <strong style={{ color: 'var(--red)' }}>{tag}</strong> detected in {count} of {last5Total} trades across last {last5.length} sessions
                      ({Math.round(count / last5Total * 100)}% frequency). This pattern is costing you consistently.
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Session Detail */}
            {selected && (
              <div className="timeline-card">
                <div className="tl-head">
                  Trade Timeline &mdash; {new Date(selected.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {selected.analysis && (
                    <span style={{ float: 'right', fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                      DQS: {selected.analysis.dqsScore}/100
                    </span>
                  )}
                </div>
                <div className="tl-body">
                  {selected.analysis?.summary && (
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 16, padding: '12px 16px', background: 'var(--s2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent)' }}>
                      {selected.analysis.summary}
                    </div>
                  )}

                  {(selected.trades || []).map((t, i) => {
                    const pt = selected.analysis?.perTrade?.find(p => p.tradeIndex === i)
                    const dotColor = t.pnl >= 0 ? 'var(--green)' : 'var(--red)'
                    return (
                      <div key={t.id || i} className="tl-item">
                        <div className="tl-dot-wrap">
                          <div className="tl-dot" style={{ borderColor: dotColor }} />
                        </div>
                        <div className="tl-content">
                          <div className="tl-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="tl-sym">{t.symbol}</span>
                              <span className={`side-badge side-${t.side.toLowerCase()}`} style={{ fontSize: 9 }}>{t.side}</span>
                              {pt && (
                                <span className="tag-pill" style={{
                                  background: TAG_COLORS[pt.tagColor]?.bg,
                                  color: TAG_COLORS[pt.tagColor]?.color,
                                  fontSize: 9
                                }}>
                                  {pt.label}
                                </span>
                              )}
                            </div>
                            <div className="tl-meta">
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {fmtPnl(t.pnl)}
                              </span>
                            </div>
                          </div>
                          {t.entry && t.exit && (
                            <div className="tl-entry-exit">Entry: &#8377;{t.entry} &rarr; Exit: &#8377;{t.exit} &middot; Qty: {t.qty}</div>
                          )}
                          {pt?.quickSummary && (
                            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>{pt.quickSummary}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* View full analysis */}
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button className="btn btn-accent btn-sm" onClick={() => {
                      sessionStorage.setItem('tradesaath_results', JSON.stringify({
                        trades: selected.trades, analysis: selected.analysis, broker: selected.broker
                      }))
                      window.location.href = '/results'
                    }}>
                      View Full Analysis &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rules from last session */}
            {selected?.analysis?.rulesForNextSession && selected.analysis.rulesForNextSession.length > 0 && (
              <div className="card">
                <div className="card-head">Rules from This Session</div>
                <div className="card-body">
                  {selected.analysis.rulesForNextSession.map((rule, i) => (
                    <div key={i} className="action-item" style={{ borderLeft: '3px solid var(--accent)' }}>
                      <strong style={{ color: 'var(--accent)' }}>Rule {i + 1}:</strong> {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
