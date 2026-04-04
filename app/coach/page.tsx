'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Session {
  id: string
  created_at: string
  total_pnl: number
  trade_count: number
  win_rate: number
  dqs_score: number
  analysis: {
    summary: string
    dqsScore: number
    patterns: { name: string; icon: string; costInRupees: number; frequency: string }[]
    rulesForNextSession: string[]
    perTrade: { tradeIndex: number; tag: string; label: string; tagColor: string }[]
  } | null
}

function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(n).toLocaleString('en-IN')
}

type CoachTab = 'daily' | 'weekly' | 'monthly' | 'quarterly'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AiPlan { title: string; subtitle: string; sections: any[] }

export default function CoachPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CoachTab>('daily')
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCache, setAiCache] = useState<Record<string, AiPlan>>({})

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
                  total_pnl: totalPnl,
                  trade_count: tradeCount,
                  win_rate: tradeCount > 0 ? Math.round(wins / tradeCount * 100) : 0,
                  dqs_score: parsed.dqs?.score || 0,
                  analysis: parsed,
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

  // Fetch AI coaching plan when tab changes
  useEffect(() => {
    if (sessions.length === 0 || loading) return
    if (aiCache[tab]) { setAiPlan(aiCache[tab]); return }
    setAiLoading(true)
    fetch('/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.plan) {
          setAiPlan(data.plan)
          setAiCache(prev => ({ ...prev, [tab]: data.plan }))
        }
        setAiLoading(false)
      })
      .catch(() => setAiLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sessions.length, loading])

  if (loading) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap"><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading coach...</div></div>
      </section>
    )
  }

  if (sessions.length === 0) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, marginBottom: 8 }}>AI Coach</h2>
          <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20 }}>
            Upload your first trading session to unlock personalized AI coaching — daily reviews, weekly patterns, monthly progress, and quarterly strategy insights.
          </p>
          <Link href="/upload" className="btn btn-accent">Upload Trades &rarr;</Link>
        </div>
      </section>
    )
  }

  // Aggregate data
  const now = new Date()
  const today = now.toDateString()
  const todaySessions = sessions.filter(s => new Date(s.created_at).toDateString() === today)
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay())
  const weekSessions = sessions.filter(s => new Date(s.created_at) >= thisWeekStart)
  const thisMonth = now.getMonth(); const thisYear = now.getFullYear()
  const monthSessions = sessions.filter(s => { const d = new Date(s.created_at); return d.getMonth() === thisMonth && d.getFullYear() === thisYear })
  const quarterStart = new Date(thisYear, Math.floor(thisMonth / 3) * 3, 1)
  const quarterSessions = sessions.filter(s => new Date(s.created_at) >= quarterStart)

  function getStats(sess: Session[]) {
    const pnl = sess.reduce((s, x) => s + (x.total_pnl || 0), 0)
    const trades = sess.reduce((s, x) => s + (x.trade_count || 0), 0)
    const wins = sess.reduce((s, x) => s + Math.round((x.win_rate || 0) / 100 * (x.trade_count || 0)), 0)
    const wr = trades > 0 ? Math.round(wins / trades * 100) : 0
    const avgDqs = sess.length > 0 ? Math.round(sess.reduce((s, x) => s + (x.dqs_score || 0), 0) / sess.length) : 0
    const tags: Record<string, number> = {}
    sess.forEach(x => x.analysis?.perTrade?.forEach(pt => {
      if (pt.label && pt.tagColor !== 'green') tags[pt.label] = (tags[pt.label] || 0) + 1
    }))
    const topMistakes = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const rules = sess.flatMap(x => x.analysis?.rulesForNextSession || []).slice(0, 5)
    return { pnl, trades, wins, wr, avgDqs, topMistakes, rules, sessionCount: sess.length }
  }

  const dataSets: Record<CoachTab, { label: string; sessions: Session[] }> = {
    daily: { label: 'Today', sessions: todaySessions },
    weekly: { label: 'This Week', sessions: weekSessions },
    monthly: { label: 'This Month', sessions: monthSessions },
    quarterly: { label: 'This Quarter', sessions: quarterSessions },
  }

  const current = dataSets[tab]
  const stats = getStats(current.sessions)

  // Personalized coaching messages per C4/C8
  function getCoachMessage(s: ReturnType<typeof getStats>, period: string) {
    if (s.sessionCount === 0) return `No sessions ${period.toLowerCase()}. Upload your trades to get coaching.`
    const parts: string[] = []
    if (s.pnl >= 0) parts.push(`You\u2019re in the green with ${fmtPnl(s.pnl)}.`)
    else parts.push(`${period} is showing ${fmtPnl(s.pnl)}.`)
    if (s.wr >= 50) parts.push(`Win rate at ${s.wr}% shows solid execution.`)
    else parts.push(`Win rate at ${s.wr}% — focus on quality setups over quantity.`)
    if (s.avgDqs >= 60) parts.push(`Discipline score of ${s.avgDqs} is encouraging.`)
    else parts.push(`Discipline score of ${s.avgDqs} needs attention.`)
    if (s.topMistakes.length > 0) parts.push(`Top pattern to fix: ${s.topMistakes[0][0]} (${s.topMistakes[0][1]} times).`)
    return parts.join(' ')
  }

  const dqsColor = stats.avgDqs >= 70 ? 'var(--green)' : stats.avgDqs >= 50 ? 'var(--gold)' : stats.avgDqs >= 30 ? 'var(--orange)' : 'var(--red)'

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28 }}>AI Coach</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Personalized psychology coaching based on your trading data</div>
          </div>
          <span className="badge badge-free" style={{ background: 'rgba(157,122,247,.1)', color: 'var(--purple)' }}>PRO</span>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--s2)', borderRadius: 'var(--radius-sm)', padding: 3, width: 'fit-content' }}>
          {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 16px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? 'var(--bg)' : 'var(--muted)',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {/* Stats Overview */}
        <div className="kpi-strip" style={{ marginBottom: 14 }}>
          <div className="kpi-item">
            <div className="kpi-label">{current.label} P&amp;L</div>
            <div className="kpi-val" style={{ color: stats.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(stats.pnl)}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Sessions</div>
            <div className="kpi-val">{stats.sessionCount}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Win Rate</div>
            <div className="kpi-val">{stats.wr}%</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Avg DQS</div>
            <div className="kpi-val" style={{ color: dqsColor }}>{stats.avgDqs}</div>
          </div>
        </div>

        {/* Coach Message */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">🎯 {current.label} Coaching</div>
          <div className="card-body">
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8 }}>
              {getCoachMessage(stats, current.label)}
            </div>
          </div>
        </div>

        {/* AI-Generated Coaching Plan */}
        {aiLoading && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Generating your {tab} coaching plan...</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>AI is analysing your patterns and creating personalized recommendations</div>
            </div>
          </div>
        )}

        {aiPlan && !aiLoading && aiPlan.sections?.map((section: { title: string; subtitle?: string; icon?: string; items?: { tag: string; text: string }[]; content?: string; scenarios?: { type: string; text: string }[]; zones?: { name: string; color: string; criteria: string }[]; current?: string }, si: number) => (
          <div key={si} className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">{section.title}</div>
            {section.subtitle && <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 16px 8px' }}>{section.subtitle}</div>}
            <div className="card-body">
              {/* Action items */}
              {section.items && section.items.map((item: { tag: string; text: string }, ii: number) => {
                const tagColors: Record<string, { bg: string; color: string }> = {
                  STOP: { bg: 'rgba(240,93,108,.1)', color: 'var(--red)' },
                  DO: { bg: 'rgba(54,211,153,.1)', color: 'var(--green)' },
                  PRACTICE: { bg: 'rgba(91,141,239,.1)', color: 'var(--blue)' },
                }
                const tc = tagColors[item.tag] || tagColors.DO
                return (
                  <div key={ii} className="action-item" style={{ borderLeft: `3px solid ${tc.color}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: tc.bg, color: tc.color, flexShrink: 0 }}>{item.tag}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.7 }}>{item.text}</span>
                  </div>
                )
              })}

              {/* Text content (rules, plans) */}
              {section.content && (
                <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.9, color: 'var(--text2)', whiteSpace: 'pre-line' }}>
                  {section.content}
                </div>
              )}

              {/* Scenarios */}
              {section.scenarios && section.scenarios.map((sc: { type: string; text: string }, sci: number) => {
                const scColors: Record<string, string> = { best: 'var(--green)', likely: 'var(--gold)', worst: 'var(--red)' }
                return (
                  <div key={sci} className="action-item" style={{ borderLeft: `3px solid ${scColors[sc.type] || 'var(--muted)'}` }}>
                    <strong style={{ color: scColors[sc.type], textTransform: 'uppercase' }}>{sc.type} CASE:</strong> {sc.text}
                  </div>
                )
              })}

              {/* Performance Zones */}
              {section.zones && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12, marginBottom: 8 }}>
                    {section.zones.map((z: { name: string; color: string; criteria: string }, zi: number) => {
                      const zColors: Record<string, string> = { red: 'rgba(240,93,108,.08)', gold: 'rgba(245,166,35,.08)', green: 'rgba(16,185,129,.08)' }
                      const zBorders: Record<string, string> = { red: 'rgba(240,93,108,.2)', gold: 'rgba(245,166,35,.2)', green: 'rgba(16,185,129,.2)' }
                      return (
                        <div key={zi} style={{ background: zColors[z.color] || 'var(--s2)', border: `1px solid ${zBorders[z.color] || 'var(--border)'}`, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                          <div style={{ color: `var(--${z.color})`, fontWeight: 700, fontSize: 14 }}>{z.name}</div>
                          <div style={{ color: 'var(--muted2)', marginTop: 4, whiteSpace: 'pre-line' }}>{z.criteria}</div>
                        </div>
                      )
                    })}
                  </div>
                  {section.current && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                      You are currently in the <strong style={{ color: `var(--${section.current === 'RED' ? 'red' : section.current === 'YELLOW' ? 'gold' : 'green'})` }}>{section.current} ZONE</strong>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* Top Behavioral Patterns */}
        {stats.topMistakes.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Behavioral Patterns to Fix</div>
            <div className="card-body">
              {stats.topMistakes.map(([tag, count], i) => (
                <div key={tag} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderBottom: i < stats.topMistakes.length - 1 ? '1px solid var(--border)' : 'none'
                }}>
                  <span style={{ fontSize: 20 }}>{i === 0 ? '🔴' : i === 1 ? '🟡' : '🟠'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tag}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Detected {count} times {current.label.toLowerCase()}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>#{i + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable Rules */}
        {stats.rules.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Action Items</div>
            <div className="card-body">
              {stats.rules.map((rule, i) => (
                <div key={i} className="action-item" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <strong style={{ color: 'var(--accent)' }}>Rule {i + 1}:</strong> {rule}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discipline Trend */}
        {current.sessions.length > 1 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Discipline Trend</div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 8 }}>
                {current.sessions.slice(0, 14).reverse().map((s, i) => {
                  const dqs = s.dqs_score || 0
                  const h = Math.max(4, (dqs / 100) * 56)
                  const c = dqs >= 60 ? 'var(--green)' : dqs >= 40 ? 'var(--gold)' : 'var(--red)'
                  return <div key={i} style={{ flex: 1, height: h, background: c, borderRadius: 2, opacity: 0.7 }} title={`DQS: ${dqs}`} />
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                DQS trend across {Math.min(current.sessions.length, 14)} sessions
              </div>
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/pricing" className="btn btn-ghost">View Pricing Plans &rarr;</Link>
        </div>
      </div>
    </section>
  )
}
