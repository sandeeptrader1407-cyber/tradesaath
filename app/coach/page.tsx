'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePlan } from '@/lib/planStore'

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

type CoachTab = 'tomorrow' | 'thisweek' | 'learning_path' | 'patterns' | 'monthly_goals'

const TAB_CONFIG: { key: CoachTab; label: string; icon: string }[] = [
  { key: 'tomorrow', label: "Tomorrow's Plan", icon: '📋' },
  { key: 'thisweek', label: 'This Week', icon: '📅' },
  { key: 'learning_path', label: 'Learning Path', icon: '🧠' },
  { key: 'patterns', label: 'My Patterns', icon: '🔍' },
  { key: 'monthly_goals', label: 'Monthly Goals', icon: '🎯' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AiPlan { title: string; subtitle: string; sections: any[] }

export default function CoachPage() {
  const { isPro, loading: planLoading, plan } = usePlan()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CoachTab>('tomorrow')
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCache, setAiCache] = useState<Record<string, AiPlan>>({})
  const [rulesChecked, setRulesChecked] = useState<Record<string, boolean>>({})

  // Load persisted rule check state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tradesaath_coach_rules_checked')
      if (saved) setRulesChecked(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  function toggleRule(rule: string) {
    setRulesChecked(prev => {
      const next = { ...prev, [rule]: !prev[rule] }
      try { localStorage.setItem('tradesaath_coach_rules_checked', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false) })
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

  if (loading || planLoading) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap"><div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading coach...</div></div>
      </section>
    )
  }

  // Coach is Pro-only
  if (!isPro) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, marginBottom: 8 }}>Saathi</h2>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 8 }}>
              {plan === 'single'
                ? 'Your Single Report plan gives you full trade analysis. Upgrade to Pro for personalized AI coaching with pattern detection, learning paths, and data-driven improvement plans.'
                : 'Saathi is a Pro feature. Get personalized coaching plans, pattern analysis, learning paths, and monthly goals based on your actual trading data.'}
            </p>
            <div style={{
              padding: '10px 16px', marginBottom: 20, borderRadius: 8, display: 'inline-block',
              background: 'rgba(240,180,41,.08)', border: '1px solid rgba(240,180,41,.25)',
              fontSize: 12, color: 'var(--gold)',
            }}>
              Current plan: <strong>{plan === 'single' ? 'Single Report' : 'Free'}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/pricing" className="btn btn-accent">Upgrade to Pro — ₹799/mo</Link>
              <Link href="/upload" className="btn btn-ghost">Upload Trades</Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (sessions.length === 0) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, marginBottom: 8 }}>Saathi</h2>
          <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20 }}>
            Upload your first trading session to unlock personalized AI coaching — pattern detection, learning paths, and data-driven improvement plans.
          </p>
          <Link href="/upload" className="btn btn-accent">Upload Trades &rarr;</Link>
        </div>
      </section>
    )
  }

  // Aggregate stats for memory indicator
  const totalTrades = sessions.reduce((s, x) => s + (x.trade_count || 0), 0)
  const totalPnl = sessions.reduce((s, x) => s + (x.total_pnl || 0), 0)
  const avgWr = sessions.length > 0 ? Math.round(sessions.reduce((s, x) => s + (x.win_rate || 0), 0) / sessions.length) : 0
  const avgDqs = sessions.length > 0 ? Math.round(sessions.reduce((s, x) => s + (x.dqs_score || 0), 0) / sessions.length) : 0
  const dqsColor = avgDqs >= 70 ? 'var(--green)' : avgDqs >= 50 ? 'var(--gold)' : avgDqs >= 30 ? 'var(--orange)' : 'var(--red)'

  const activeTabConfig = TAB_CONFIG.find(t => t.key === tab)

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28 }}>Saathi</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Your personal trading psychology coach</div>
          </div>
          <span className="badge badge-free" style={{ background: 'rgba(157,122,247,.1)', color: 'var(--purple)' }}>PRO</span>
        </div>

        {/* Memory Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', marginBottom: 16,
          background: 'rgba(16,185,129,.04)', border: '1px solid rgba(16,185,129,.12)', borderRadius: 8,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0,
            boxShadow: '0 0 6px rgba(16,185,129,.5)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Reviewed{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 600 }}>{sessions.length}</span>
            {' '}sessions{' \u00B7 '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', fontWeight: 600 }}>{totalTrades}</span>
            {' '}trades{' \u00B7 '}
            Net{' '}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{fmtPnl(totalPnl)}</span>
            {' \u2014 your actual data'}
          </span>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

        {/* KPI Strip */}
        <div className="kpi-strip" style={{ marginBottom: 16 }}>
          <div className="kpi-item">
            <div className="kpi-label">Sessions</div>
            <div className="kpi-val">{sessions.length}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Total Trades</div>
            <div className="kpi-val">{totalTrades}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Avg Win Rate</div>
            <div className="kpi-val">{avgWr}%</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Avg DQS</div>
            <div className="kpi-val" style={{ color: dqsColor }}>{avgDqs}</div>
          </div>
        </div>

        {/* Tab Switcher — scrollable on mobile */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--s2)', borderRadius: 'var(--radius-sm)', padding: 3, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TAB_CONFIG.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? 'var(--bg)' : 'var(--muted)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* AI Loading State */}
        {aiLoading && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{activeTabConfig?.icon || '🎯'}</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                Generating {activeTabConfig?.label || 'coaching plan'}...
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Saathi is analysing your {sessions.length} sessions and {totalTrades} trades
              </div>
            </div>
          </div>
        )}

        {/* AI Plan Sections */}
        {aiPlan && !aiLoading && (
          <>
            {/* Plan Title */}
            {aiPlan.title && (
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 2 }}>{aiPlan.title}</h3>
                {aiPlan.subtitle && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{aiPlan.subtitle}</div>}
              </div>
            )}

            {aiPlan.sections?.map((section: { title: string; subtitle?: string; icon?: string; items?: { tag: string; text: string }[]; content?: string; scenarios?: { type: string; text: string }[]; zones?: { name: string; color: string; criteria: string }[]; current?: string }, si: number) => (
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
                      <div key={ii} style={{
                        borderLeft: `3px solid ${tc.color}`, display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '10px 14px', marginBottom: ii < (section.items?.length || 0) - 1 ? 0 : 0,
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: tc.bg, color: tc.color, flexShrink: 0 }}>{item.tag}</span>
                        <span style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text2)' }}>{item.text}</span>
                      </div>
                    )
                  })}

                  {/* Text content */}
                  {section.content && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.9, color: 'var(--text2)', whiteSpace: 'pre-line' }}>
                      {section.content}
                    </div>
                  )}

                  {/* Scenarios */}
                  {section.scenarios && section.scenarios.map((sc: { type: string; text: string }, sci: number) => {
                    const scColors: Record<string, string> = { best: 'var(--green)', likely: 'var(--gold)', worst: 'var(--red)' }
                    return (
                      <div key={sci} style={{ borderLeft: `3px solid ${scColors[sc.type] || 'var(--muted)'}`, padding: '10px 14px' }}>
                        <strong style={{ color: scColors[sc.type], textTransform: 'uppercase', fontSize: 11 }}>{sc.type} CASE:</strong>
                        <span style={{ fontSize: 13, marginLeft: 8, color: 'var(--text2)' }}>{sc.text}</span>
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
                              <div style={{ color: 'var(--muted2)', marginTop: 4, whiteSpace: 'pre-line', fontSize: 11 }}>{z.criteria}</div>
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
          </>
        )}

        {/* Personal Rules — monospace card with persistent checkboxes */}
        {(() => {
          const DEFAULT_RULES = [
            'MAX 10 TRADES PER DAY',
            'NO REVENGE TRADES',
            'STOP AT 10:30 AM IF -2R',
            'ONE SETUP AT A TIME',
            'NO ENTRIES AFTER 14:30',
          ]
          const seen = new Set<string>()
          const merged = [...DEFAULT_RULES].filter(r => {
            if (seen.has(r)) return false
            seen.add(r); return true
          }).slice(0, 8)

          if (merged.length === 0) return null
          const completed = merged.filter(r => rulesChecked[r]).length

          return (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Personal Rules</span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)' }}>
                  {completed}/{merged.length} FOLLOWED
                </span>
              </div>
              <div className="card-body">
                <div style={{
                  background: '#0a0a0a',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {merged.map((rule, i) => {
                    const checked = !!rulesChecked[rule]
                    return (
                      <div key={rule} onClick={() => toggleRule(rule)} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 4px',
                        borderBottom: i < merged.length - 1 ? '1px dashed rgba(255,255,255,.06)' : 'none',
                        cursor: 'pointer',
                        opacity: checked ? 0.55 : 1,
                      }}>
                        <span style={{
                          width: 16, height: 16, flexShrink: 0,
                          border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--muted)'}`,
                          borderRadius: 3,
                          background: checked ? 'var(--accent)' : 'transparent',
                          color: 'var(--bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 900,
                        }}>{checked ? '\u2713' : ''}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: checked ? 'var(--muted)' : 'var(--text)',
                          textDecoration: checked ? 'line-through' : 'none',
                          letterSpacing: '.02em',
                        }}>{rule}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
                  Tap to mark followed. State persists across sessions.
                </div>
              </div>
            </div>
          )
        })()}

        {/* Discipline Trend */}
        {sessions.length > 1 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Discipline Trend</div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 8 }}>
                {sessions.slice(0, 14).reverse().map((s, i) => {
                  const dqs = s.dqs_score || 0
                  const h = Math.max(4, (dqs / 100) * 56)
                  const c = dqs >= 60 ? 'var(--green)' : dqs >= 40 ? 'var(--gold)' : 'var(--red)'
                  return <div key={i} style={{ flex: 1, height: h, background: c, borderRadius: 2, opacity: 0.7 }} title={`DQS: ${dqs}`} />
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                DQS trend across {Math.min(sessions.length, 14)} sessions
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/pricing" className="btn btn-ghost">View Pricing Plans &rarr;</Link>
        </div>
      </div>
    </section>
  )
}
