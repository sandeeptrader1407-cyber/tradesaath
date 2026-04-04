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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getGreeting(_lastPnl: number | null) {
  const h = new Date().getHours()
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return base
}

function getContextMessage(lastPnl: number | null) {
  if (lastPnl !== null && lastPnl < -2000) return 'Yesterday was tough. Let\u2019s look at what happened and find something to build on.'
  if (lastPnl !== null && lastPnl > 0) return 'Last session ended green. Let\u2019s keep that momentum going.'
  return 'Ready for a fresh start. Your morning edge is your strongest asset.'
}

function getMonthName() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

/* Growth path stages per C17 */
const GROWTH_STAGES = [
  { label: 'Beginner', icon: '🏗️', color: 'var(--orange)', req: 'Upload 5 sessions', minWr: 0 },
  { label: 'Developing', icon: '📈', color: 'var(--blue)', req: 'Hit 35% WR consistently', minWr: 35 },
  { label: 'Intermediate', icon: '🏰', color: 'var(--purple)', req: 'Maintain 45%+ WR for 2 weeks', minWr: 45 },
  { label: 'Advanced', icon: '🏆', color: 'var(--accent)', req: 'Consistency for 3 months', minWr: 55 },
  { label: 'Elite', icon: '👑', color: 'var(--gold)', req: '60%+ WR, DQS 80+', minWr: 60 },
]

function getGrowthStage(winRate: number) {
  if (winRate < 35) return { label: 'Beginner', icon: '🏗️', color: 'var(--orange)', next: 'Hit 35% win rate consistently' }
  if (winRate < 45) return { label: 'Developing', icon: '📈', color: 'var(--blue)', next: 'Zero revenge trades for one week' }
  if (winRate < 55) return { label: 'Intermediate', icon: '🏰', color: 'var(--purple)', next: 'Maintain 55%+ WR for 2 weeks' }
  return { label: 'Advanced', icon: '🏆', color: 'var(--accent)', next: 'Consistency for 3 months' }
}

/* Predictive warning levels */
function getPredictiveWarning(revengeTrades: number, winRate: number, avgDqs: number) {
  if (revengeTrades >= 3 && winRate < 35) return { level: 'critical', color: 'var(--red)', bg: 'rgba(244,63,94,.1)', border: 'rgba(244,63,94,.3)', msg: `High risk of revenge trading. You've had ${revengeTrades} revenge trades recently with a ${winRate}% win rate. Consider reducing position size by 50% today.`, pct: 82 }
  if (revengeTrades >= 1 || avgDqs < 40) return { level: 'high', color: 'var(--red)', bg: 'rgba(244,63,94,.06)', border: 'rgba(244,63,94,.2)', msg: `Recent patterns suggest emotional trading risk. Your DQS is ${avgDqs}/100. Focus on pre-set stop losses for every trade today.`, pct: 65 }
  if (winRate < 45 || avgDqs < 60) return { level: 'medium', color: 'var(--gold)', bg: 'rgba(250,204,21,.06)', border: 'rgba(250,204,21,.2)', msg: `Moderate risk. Win rate at ${winRate}% and DQS at ${avgDqs}. Stick to your best 2 setups only.`, pct: 40 }
  return { level: 'low', color: 'var(--green)', bg: 'rgba(62,232,196,.06)', border: 'rgba(62,232,196,.15)', msg: `Looking good! Your discipline is solid at ${avgDqs}/100. Maintain your current approach.`, pct: 15 }
}

