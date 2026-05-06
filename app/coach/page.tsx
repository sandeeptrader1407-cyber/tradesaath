'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { usePlan, usePlanStore } from '@/lib/planStore'
import { useRazorpay } from '@/hooks/useRazorpay'
import { showToast } from '@/components/ui/Toast'
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
  const { pay, loading: payLoading } = useRazorpay()
  const setPlan = usePlanStore((s) => s.setPlan)
  const { user } = useUser()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CoachTab>('tomorrow')
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCache, setAiCache] = useState<Record<string, AiPlan>>({})
  const [rulesChecked, setRulesChecked] = useState<Record<string, boolean>>({})

  // H1: direct-to-Razorpay upgrade for the !isPro coaching gate. Same
  // pattern used in app/dashboard/page.tsx + components/results/TradeDetail.tsx.
  // Skips the /pricing detour that previously cost ~30-50% conversion.
  const openCheckout = useCallback(() => {
    if (payLoading) return
    pay({
      plan: 'pro_monthly',
      email: user?.primaryEmailAddress?.emailAddress,
      onSuccess: () => {
        setPlan('pro_monthly')
        showToast.success('Welcome to Pro! Your coaching is unlocked.')
      },
      onError: (err) => showToast.error(err || 'Payment failed.'),
    })
  }, [pay, payLoading, setPlan, user])

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
        <div className="wrap">
          <div style={{ color: '#94A3B8', fontSize: 14, fontFamily: 'var(--font-sans)' }}>Loading coach...</div>
        </div>
      </section>
    )
  }

  if (!isPro) {
    return (
      <section style={{ paddingTop: 96, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: 48, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: '#0F172A', marginBottom: 8, letterSpacing: '-0.02em' }}>Saathi</h2>
            <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: 16, fontFamily: 'var(--font-sans)' }}>
              {plan === 'single'
                ? 'Your Single Report plan gives you full trade analysis. Upgrade to Pro for personalized AI coaching with pattern detection, learning paths, and data-driven improvement plans.'
                : 'Saathi is a Pro feature. Get personalized coaching plans, pattern analysis, learning paths, and monthly goals based on your actual trading data.'}
            </p>
            <div style={{ padding: '10px 16px', marginBottom: 20, borderRadius: 8, display: 'inline-block', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#F59E0B', fontFamily: 'var(--font-sans)' }}>
              Current plan: <strong>{plan === 'single' ? 'Single Report' : 'Free'}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={openCheckout}
                disabled={payLoading}
                style={{
                  background: '#F59E0B',
                  color: '#0F172A',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  border: 'none',
                  cursor: payLoading ? 'wait' : 'pointer',
                  opacity: payLoading ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {payLoading ? 'Opening payment…' : 'Upgrade to Pro: ₹799/mo'}
              </button>
              <Link href="/upload" className="btn btn-ghost">Upload Trades</Link>
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href="/pricing" style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: '#94A3B8', textDecoration: 'none' }}>
                View all plans &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (sessions.length === 0) {
    return (
      <section style={{ paddingTop: 96, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 600, textAlign: 'center' }}>
          <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: 48 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: '#0F172A', marginBottom: 8, letterSpacing: '-0.02em' }}>Saathi</h2>
            <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: 20, fontFamily: 'var(--font-sans)' }}>
              Upload your first trading session to unlock personalized AI coaching: pattern detection, learning paths, and data-driven improvement plans.
            </p>
            <Link href="/upload" style={{ background: '#F59E0B', color: '#0F172A', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Upload Trades &rarr;</Link>
          </div>
        </div>
      </section>
    )
  }

  const kpiSessions = sessions.map(s => ({ net_pnl: s.total_pnl, trade_count: s.trade_count, win_count: s.win_count, loss_count: s.loss_count, win_rate: s.win_rate, dqs_score: s.dqs_score }))
  const kpis = computeKPIs(kpiSessions)
  const totalTrades = kpis.totalTrades

  return (
    <section style={{ paddingTop: 96, paddingBottom: 60 }}>
      <div className="wrap" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>Saathi</h2>
            <div style={{ fontSize: 14, color: '#64748B', fontFamily: 'var(--font-sans)', marginTop: 4 }}>Your trading companion. Always on. Always learning.</div>
          </div>
          <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, background: '#080C14', color: '#F59E0B', fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>PRO</span>
        </div>

        {/* Context bar */}
        <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: '#64748B' }}>
            Reviewed{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#0F172A' }}>{sessions.length}</span>
            {' sessions · '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: '#0F172A' }}>{totalTrades.toLocaleString()}</span>
            {' trades. Your actual data.'}
          </span>
        </div>

        {/* Tab switcher */}
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
              height: 36, padding: '0 16px', borderRadius: 7, cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: tab === t.key ? 500 : 400,
              background: tab === t.key ? '#0F172A' : 'transparent',
              color: tab === t.key ? '#F8FAFC' : '#94A3B8',
              border: tab === t.key ? 'none' : '0.5px solid #E2E8F0',
              transition: 'all 0.1s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* AI Loading */}
        {aiLoading && (
          <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                Preparing your session plan...
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                Saathi is analysing your{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{sessions.length}</span>
                {' '}sessions and{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{totalTrades.toLocaleString()}</span>
                {' '}trades
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
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, marginBottom: 2, color: '#0F172A' }}>{aiPlan.title}</h3>
                  {aiPlan.subtitle && <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'var(--font-sans)' }}>{aiPlan.subtitle}</div>}
                </div>
                {tab === 'tomorrow' && (
                  <button
                    onClick={() => window.print()}
                    style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '0.5px solid #E2E8F0', background: 'transparent', color: '#94A3B8', fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer', flexShrink: 0, fontWeight: 400 }}
                  >
                    Print plan
                  </button>
                )}
              </div>
            )}

            {aiPlan.sections?.map((section: { title: string; subtitle?: string; icon?: string; items?: { tag: string; text: string }[]; content?: string; scenarios?: { type: string; text: string }[]; zones?: { name: string; color: string; criteria: string }[]; current?: string }, si: number) => (
              <div key={si} style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8F0', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#0F172A', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{section.title}</div>
                {section.subtitle && <div style={{ fontSize: 11, color: '#94A3B8', padding: '0 16px 8px', fontFamily: 'var(--font-sans)' }}>{section.subtitle}</div>}
                <div style={{ padding: '8px 0' }}>
                  {section.items && section.items.map((item: { tag: string; text: string }, ii: number) => {
                    const tagColors: Record<string, { bg: string; color: string }> = {
                      STOP:     { bg: 'rgba(220,38,38,0.08)',  color: '#DC2626' },
                      DO:       { bg: 'rgba(16,185,129,0.08)', color: '#10B981' },
                      PRACTICE: { bg: 'rgba(55,138,221,0.08)', color: '#378ADD' },
                    }
                    const tc = tagColors[item.tag] || tagColors.DO
                    return (
                      <div key={ii} style={{ borderLeft: `3px solid ${tc.color}`, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: tc.bg, color: tc.color, flexShrink: 0, minWidth: 80, textAlign: 'center' as const, fontFamily: 'var(--font-sans)' }}>{item.tag}</span>
                        <span style={{ fontSize: 13, lineHeight: 1.7, color: '#374151', fontFamily: 'var(--font-sans)' }}>{item.text}</span>
                      </div>
                    )
                  })}
                  {section.content && (
                    <div style={{ margin: '0 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.9, color: '#374151', whiteSpace: 'pre-line' as const, fontFamily: 'var(--font-sans)' }}>
                      {section.content}
                    </div>
                  )}
                  {section.scenarios && section.scenarios.map((sc: { type: string; text: string }, sci: number) => {
                    const scColors: Record<string, string> = { best: '#10B981', likely: '#F59E0B', worst: '#DC2626' }
                    return (
                      <div key={sci} style={{ borderLeft: `3px solid ${scColors[sc.type] || '#94A3B8'}`, padding: '10px 14px' }}>
                        <strong style={{ color: scColors[sc.type], textTransform: 'uppercase' as const, fontSize: 11, fontFamily: 'var(--font-sans)' }}>{sc.type} CASE:</strong>
                        <span style={{ fontSize: 13, marginLeft: 8, color: '#374151', fontFamily: 'var(--font-sans)' }}>{sc.text}</span>
                      </div>
                    )
                  })}
                  {section.zones && (
                    <div style={{ padding: '0 16px 8px' }}>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ fontSize: 12, marginBottom: 8 }}>
                        {section.zones.map((z: { name: string; color: string; criteria: string }, zi: number) => {
                          const zBgs:    Record<string, string> = { red: 'rgba(220,38,38,0.06)',    gold: 'rgba(245,158,11,0.06)',  green: 'rgba(16,185,129,0.06)' }
                          const zBorders:Record<string, string> = { red: 'rgba(220,38,38,0.2)',     gold: 'rgba(245,158,11,0.2)',   green: 'rgba(16,185,129,0.2)'  }
                          const zText:   Record<string, string> = { red: '#DC2626',                 gold: '#F59E0B',                green: '#10B981'               }
                          return (
                            <div key={zi} style={{ background: zBgs[z.color] || '#F8FAFC', border: `1px solid ${zBorders[z.color] || '#E2E8F0'}`, borderRadius: 8, padding: 12, textAlign: 'center' as const }}>
                              <div style={{ color: zText[z.color] || '#94A3B8', fontWeight: 500, fontSize: 14, fontFamily: 'var(--font-sans)' }}>{z.name}</div>
                              <div style={{ color: '#64748B', marginTop: 4, whiteSpace: 'pre-line' as const, fontSize: 11, fontFamily: 'var(--font-sans)' }}>{z.criteria}</div>
                            </div>
                          )
                        })}
                      </div>
                      {section.current && (
                        <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' as const, fontFamily: 'var(--font-sans)' }}>
                          You are currently in the{' '}
                          <strong style={{ color: section.current === 'RED' ? '#DC2626' : section.current === 'YELLOW' ? '#F59E0B' : '#10B981' }}>
                            {section.current} ZONE
                          </strong>
                        </div>
                      )}
                    </div>
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
            <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, marginBottom: 14 }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#0F172A', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                <span>Your Rules</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#94A3B8', fontWeight: 400 }}>{completed}/{merged.length} followed</span>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: 16, fontFamily: 'var(--font-mono)' }}>
                  {merged.map((rule, i) => {
                    const checked = !!rulesChecked[rule]
                    return (
                      <div key={rule} role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggleRule(rule) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRule(rule) } }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', minHeight: 56, borderBottom: i < merged.length - 1 ? '1px dashed rgba(0,0,0,.08)' : 'none', cursor: 'pointer', opacity: checked ? 0.55 : 1, userSelect: 'none' as const }}>
                        <span style={{ width: 16, height: 16, flexShrink: 0, border: `1.5px solid ${checked ? '#F59E0B' : '#94A3B8'}`, borderRadius: 3, background: checked ? '#F59E0B' : 'transparent', color: '#080C14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          {checked ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 400, color: checked ? '#94A3B8' : '#0F172A', textDecoration: checked ? 'line-through' : 'none', letterSpacing: '.02em' }}>{rule}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 10, textAlign: 'center' as const, fontFamily: 'var(--font-sans)' }}>
                  Tap to mark followed. State persists across sessions.
                </div>
              </div>
            </div>
          )
        })()}

        {/* Discipline Trend */}
        {sessions.length > 1 && (
          <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8F0', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#0F172A', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Discipline Trend</div>
            <div style={{ padding: '16px 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 8 }}>
                {sessions.slice(0, 14).reverse().map((s, i) => {
                  const dqs = s.dqs_score || 0
                  const h = Math.max(4, (dqs / 100) * 56)
                  const c = dqs >= 60 ? '#10B981' : dqs >= 40 ? '#F59E0B' : '#F43F5E'
                  return <div key={i} style={{ flex: 1, height: h, background: c, borderRadius: 2, opacity: 0.7 }} title={`DQS: ${dqs}`} />
                })}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' as const, fontFamily: 'var(--font-sans)' }}>
                DQS trend across <span style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{Math.min(sessions.length, 14)}</span> sessions
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
