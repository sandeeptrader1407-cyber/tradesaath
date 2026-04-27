'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePlan } from '@/lib/planStore'
import { computeKPIs } from '@/lib/kpi/computeKPIs'

interface Session {
  id: string
  created_at: string
  total_pnl: number
  trade_count: number
  win_count: number
  loss_count: number
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

// Reduced to 3 tabs — remove This Week and Monthly Goals
type CoachTab = 'tomorrow' | 'patterns' | 'learning_path'

const TAB_CONFIG: { key: CoachTab; label: string }[] = [
  { key: 'tomorrow',      label: 'Next Session' },
  { key: 'patterns',      label: 'My Patterns' },
  { key: 'learning_path', label: 'Learning Path' },
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

  useEffect(() => {
    if (sessions.length === 0 || loading) return
    if (aiCache[tab]) { setAiPlan(aiCache[tab]); return }
    setAiLoading(true)
    fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tab }) })
      .then(r => r.json())
      .then(data => {
        if (data.plan) { setAiPlan(data.plan); setAiCache(prev => ({ ...prev, [tab]: data.plan })) }
        setAiLoading(false)
      })
      .catch(() => setAiLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sessions.length, loading])

  if (loading || planLoading) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap"><div style={{ color: 'var(--muted)', fontSize: 14, fontFamily: 'var(--font-sans)' }}>Loading coach...</div></div>
      </section>
    )
  }

  if (!isPro) {
    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <h2 style={{ fontFamily: "var(--font-display, 'DM Serif Display', serif)", fontSize: 24, fontWeight: 400, marginBottom: 8 }}>Saathi</h2>
            <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 8, fontFamily: 'var(--font-sans)' }}>
              {plan === 'single'
                ? 'Your Single Report plan gives you full trade analysis. Upgrade to Pro for personalized AI coaching with pattern detection, learning paths, and data-driven improvement plans.'
                : 'Saathi is a Pro feature. Get personalized coaching plans, pattern analysis, learning paths, and monthly goals based on your actual trading data.'}
            </p>
            <div style={{ padding: '10px 16px', marginBottom: 20, borderRadius: 8, display: 'inline-block', background: 'rgba(240,180,41,.08)', border: '1px solid rgba(240,180,41,.25)', fontSize: 12, color: 'var(--gold)', fontFamily: 'var(--font-sans)' }}>
              Current plan: <strong>{plan === 'single' ? 'Single Report' : 'Free'}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/pricing" className="btn btn-accent">Upgrade to Pro: ₹799/mo</Link>
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
          <h2 style={{ fontFamily: "var(--font-display, 'DM Serif Display', serif)", fontSize: 24, fontWeight: 400, marginBottom: 8 }}>Saathi</h2>
          <p style={{ fontSize: 13, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
            Upload your first trading session to unlock personalized AI coaching: pattern detection, learning paths, and data-driven improvement plans.
          </p>
          <Link href="/upload" className="btn btn-accent">Upload Trades &rarr;</Link>
        </div>
      </section>
    )
  }

  const kpiSessions = sessions.map(s => ({ net_pnl: s.total_pnl, trade_count: s.trade_count, win_count: s.win_count, loss_count: s.loss_count, win_rate: s.win_rate, dqs_score: s.dqs_score }))
  const kpis = computeKPIs(kpiSessions)
  const totalTrades = kpis.totalTrades

  const activeTabConfig = TAB_CONFIG.find(t => t.key === tab)

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display, 'DM Serif Display', serif)", fontSize: 28, fontWeight: 400, margin: 0 }}>Saathi</h2>
            <div style={{ fontSize: 14, color: 'var(--muted)', fontFamily: 'var(--font-sans)', marginTop: 4 }}>Your trading companion. Always on. Always learning.</div>
          </div>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--color-ink)', color: 'var(--color-canvas)', fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>PRO</span>
        </div>

        {/* Context bar — session + trade count only, no P&L (currency-neutral) */}
        <div style={{ background: 'var(--color-canvas, #F8F6F1)', borderRadius: 8, padding: '10px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-muted, #888780)' }}>
            Reviewed{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{sessions.length}</span>
            {' sessions · '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{totalTrades.toLocaleString()}</span>
            {' trades. Your actual data.'}
          </span>
        </div>

        {/* Tab switcher — 3 tabs, clean style */}
        <style>{`
          @media(max-width:768px){
            .coach-tabs{gap:4px!important}
            .coach-tab-btn{flex:1!important;padding:0 10px!important;font-size:13px!important}
          }
          @media(max-width:390px){
            .coach-tab-btn{font-size:12px!important;padding:0 8px!important}
          }
        `}</style>
        <div className="coach-tabs" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {TAB_CONFIG.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="coach-tab-btn" style={{
              height: 36, padding: '0 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
              background: tab === t.key ? 'var(--color-ink, #1A1F2E)' : 'transparent',
              color: tab === t.key ? 'var(--color-canvas, #F8F6F1)' : 'var(--muted)',
              transition: 'all 0.1s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* AI Loading */}
        {aiLoading && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 13, color: 'var(--color-ink)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Preparing your session plan...
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                Saathi is analysing your <span style={{ fontFamily: 'var(--font-mono)' }}>{sessions.length}</span> sessions and <span style={{ fontFamily: 'var(--font-mono)' }}>{totalTrades.toLocaleString()}</span> trades
              </div>
            </div>
          </div>
        )}

        {/* AI Plan */}
        {aiPlan && !aiLoading && (
          <>
            {aiPlan.title && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: "var(--font-display, 'DM Serif Display', serif)", fontSize: 20, fontWeight: 400, marginBottom: 2 }}>{aiPlan.title}</h3>
                  {aiPlan.subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-sans)' }}>{aiPlan.subtitle}</div>}
                </div>
                {/* Print button — only on Tomorrow's Plan */}
                {tab === 'tomorrow' && (
                  <button
                    onClick={() => window.print()}
                    style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer', flexShrink: 0, fontWeight: 400 }}
                  >
                    Print plan
                  </button>
                )}
              </div>
            )}

            {aiPlan.sections?.map((section: { title: string; subtitle?: string; icon?: string; items?: { tag: string; text: string }[]; content?: string; scenarios?: { type: string; text: string }[]; zones?: { name: string; color: string; criteria: string }[]; current?: string }, si: number) => (
              <div key={si} className="card" style={{ marginBottom: 14 }}>
                <div className="card-head">{section.title}</div>
                {section.subtitle && <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 16px 8px', fontFamily: 'var(--font-sans)' }}>{section.subtitle}</div>}
                <div className="card-body">
                  {section.items && section.items.map((item: { tag: string; text: string }, ii: number) => {
                    const tagColors: Record<string, { bg: string; color: string }> = {
                      STOP: { bg: 'rgba(240,93,108,.1)', color: 'var(--red)' },
                      DO: { bg: 'rgba(54,211,153,.1)', color: 'var(--green)' },
                      PRACTICE: { bg: 'rgba(91,141,239,.1)', color: 'var(--blue)' },
                    }
                    const tc = tagColors[item.tag] || tagColors.DO
                    return (
                      <div key={ii} style={{ borderLeft: `3px solid ${tc.color}`, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: tc.bg, color: tc.color, flexShrink: 0, minWidth: 80, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>{item.tag}</span>
                        <span style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text2)', fontFamily: 'var(--font-sans)' }}>{item.text}</span>
                      </div>
                    )
                  })}
                  {section.content && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.9, color: 'var(--text2)', whiteSpace: 'pre-line', fontFamily: 'var(--font-sans)' }}>
                      {section.content}
                    </div>
                  )}
                  {section.scenarios && section.scenarios.map((sc: { type: string; text: string }, sci: number) => {
                    const scColors: Record<string, string> = { best: 'var(--green)', likely: 'var(--gold)', worst: 'var(--red)' }
                    return (
                      <div key={sci} style={{ borderLeft: `3px solid ${scColors[sc.type] || 'var(--muted)'}`, padding: '10px 14px' }}>
                        <strong style={{ color: scColors[sc.type], textTransform: 'uppercase', fontSize: 11, fontFamily: 'var(--font-sans)' }}>{sc.type} CASE:</strong>
                        <span style={{ fontSize: 13, marginLeft: 8, color: 'var(--text2)', fontFamily: 'var(--font-sans)' }}>{sc.text}</span>
                      </div>
                    )
                  })}
                  {section.zones && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ fontSize: 12, marginBottom: 8 }}>
                        {section.zones.map((z: { name: string; color: string; criteria: string }, zi: number) => {
                          const zColors: Record<string, string> = { red: 'rgba(240,93,108,.08)', gold: 'rgba(245,166,35,.08)', green: 'rgba(16,185,129,.08)' }
                          const zBorders: Record<string, string> = { red: 'rgba(240,93,108,.2)', gold: 'rgba(245,166,35,.2)', green: 'rgba(16,185,129,.2)' }
                          return (
                            <div key={zi} style={{ background: zColors[z.color] || 'var(--s2)', border: `1px solid ${zBorders[z.color] || 'var(--border)'}`, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                              <div style={{ color: `var(--${z.color})`, fontWeight: 500, fontSize: 14, fontFamily: 'var(--font-sans)' }}>{z.name}</div>
                              <div style={{ color: 'var(--muted2)', marginTop: 4, whiteSpace: 'pre-line', fontSize: 11, fontFamily: 'var(--font-sans)' }}>{z.criteria}</div>
                            </div>
                          )
                        })}
                      </div>
                      {section.current && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
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

        {/* Personal Rules */}
        {(() => {
          const DEFAULT_RULES = ['MAX 10 TRADES PER DAY', 'NO REVENGE TRADES', 'STOP AT 10:30 AM IF -2R', 'ONE SETUP AT A TIME', 'NO ENTRIES AFTER 14:30']
          const aiRules: string[] = []
          for (const s of sessions) {
            const a = s.analysis
            if (!a) continue
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const points = (a as any).coaching_points || (a as any).rules_for_next_session || (a as any).rulesForNextSession
            if (Array.isArray(points)) {
              for (const p of points) {
                const text = typeof p === 'string' ? p : (p?.text || p?.rule || '')
                if (text && typeof text === 'string') aiRules.push(text.toUpperCase().trim())
              }
            }
          }
          const seen = new Set<string>()
          const merged = [...aiRules, ...DEFAULT_RULES].filter(r => { if (seen.has(r)) return false; seen.add(r); return true }).slice(0, 8)
          if (merged.length === 0) return null
          const completed = merged.filter(r => rulesChecked[r]).length
          return (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-sans)' }}>Your Rules</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontWeight: 400 }}>{completed}/{merged.length} followed</span>
              </div>
              <div className="card-body">
                <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, padding: 16, fontFamily: 'var(--font-mono)' }}>
                  {merged.map((rule, i) => {
                    const checked = !!rulesChecked[rule]
                    return (
                      <div key={rule} role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggleRule(rule) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRule(rule) } }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', minHeight: 56, borderBottom: i < merged.length - 1 ? '1px dashed rgba(0,0,0,.08)' : 'none', cursor: 'pointer', opacity: checked ? 0.55 : 1, userSelect: 'none' }}>
                        <span style={{ width: 16, height: 16, flexShrink: 0, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--muted)'}`, borderRadius: 3, background: checked ? 'var(--accent)' : 'transparent', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          {checked ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 400, color: checked ? 'var(--muted)' : 'var(--text)', textDecoration: checked ? 'line-through' : 'none', letterSpacing: '.02em' }}>{rule}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                  Tap to mark followed. State persists across sessions.
                </div>
              </div>
            </div>
          )
        })()}

        {/* Discipline Trend */}
        {sessions.length > 1 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head" style={{ fontFamily: 'var(--font-sans)' }}>Discipline Trend</div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 8 }}>
                {sessions.slice(0, 14).reverse().map((s, i) => {
                  const dqs = s.dqs_score || 0
                  const h = Math.max(4, (dqs / 100) * 56)
                  const c = dqs >= 60 ? 'var(--green)' : dqs >= 40 ? 'var(--gold)' : 'var(--red)'
                  return <div key={i} style={{ flex: 1, height: h, background: c, borderRadius: 2, opacity: 0.7 }} title={`DQS: ${dqs}`} />
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                DQS trend across <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.min(sessions.length, 14)}</span> sessions
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