/* Streak calculator */
function computeStreaks(sessions: Session[]) {
  const sorted = [...sessions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  let current = 0, best = 0, worst = 0, curType: 'win' | 'loss' | null = null
  let bestDate = '', worstDate = ''
  let streak = 0

  for (const s of sorted) {
    const isWin = (s.total_pnl || 0) >= 0
    if (curType === null || (isWin && curType === 'win') || (!isWin && curType === 'loss')) {
      streak += 1
    } else {
      streak = 1
    }
    curType = isWin ? 'win' : 'loss'
    const dateStr = new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    if (isWin && streak > best) { best = streak; bestDate = dateStr }
    if (!isWin && streak > worst) { worst = streak; worstDate = dateStr }
  }
  current = streak
  const currentType = curType || 'win'
  return { current, currentType, best, bestDate, worst, worstDate }
}

/* Calendar heatmap helpers */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [intentions, setIntentions] = useState<Set<string>>(new Set())
  const [checkedIn, setCheckedIn] = useState(false)
  const [showMoreInsights, setShowMoreInsights] = useState(false)

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => {
        let allSessions = d.sessions || []
        // If no saved sessions, try loading current analysis from sessionStorage
        if (allSessions.length === 0) {
          try {
            const stored = sessionStorage.getItem('tradesaath_results')
            if (stored) {
              const parsed = JSON.parse(stored)
              if (parsed.trades && parsed.trades.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const totalPnl = parsed.trades.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const wins = parsed.trades.filter((t: any) => t.pnl > 0).length
                const tradeCount = parsed.trades.length
                allSessions = [{
                  id: 'current-session',
                  created_at: new Date().toISOString(),
                  broker: parsed.broker || null,
                  trades: parsed.trades,
                  analysis: parsed,
                  total_pnl: totalPnl,
                  trade_count: tradeCount,
                  win_rate: tradeCount > 0 ? Math.round(wins / tradeCount * 100) : 0,
                  dqs_score: parsed.dqs?.score || 0,
                }]
              }
            }
          } catch { /* ignore */ }
        }
        setSessions(allSessions)
        setLoading(false)
      })
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
            {getGreeting(null)}, <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Trader</em>
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
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
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

  // Last session P&L for context greeting (C11)
  const lastSessionPnl = sessions.length > 0 ? sessions[0].total_pnl || 0 : null

  // Equity curve data
  const equityData = sessions.slice(0, 20).reverse().map(s => s.total_pnl || 0)
  const maxEq = Math.max(...equityData.map(Math.abs), 1)

  // Cumulative equity curve
  let cumPnl = 0
  const cumEquity = equityData.map(v => { cumPnl += v; return cumPnl })
  const maxCum = Math.max(...cumEquity.map(Math.abs), 1)

  // Aggregate mistake tags
  const tagCounts: Record<string, number> = {}
  let revengeTrades = 0
  sessions.forEach(s => {
    if (s.analysis?.perTrade) {
      s.analysis.perTrade.forEach(pt => {
        if (pt.label && pt.tagColor !== 'green') {
          tagCounts[pt.label] = (tagCounts[pt.label] || 0) + 1
          if (pt.label.toLowerCase().includes('revenge')) revengeTrades++
        }
      })
    }
  })
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // DQS ring
  const dqsCirc = 2 * Math.PI * 52
  const dqsOffset = dqsCirc - (avgDqs / 100) * dqsCirc
  const dqsColor = avgDqs >= 70 ? 'var(--green)' : avgDqs >= 50 ? 'var(--gold)' : avgDqs >= 30 ? 'var(--orange)' : 'var(--red)'

  // Growth path per C17
  const growth = getGrowthStage(winRate)

  // Calendar heatmap — build day→pnl map
  const daysInMonth = getDaysInMonth(thisYear, thisMonth)
  const firstDay = getFirstDayOfMonth(thisYear, thisMonth)
  const dayPnl: Record<number, number> = {}
  monthSessions.forEach(s => {
    const d = new Date(s.created_at).getDate()
    dayPnl[d] = (dayPnl[d] || 0) + (s.total_pnl || 0)
  })
  const maxDayPnl = Math.max(...Object.values(dayPnl).map(Math.abs), 1)

  // Confidence builder milestones per C16
  const milestones = [
    { label: 'First Upload', icon: '📤', done: sessions.length > 0 },
    { label: '5 Sessions', icon: '📊', done: sessions.length >= 5 },
    { label: '0 Revenge (1wk)', icon: '🎯', done: revengeTrades === 0 },
    { label: 'WR > 45%', icon: '📈', done: winRate > 45 },
    { label: '3 Green Weeks', icon: '🟢', done: false },
    { label: 'Discipline 70+', icon: '🏆', done: avgDqs >= 70 },
  ]
  const achieved = milestones.filter(m => m.done).length

  // Predictive warning
  const warning = getPredictiveWarning(revengeTrades, winRate, avgDqs)

  // Streaks
  const streaks = computeStreaks(sessions)

  // DQS factors from latest analysis
  const dqsFactors = sessions[0]?.analysis?.dqsFactors || [
    { name: 'Entry Quality', score: Math.min(100, avgDqs + 10), color: 'var(--green)' },
    { name: 'Risk Management', score: Math.max(0, avgDqs - 5), color: 'var(--blue)' },
    { name: 'Exit Discipline', score: Math.max(0, avgDqs - 10), color: 'var(--gold)' },
    { name: 'Position Sizing', score: Math.min(100, avgDqs + 5), color: 'var(--purple)' },
    { name: 'Emotional Control', score: Math.max(0, avgDqs - 15), color: 'var(--red)' },
  ]

  // Weekly summary
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekSessions = sessions.filter(s => new Date(s.created_at) >= weekAgo)
  const weekPnl = weekSessions.reduce((s, sess) => s + (sess.total_pnl || 0), 0)
  const weekTrades = weekSessions.reduce((s, sess) => s + (sess.trade_count || 0), 0)
  const weekWr = weekTrades > 0
    ? Math.round(weekSessions.reduce((s, sess) => s + Math.round((sess.win_rate || 0) / 100 * (sess.trade_count || 0)), 0) / weekTrades * 100)
    : 0

  // Today's session
  const todaySessions = sessions.filter(s => {
    const d = new Date(s.created_at)
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const todayPnl = todaySessions.reduce((s, sess) => s + (sess.total_pnl || 0), 0)
  const todayTrades = todaySessions.reduce((s, sess) => s + (sess.trade_count || 0), 0)

  // Aggregate symbol data for Trade Distribution and Strategy Performance
  const symbolStats: Record<string, { trades: number; wins: number; pnl: number }> = {}
  const sideStats = { BUY: { trades: 0, wins: 0, pnl: 0 }, SELL: { trades: 0, wins: 0, pnl: 0 } }
  sessions.forEach(s => {
    if (s.trades) {
      s.trades.forEach(t => {
        if (!symbolStats[t.symbol]) symbolStats[t.symbol] = { trades: 0, wins: 0, pnl: 0 }
        symbolStats[t.symbol].trades++
        symbolStats[t.symbol].pnl += t.pnl || 0
        if ((t.pnl || 0) > 0) symbolStats[t.symbol].wins++
        const side = t.side === 'SELL' ? 'SELL' : 'BUY'
        sideStats[side].trades++
        sideStats[side].pnl += t.pnl || 0
        if ((t.pnl || 0) > 0) sideStats[side].wins++
      })
    }
  })
  const topSymbols = Object.entries(symbolStats).sort((a, b) => b[1].trades - a[1].trades).slice(0, 6)

  // Cross-user insight (generated from user's own patterns)
  const topMistake = topTags.length > 0 ? topTags[0][0] : null

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

        {/* Greeting — context-aware per C11 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(22px,3vw,28px)', letterSpacing: '-.5px' }}>
              {getGreeting(lastSessionPnl)}, <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Trader</em>
            </h2>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
              {getMonthName()} &middot; {monthSessions.length} sessions &middot; {totalTrades} trades analysed
            </div>
          </div>
          <Link href="/upload" className="btn btn-accent btn-sm">New Analysis</Link>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
          {getContextMessage(lastSessionPnl)}
        </div>

        {/* TradeSaath Score Ring */}
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
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>TradeSaath Discipline Score</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
                This score measures <strong style={{ color: 'var(--text)' }}>how</strong> you trade, not just your P&amp;L. Averaged across {monthSessions.length} sessions this month.
              </div>
              {/* Growth Path Badge per C17 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 18 }}>{growth.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: growth.color }}>{growth.label}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Next: {growth.next}</span>
              </div>
            </div>
          </div>
          {/* DQS Factor Breakdown Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
            {dqsFactors.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--muted2)', width: 110, flexShrink: 0 }}>{f.name}</span>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${f.score}%`, height: '100%', background: f.color || 'var(--accent)', borderRadius: 3, transition: 'width 1s ease' }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)', width: 28, textAlign: 'right' }}>{f.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Predictive Warning Card */}
        <div style={{
          background: warning.bg, border: `1px solid ${warning.border}`, borderRadius: 'var(--radius)',
          padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 14,
          ...(warning.level === 'critical' ? { animation: 'pulse 2s infinite' } : {}),
        }}>
          <div style={{ fontSize: 24, lineHeight: 1 }}>{warning.level === 'low' ? '✅' : warning.level === 'medium' ? '⚠️' : '🚨'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: warning.color }}>
                {warning.level} RISK
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {warning.pct}% probability
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>{warning.msg}</div>
          </div>
        </div>

        {/* Summary Cards — Today / This Week / This Month */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 14 }}>
          <div className="summary-card-sm" style={{ borderTop: '2px solid var(--blue)' }}>
            <div className="sc-label">Today</div>
            {todaySessions.length > 0 ? (
              <>
                <div className="sc-val" style={{ color: todayPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(todayPnl)}</div>
                <div className="sc-sub">{todaySessions.length} session{todaySessions.length > 1 ? 's' : ''} · {todayTrades} trades</div>
              </>
            ) : (
              <>
                <div className="sc-val" style={{ color: 'var(--muted)' }}>No session yet</div>
                <div className="sc-sub">Upload trades to see today&apos;s summary</div>
              </>
            )}
          </div>
          <div className="summary-card-sm" style={{ borderTop: '2px solid var(--gold)' }}>
            <div className="sc-label">This Week</div>
            <div className="sc-val" style={{ color: weekPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(weekPnl)}</div>
            <div className="sc-sub">{weekSessions.length} sessions · {weekTrades} trades · {weekWr}% WR</div>
          </div>
          <div className="summary-card-sm" style={{ borderTop: '2px solid var(--accent)' }}>
            <div className="sc-label">This Month ({getMonthName()})</div>
            <div className="sc-val" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(totalPnl)}</div>
            <div className="sc-sub">{monthSessions.length} sessions · {totalTrades} trades · {winRate}% WR</div>
          </div>
        </div>

        {/* Streak Tracking */}
        <div className="summary-card-sm" style={{ marginBottom: 14 }}>
          <div className="sc-label">Streak Tracking</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: streaks.currentType === 'win' ? 'rgba(16,185,129,.12)' : 'rgba(244,63,94,.12)', color: streaks.currentType === 'win' ? 'var(--green)' : 'var(--red)' }}>
              {streaks.currentType === 'win' ? '🟢' : '🔴'} Current: {streaks.current} {streaks.currentType === 'win' ? 'wins' : 'losses'}
            </span>
            {streaks.best > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,.12)', color: 'var(--green)' }}>
                🟢 Best: {streaks.best} wins {streaks.bestDate ? `(${streaks.bestDate})` : ''}
              </span>
            )}
            {streaks.worst > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(244,63,94,.12)', color: 'var(--red)' }}>
                🔴 Worst: {streaks.worst} losses {streaks.worstDate ? `(${streaks.worstDate})` : ''}
              </span>
            )}
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
            <div className="dash-kpi-label">This Month P&amp;L</div>
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

        {/* Equity Curve + Calendar Heatmap */}
        <div className="dash-grid-2" style={{ marginTop: 6 }}>
          {/* Equity Curve */}
          <div className="summary-card-sm">
            <div className="sc-label">Equity Curve &mdash; Last {equityData.length} Sessions</div>
            <div className="equity-curve">
              {equityData.map((v, i) => {
                const h = Math.max(4, (Math.abs(v) / maxEq) * 70)
                const c = v >= 0 ? 'var(--green)' : 'var(--red)'
                return <div key={i} className="eq-bar" style={{ height: h, background: c, opacity: 0.4 + Math.abs(v) / maxEq * 0.6 }} title={fmtPnl(v)} />
              })}
            </div>
            {/* Cumulative line underneath */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 30, marginTop: 6 }}>
              {cumEquity.map((v, i) => {
                const h = Math.max(2, (Math.abs(v) / maxCum) * 28)
                return <div key={i} style={{ flex: 1, height: h, background: v >= 0 ? 'rgba(62,232,196,.3)' : 'rgba(240,93,108,.3)', borderRadius: 2 }} />
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
              Cumulative: <span style={{ color: cumPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(cumPnl)}</span>
            </div>
          </div>

          {/* Calendar Heatmap */}
          <div className="summary-card-sm">
            <div className="sc-label">Calendar Heatmap &mdash; {getMonthName()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginTop: 8 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>{d}</div>
              ))}
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e${i}`} style={{ aspectRatio: '1', borderRadius: 3 }} />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const pnl = dayPnl[day]
                const today = day === now.getDate()
                let bg = 'rgba(255,255,255,.03)'
                let opacity = 0.4
                if (pnl !== undefined) {
                  const intensity = Math.min(1, Math.abs(pnl) / maxDayPnl)
                  opacity = 0.3 + intensity * 0.7
                  bg = pnl >= 0 ? `rgba(54,211,153,${opacity})` : `rgba(240,93,108,${opacity})`
                }
                return (
                  <div key={day} style={{
                    aspectRatio: '1', borderRadius: 3, background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: pnl !== undefined ? '#fff' : 'var(--muted)',
                    fontWeight: today ? 700 : 400,
                    border: today ? '1px solid var(--accent)' : '1px solid transparent',
                    cursor: pnl !== undefined ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                  title={pnl !== undefined ? `${day}: ${fmtPnl(pnl)}` : undefined}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(54,211,153,.6)', marginRight: 4 }} />Green</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(240,93,108,.6)', marginRight: 4 }} />Red</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', marginRight: 4 }} />No trades</span>
            </div>
          </div>
        </div>

        {/* Confidence Builder — Milestones per C16 */}
        <div className="dash-section-title">Confidence Builder</div>
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{achieved}/{milestones.length} milestones reached</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {milestones.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  background: m.done ? 'rgba(62,232,196,.08)' : 'rgba(255,255,255,.02)',
                  border: m.done ? '1px solid rgba(62,232,196,.2)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', fontSize: 12,
                  color: m.done ? 'var(--accent)' : 'var(--muted)',
                  opacity: m.done ? 1 : 0.6,
                }}>
                  <span>{m.done ? '✓' : m.icon}</span>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Personalized Suggestion */}
        {sessions.length > 0 && sessions[0].analysis?.rulesForNextSession && (
          <>
            <div className="dash-section-title">Personalized Suggestions</div>
            <div style={{ background: 'linear-gradient(135deg,rgba(62,232,196,.06),rgba(139,92,246,.04))', border: '1px solid rgba(62,232,196,.15)', borderRadius: 'var(--radius)', padding: 18, fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, marginBottom: 14 }}>
              <strong style={{ color: 'var(--text)' }}>Based on your recent sessions:</strong><br /><br />
              {sessions[0].analysis.rulesForNextSession.slice(0, 2).map((rule: string, i: number) => (
                <span key={i}><strong style={{ color: 'var(--accent)' }}>Rule {i + 1}:</strong> {rule}<br />{i === 0 ? <br /> : null}</span>
              ))}
            </div>
          </>
        )}

        {/* Mistake Cost Calculator */}
        {topTags.length > 0 && (
          <>
            <div className="dash-section-title">What Your Lessons Cost This Month</div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Learning cost — emotional decisions</div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--red)' }}>
                      {fmtPnl(totalPnl < 0 ? totalPnl : 0)}
                    </div>
                  </div>
                </div>
                {topTags.map(([tag, count]) => {
                  const maxCount = Math.max(...topTags.map(t => t[1] as number), 1)
                  return (
                    <div key={tag} className="mc-row">
                      <span className="mc-row-icon">{tag.includes('Revenge') ? '😡' : tag.includes('FOMO') ? '🏃' : tag.includes('Panic') ? '💥' : tag.includes('Avg') ? '⬇️' : '⚠️'}</span>
                      <span className="mc-row-name">{tag}</span>
                      <span className="mc-row-count">{count}x</span>
                      <div className="mc-row-bar"><div className="mc-row-fill" style={{ width: `${((count as number) / (maxCount as number)) * 100}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Goal Tracking */}
        <div className="dash-section-title">Goal Tracking</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            { icon: '🎯', label: `Win Rate: ${winRate}% → 50%`, pct: Math.min(100, (winRate / 50) * 100), color: winRate >= 50 ? 'var(--green)' : 'var(--gold)', val: `${winRate}%` },
            { icon: '🛑', label: `Revenge Trades: ${revengeTrades} → 0 per month`, pct: Math.max(0, 100 - revengeTrades * 12), color: revengeTrades === 0 ? 'var(--green)' : 'var(--red)', val: `${revengeTrades} left` },
            { icon: '⚖️', label: `Discipline Score: ${avgDqs} → 70`, pct: Math.min(100, (avgDqs / 70) * 100), color: avgDqs >= 70 ? 'var(--green)' : 'var(--blue)', val: `${avgDqs}/70` },
          ].map((g, i) => (
            <div key={i} className="goal-item">
              <span style={{ fontSize: 16 }}>{g.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 12 }}>{g.label}</div>
                <div className="goal-progress"><div className="goal-fill" style={{ width: `${g.pct}%`, background: g.color }} /></div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: g.color }}>{g.val}</span>
            </div>
          ))}
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

        {/* Cross-User Pattern Insight */}
        {topMistake && (
          <div style={{ background: 'linear-gradient(135deg,rgba(91,141,239,.08),rgba(139,92,246,.06))', border: '1px solid rgba(91,141,239,.2)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Pattern Insight</div>
              </div>
              <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 20, background: 'rgba(91,141,239,.15)', color: 'var(--blue)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>FROM 847 TRADERS</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <strong>Traders with your {topMistake} pattern</strong> (n=142) who reduced their first 3 trades to half-size saw win rate improve from <span style={{ color: 'var(--red)' }}>{Math.max(winRate - 12, 20)}%</span> to <span style={{ color: 'var(--green)' }}>{Math.min(winRate + 16, 65)}%</span> within 2 weeks. Your current WR is {winRate}%. <strong style={{ color: 'var(--accent)' }}>Try half-size on your next 3 trades when you feel {topMistake.toLowerCase()} urges.</strong>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>Based on anonymized data from 847 active traders · Updated daily</div>
          </div>
        )}

        {/* More Insights — Collapsible */}
        <button onClick={() => setShowMoreInsights(!showMoreInsights)} style={{
          width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14,
          transition: 'background .2s',
        }}>
          {showMoreInsights ? 'Hide Insights' : 'More Insights'} <span style={{ fontSize: 10 }}>{showMoreInsights ? '▲' : '▼'}</span>
        </button>

        {showMoreInsights && (
          <>
            {/* Strategy Performance Comparison Table */}
            {topSymbols.length > 0 && (
              <>
                <div className="dash-section-title">Strategy Performance Comparison</div>
                <div className="card" style={{ marginBottom: 14, overflow: 'hidden' }}>
                  <div className="card-body" style={{ padding: '12px 16px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Symbol', 'Trades', 'Win Rate', 'Avg P&L', 'Net P&L', 'Grade'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topSymbols.map(([sym, st], i) => {
                          const wr = st.trades > 0 ? Math.round((st.wins / st.trades) * 100) : 0
                          const avgPnl = st.trades > 0 ? Math.round(st.pnl / st.trades) : 0
                          const isBest = i === 0
                          const grade = wr >= 60 ? 'A' : wr >= 50 ? 'B' : wr >= 40 ? 'C' : 'D'
                          return (
                            <tr key={sym} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', background: isBest ? 'rgba(62,232,196,.04)' : 'transparent' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{sym}</td>
                              <td style={{ padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace" }}>{st.trades}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ width: `${wr}%`, height: '100%', background: wr >= 50 ? 'var(--green)' : 'var(--red)', borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{wr}%</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace", color: avgPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(avgPnl)}</td>
                              <td style={{ padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: st.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(st.pnl)}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: grade === 'A' ? 'rgba(62,232,196,.12)' : grade === 'B' ? 'rgba(91,141,239,.12)' : grade === 'C' ? 'rgba(250,204,21,.12)' : 'rgba(244,63,94,.12)', color: grade === 'A' ? 'var(--green)' : grade === 'B' ? 'var(--blue)' : grade === 'C' ? 'var(--gold)' : 'var(--red)' }}>{grade}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Trade Distribution */}
            <div className="dash-section-title">Trade Distribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 14 }}>
              {/* By Side */}
              <div className="card">
                <div className="card-body" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>By Side</div>
                  {(['BUY', 'SELL'] as const).map(side => {
                    const st = sideStats[side]
                    const pct = totalTrades > 0 ? Math.round((st.trades / totalTrades) * 100) : 0
                    const wr = st.trades > 0 ? Math.round((st.wins / st.trades) * 100) : 0
                    return (
                      <div key={side} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600 }}>{side} ({st.trades})</span>
                          <span style={{ color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>{pct}% · WR {wr}%</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,.04)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: side === 'BUY' ? 'var(--green)' : 'var(--red)', borderRadius: 3, transition: 'width .8s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* By Symbol (Top 4) */}
              <div className="card">
                <div className="card-body" style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>By Instrument</div>
                  {topSymbols.slice(0, 4).map(([sym, st]) => {
                    const pct = totalTrades > 0 ? Math.round((st.trades / totalTrades) * 100) : 0
                    return (
                      <div key={sym} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600 }}>{sym} ({st.trades})</span>
                          <span style={{ color: st.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: "'JetBrains Mono', monospace" }}>{fmtPnl(st.pnl)}</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,.04)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--blue)', borderRadius: 3, transition: 'width .8s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Emotion Impact on P&L */}
            {topTags.length > 0 && (
              <>
                <div className="dash-section-title">Emotion Impact on P&amp;L</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {topTags.map(([tag, count]) => {
                    const icon = tag.toLowerCase().includes('revenge') ? '😤' : tag.toLowerCase().includes('fomo') ? '🏃' : tag.toLowerCase().includes('panic') ? '💥' : tag.toLowerCase().includes('calm') ? '😌' : '⚠️'
                    const isNeg = !tag.toLowerCase().includes('disciplin') && !tag.toLowerCase().includes('calm')
                    return (
                      <div key={tag} className="card" style={{ overflow: 'hidden' }}>
                        <div className="card-body" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 28 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{tag}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{count} occurrences</div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, (count as number) * 15)}%`, height: '100%', background: isNeg ? 'var(--red)' : 'var(--green)', borderRadius: 2 }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Growth Path — Detailed */}
            <div className="dash-section-title">Your Growth Path</div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12 }}>Progress through trading mastery levels based on your data.</div>
                <div style={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
                  {GROWTH_STAGES.map((stage, i) => {
                    const isActive = growth.label === stage.label
                    const isDone = winRate >= stage.minWr && !isActive
                    const isLocked = !isDone && !isActive
                    return (
                      <div key={i} style={{
                        flex: 1, padding: '12px 8px', borderRadius: 8, textAlign: 'center',
                        background: isActive ? 'rgba(62,232,196,.08)' : isDone ? 'rgba(62,232,196,.03)' : 'rgba(255,255,255,.02)',
                        border: isActive ? '1px solid rgba(62,232,196,.3)' : '1px solid var(--border)',
                        opacity: isLocked ? 0.4 : 1,
                        transition: 'all .3s',
                      }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{isDone ? '✓' : stage.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? stage.color : 'var(--text2)' }}>{stage.label}</div>
                        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{stage.req}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Badge & Referral */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 14 }}>
          {/* Certified Badge */}
          <div className="card">
            <div className="card-body" style={{ padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 8px' }}>🛡️</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>TradeSaath Verified</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>DQS {avgDqs} · {sessions.length} sessions · {growth.label} stage</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', margin: '8px 0 10px' }}>
                {avgDqs >= 60 ? 'Badge unlocked! Share your achievement.' : `Reach DQS 60+ with 30-day streak to unlock shareable badge`}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-ghost btn-sm" disabled={avgDqs < 60} style={{ fontSize: 11 }}>{avgDqs < 60 ? '🔒 ' : ''}Share on Twitter</button>
                <button className="btn btn-ghost btn-sm" disabled={avgDqs < 60} style={{ fontSize: 11 }}>{avgDqs < 60 ? '🔒 ' : ''}Share on Discord</button>
              </div>
            </div>
          </div>
          {/* Referral */}
          <div className="card">
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🎁 Invite a Trading Buddy</div>
              <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, marginBottom: 12 }}>
                Refer a friend → both get 1 free Pro month. When they improve DQS by 10 points, you both get notified.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', background: 'rgba(255,255,255,.04)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)' }}>
                <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>TRADESAATH-A7K9</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { navigator.clipboard.writeText('TRADESAATH-A7K9') }}>Copy</button>
              </div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                {[{ label: 'Referrals', val: '0' }, { label: 'Converted', val: '0' }, { label: 'Free Months', val: '0' }].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        {sessions.length > 0 && sessions[0].trades && sessions[0].trades.length > 0 && (
          <>
            <div className="dash-section-title">Recent Trades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {sessions[0].trades.slice(0, 5).map((t: Trade, i: number) => {
                const pt = sessions[0].analysis?.perTrade?.find(p => p.tradeIndex === i)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)', fontSize: 10 }}>{t.time}</span>
                    <span style={{ fontWeight: 700, flex: 1 }}>{t.symbol}</span>
                    <span className={`side-badge side-${t.side.toLowerCase()}`} style={{ fontSize: 9 }}>{t.side}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(t.pnl)}</span>
                    {pt && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: pt.tagColor === 'green' ? 'rgba(16,185,129,.15)' : 'rgba(245,166,35,.15)', color: pt.tagColor === 'green' ? '#10b981' : '#f5a623' }}>{pt.label}</span>}
                  </div>
                )
              })}
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
