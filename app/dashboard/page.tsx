'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

interface Trade {
  id: number; time: string; symbol: string; side: 'BUY' | 'SELL'
  qty: number; pnl: number; cumPnl: number
}

interface Analysis {
  summary: string; dqsScore: number
  dqsFactors: { name: string; score: number; color: string }[]
  perTrade: { tradeIndex: number; tag: string; label: string; tagColor: string }[]
  patterns: { name: string; icon: string; costInRupees: number; frequency: string }[]
  rulesForNextSession: string[]
  financialImpact: { totalLost: number; potentialPnl: number; message: string }
}

function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(n).toLocaleString('en-IN')
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getMonthName() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [intentions, setIntentions] = useState<Set<string>>(new Set())
  const [checkedIn, setCheckedIn] = useState(false)

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap"><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading dashboard...</div></div>
      </section>
    )
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, marginBottom: 4 }}>
            {getGreeting()}, <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Trader</em>
          </h2>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>{getMonthName()}</div>

          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8 }}>Upload Your First Session</h3>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20 }}>
              Upload your trade file to see KPIs, AI psychology coaching, equity curves, and behavioral insights.
            </p>
            <Link href="/upload" className="btn btn-accent">Upload Trades &rarr;</Link>
          </div>
        </div>
      </section>
    )
  }

  // Compute aggregate stats
  const thisMonth = new Date().getMonth()
  const thisYear = new Date().getFullYear()
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.created_at)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })

  const totalPnl = monthSessions.reduce((s, sess) => s + (sess.total_pnl || 0), 0)
  const totalTrades = monthSessions.reduce((s, sess) => s + (sess.trade_count || 0), 0)
  const totalWins = monthSessions.reduce((s, sess) => {
    const wr = sess.win_rate || 0
    const tc = sess.trade_count || 0
    return s + Math.round(wr / 100 * tc)
  }, 0)
  const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0
  const avgDqs = monthSessions.length > 0
    ? Math.round(monthSessions.reduce((s, sess) => s + (sess.dqs_score || 0), 0) / monthSessions.length)
    : 0

  // Equity curve data
  const equityData = sessions.slice(0, 20).reverse().map(s => s.total_pnl || 0)
  const maxEq = Math.max(...equityData.map(Math.abs), 1)

  // Aggregate mistake tags
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
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // DQS ring
  const dqsCirc = 2 * Math.PI * 52
  const dqsOffset = dqsCirc - (avgDqs / 100) * dqsCirc
  const dqsColor = avgDqs >= 70 ? 'var(--green)' : avgDqs >= 50 ? 'var(--gold)' : avgDqs >= 30 ? 'var(--orange)' : 'var(--red)'

  function toggleIntention(label: string) {
    setIntentions(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      return next
    })
  }

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 1100 }}>

        {/* Greeting */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(22px,3vw,28px)', letterSpacing: '-.5px' }}>
              {getGreeting()}, <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Trader</em>
            </h2>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
              {getMonthName()} &middot; {monthSessions.length} sessions &middot; {totalTrades} trades analysed
            </div>
          </div>
          <Link href="/upload" className="btn btn-accent btn-sm">New Analysis</Link>
        </div>

        {/* Discipline Score Ring */}
        <div className="ts-score-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div className="ts-score-ring">
              <svg viewBox="0 0 120 120">
                <circle className="bg" cx="60" cy="60" r="52" />
                <circle className="fg" cx="60" cy="60" r="52"
                  strokeDasharray={dqsCirc} strokeDashoffset={dqsOffset} />
              </svg>
              <div className="ts-score-num" style={{ color: dqsColor }}>{avgDqs}</div>
              <div className="ts-score-lbl">OUT OF 100</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Your Discipline Rating</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
                This score measures <strong style={{ color: 'var(--text)' }}>how</strong> you trade, not just your P&L. Averaged across {monthSessions.length} sessions this month.
              </div>
            </div>
          </div>
        </div>

        {/* Pre-market Check-in */}
        {!checkedIn ? (
          <div style={{ background: 'linear-gradient(135deg,rgba(62,232,196,.06),rgba(91,141,239,.04))', border: '1px solid rgba(62,232,196,.15)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Before you trade today</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>
              Take 30 seconds to set your intention. What&apos;s your <strong>one rule</strong> you won&apos;t break today?
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {['No revenge trades', 'Stop at 10:30 AM', 'Max 8 trades', 'Fixed 20 lots', 'Stop loss every trade'].map(label => (
                <button key={label} className={`j-pill${intentions.has(label) ? ' on' : ''}`}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  onClick={() => toggleIntention(label)}>
                  {label}
                </button>
              ))}
            </div>
            <button className="btn btn-accent btn-sm" onClick={() => setCheckedIn(true)}>
              I&apos;m ready &rarr;
            </button>
          </div>
        ) : (
          <div style={{ padding: '12px 16px', marginBottom: 14, background: 'rgba(62,232,196,.06)', border: '1px solid rgba(62,232,196,.15)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            Intention set. Have a disciplined session.
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 6 }}>
          <Link href="/upload" className="quick-action-btn">Upload Trades</Link>
          <Link href="/journal" className="quick-action-btn">Open Journal</Link>
          <Link href="/pricing" className="quick-action-btn">Upgrade Plan</Link>
        </div>

        {/* Performance KPIs */}
        <div className="dash-section-title">Performance Overview</div>
        <div className="dash-kpi-row">
          <div className="dash-kpi">
            <div className="dash-kpi-label">This Month P&L</div>
            <div className="dash-kpi-val" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(totalPnl)}</div>
            <div className="dash-kpi-sub">{monthSessions.length} sessions</div>
            <div className="dash-kpi-bar" style={{ background: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }} />
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Win Rate</div>
            <div className="dash-kpi-val">{winRate}%</div>
            <div className="dash-kpi-sub">{totalWins} of {totalTrades}</div>
            <div className="dash-kpi-bar" style={{ background: winRate >= 50 ? 'var(--green)' : 'var(--gold)' }} />
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Sessions</div>
            <div className="dash-kpi-val">{monthSessions.length}</div>
            <div className="dash-kpi-sub">{totalTrades} total trades</div>
            <div className="dash-kpi-bar" style={{ background: 'var(--blue)' }} />
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi-label">Avg DQS</div>
            <div className="dash-kpi-val" style={{ color: dqsColor }}>{avgDqs}/100</div>
            <div className="dash-kpi-sub">Discipline Quality</div>
            <div className="dash-kpi-bar" style={{ background: dqsColor }} />
          </div>
        </div>

        {/* Equity Curve + Upload Strip */}
        <div className="dash-grid-2" style={{ marginTop: 6 }}>
          <div className="summary-card-sm">
            <div className="sc-label">Equity Curve &mdash; Last {equityData.length} Sessions</div>
            <div className="equity-curve">
              {equityData.map((v, i) => {
                const h = Math.max(4, (Math.abs(v) / maxEq) * 70)
                const c = v >= 0 ? 'var(--green)' : 'var(--red)'
                return <div key={i} className="eq-bar" style={{ height: h, background: c, opacity: 0.4 + Math.abs(v) / maxEq * 0.6 }} />
              })}
            </div>
          </div>
          <div className="summary-card-sm" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Upload Today&apos;s Trades</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12 }}>Get AI coaching for today&apos;s session</div>
            <Link href="/upload" className="btn btn-accent btn-sm">Upload &rarr;</Link>
          </div>
        </div>

        {/* Behavioral Insights */}
        {topTags.length > 0 && (
          <>
            <div className="dash-section-title">Behavioral Insights</div>
            <div className="insights-grid">
              {topTags.map(([tag, count]) => (
                <div key={tag} className="insight-card">
                  <h4>{tag}</h4>
                  <p>Detected <strong style={{ color: 'var(--accent)' }}>{count} times</strong> across your sessions. This is one of your most frequent behavioral patterns. Focus on reducing this to improve your discipline score.</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Recent Sessions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 20 }}>
          <div className="dash-section-title" style={{ margin: 0 }}>Recent Sessions</div>
          <Link href="/journal" className="btn btn-ghost btn-sm">View All &rarr;</Link>
        </div>
        <div className="sessions-grid">
          {sessions.slice(0, 4).map(s => {
            const d = new Date(s.created_at)
            const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            const wr = s.win_rate || 0
            return (
              <div key={s.id} className="session-card" onClick={() => {
                sessionStorage.setItem('tradesaath_results', JSON.stringify({ trades: s.trades, analysis: s.analysis, broker: s.broker }))
                window.location.href = '/results'
              }}>
                <div className="sc-head">
                  <span className="sc-date">{dateStr}</span>
                  <span className="sc-market">{s.broker || 'TRADES'}</span>
                </div>
                <div className="sc-stats">
                  <span><strong>{s.trade_count || 0}</strong> trades</span>
                  <span><strong>{wr}%</strong> win</span>
                </div>
                <div className="sc-pnl" style={{ color: (s.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtPnl(s.total_pnl || 0)}
                </div>
                <div className="sc-bar"><div className="sc-bar-fill" style={{ width: `${wr}%`, background: wr >= 50 ? 'var(--green)' : 'var(--red)' }} /></div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
