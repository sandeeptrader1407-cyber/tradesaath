'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRazorpay } from '@/hooks/useRazorpay'
import { useRouter } from 'next/navigation'

/* ─── Types ─── */
interface EntryExitEfficiency {
  entry_score: number; exit_score: number
  risk_reward: string; optimal_rr: string
}
interface EntryTiming {
  description: string; risk_level: string
}
interface InTradeBehavior {
  discipline: string; description: string; during_trade: string
}
interface WhatVsShould {
  what_you_did: string; what_to_do_instead: string; key_lesson: string
}
interface Trade {
  index: number; time: string; symbol: string; side: string
  qty: number; entry: number; exit: number; pnl: number; cum_pnl: number
  tag: string; label: string; session: string
  time_gap_from_last?: string; quick_summary?: string
  vicious_cycle_stage?: string
  entry_exit_efficiency?: EntryExitEfficiency
  entry_timing?: EntryTiming
  in_trade_behavior?: InTradeBehavior
  what_you_did_vs_should_have?: WhatVsShould
  psychology_coaching?: string; technical_analysis?: string
  counterfactual?: string
}
interface Momentum { name: string; score: number; color: string; desc: string }
interface CycleStage { stage: string; count: number; icon: string; desc: string }
interface TechInsight { name: string; score: number; color: string; desc: string }
interface KPIs {
  net_pnl: number; total_trades: number; wins: number; losses: number
  win_rate: number; profit_factor: number; best_trade_pnl: number; worst_trade_pnl: number
}
interface AnalysisResult {
  broker: string; market: string; trade_date: string; currency: string
  total_trades_in_file?: number; trades_shown?: number
  kpis: KPIs; summary: string; momentum: Momentum[]
  vicious_cycle: CycleStage[]; technical_insights: TechInsight[]
  trades: Trade[]
}

function fmtPnl(n: number) {
  if (n == null || isNaN(n)) return '₹0'
  return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(Math.round(n)).toLocaleString('en-IN')
}
function fmtPrice(n: number) {
  if (n == null || isNaN(n)) return '—'
  return '\u20B9' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  win: { bg: 'rgba(54,211,153,.12)', color: 'var(--green)' },
  fomo: { bg: 'rgba(240,180,41,.12)', color: 'var(--gold)' },
  revenge: { bg: 'rgba(240,93,108,.12)', color: 'var(--red)' },
  averaging: { bg: 'rgba(240,93,108,.12)', color: 'var(--red)' },
  panic: { bg: 'rgba(157,122,247,.12)', color: 'var(--purple)' },
  against_trend: { bg: 'rgba(242,155,75,.12)', color: 'var(--orange)' },
  hope_hold: { bg: 'rgba(240,93,108,.12)', color: 'var(--red)' },
  decision_fatigue: { bg: 'rgba(150,150,150,.12)', color: 'var(--muted)' },
}

const SESSION_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  morning: { bg: 'rgba(54,211,153,.15)', color: '#36d399', label: 'Morning' },
  midday: { bg: 'rgba(240,180,41,.15)', color: '#f0b429', label: 'Midday' },
  afternoon: { bg: 'rgba(157,122,247,.15)', color: '#9d7af7', label: 'Afternoon' },
}

const CYCLE_ICONS: Record<string, string> = {
  check: '✓', zap: '⚡', arrow: '↙', pray: '🙏',
  down: '📉', wind: '💨', sword: '⚔', dizzy: '😵',
}

/* ─── Half-gauge SVG ─── */
function HalfGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const pct = Math.max(0, Math.min(100, score || 0))
  const angle = (pct / 100) * 180
  const rad = (angle - 180) * (Math.PI / 180)
  const r = 40
  const cx = 50, cy = 48
  const x = cx + r * Math.cos(rad)
  const y = cy + r * Math.sin(rad)
  const largeArc = angle > 180 ? 1 : 0

  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <svg viewBox="0 0 100 55" style={{ width: 120, height: 66 }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--s3)" strokeWidth="6" />
        {pct > 0 && (
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize="16" fontWeight="800" fontFamily="'JetBrains Mono', monospace">{score || 0}</text>
        <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--muted)" fontSize="6">/100</text>
      </svg>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: -4, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

/* ─── Paywall Plans Component ─── */
function PaywallPlans({ tradeCount, onPay, payLoading }: { tradeCount: number; onPay: (plan: string) => void; payLoading: boolean }) {
  const plans = [
    {
      id: 'single',
      name: 'Single Report',
      price: '₹99',
      period: 'one-time',
      features: ['This session — all trades unlocked', 'Full psychology coaching', 'Technical analysis per trade', 'Counterfactual scenarios'],
      cta: 'Buy Report',
      highlight: false,
    },
    {
      id: 'pro_monthly',
      name: 'Pro Monthly',
      price: '₹799',
      period: '/month',
      features: ['Unlimited sessions', 'Dashboard + Journal', 'AI Coach access', 'Priority analysis'],
      cta: 'Get Pro',
      highlight: true,
    },
    {
      id: 'pro_yearly',
      name: 'Pro Yearly',
      price: '₹499',
      period: '/month',
      features: ['Save 38% vs monthly', 'Billed ₹5,988/year', 'Everything in Pro', 'Priority support'],
      cta: 'Get Pro',
      highlight: false,
    },
  ]

  return (
    <div style={{ padding: '28px 20px', background: 'rgba(255,255,255,.02)', borderTop: '1px solid var(--border)' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Unlock All {tradeCount} Trades</div>
        <div style={{ fontSize: 13, color: 'var(--muted2)' }}>Full psychology coaching, technical analysis, counterfactuals for every trade.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 700, margin: '0 auto' }}>
        {plans.map(p => (
          <div key={p.id} style={{
            padding: '20px 16px', borderRadius: 12, textAlign: 'center',
            background: p.highlight ? 'rgba(93,120,255,.08)' : 'var(--s2)',
            border: p.highlight ? '1px solid var(--accent)' : '1px solid var(--border)',
            position: 'relative',
          }}>
            {p.highlight && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--accent)', color: '#000', fontSize: 9, fontWeight: 800,
                padding: '2px 10px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 1,
              }}>Popular</div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{p.name}</div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{p.price}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.period}</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              {p.features.map((f, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 3 }}>{f}</div>
              ))}
            </div>
            <button
              className={`btn ${p.highlight ? 'btn-accent' : 'btn-ghost'}`}
              style={{ width: '100%', fontSize: 12, padding: '8px 12px' }}
              onClick={() => onPay(p.id)}
              disabled={payLoading}
            >
              {payLoading ? '...' : `${p.cta} →`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPct, setLoadingPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [expandedTrade, setExpandedTrade] = useState<number>(0)
  const [sideFilter, setSideFilter] = useState<string>('all')
  const [unlocked, setUnlocked] = useState(false)
  const [paySuccess, setPaySuccess] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { user, isSignedIn } = useUser()
  const { pay, loading: payLoading } = useRazorpay()
  const router = useRouter()

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function reset() {
    setFile(null); setLoading(false); setLoadingPct(0)
    setError(null); setErrorCode(null); setResult(null); setExpandedTrade(0); setSideFilter('all')
    setUnlocked(false); setPaySuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f) { setFile(f); setError(null) }
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError(null) }
    e.target.value = ''
  }

  function getContext() {
    const ctx: Record<string, string> = {}
    document.querySelectorAll<HTMLSelectElement>('.ctx-select').forEach(sel => {
      if (sel.value) {
        const label = sel.closest('.ctx-q')?.querySelector('.ctx-label')?.textContent || ''
        ctx[label] = sel.value
      }
    })
    const notes = document.querySelector<HTMLTextAreaElement>('.ctx-textarea')?.value
    if (notes) ctx['Special notes'] = notes
    return ctx
  }

  async function runAnalysis() {
    if (!file) { setError('Please select a file first'); return }
    setError(null); setErrorCode(null); setLoading(true); setLoadingPct(5)

    const progressTimer = setInterval(() => {
      setLoadingPct(prev => Math.min(prev + 2, 90))
    }, 1500)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('context', JSON.stringify(getContext()))

      const res = await fetch('/api/analyse', { method: 'POST', body: fd })
      clearInterval(progressTimer)
      setLoadingPct(95)

      const data = await res.json()
      if (!res.ok || data.error) {
        const code = data.code || (res.status === 529 ? 'OVERLOADED' : null)
        setErrorCode(code)
        if (code === 'OVERLOADED') {
          setError('Our AI is currently busy. Please try again in 30 seconds.')
        } else if (code === 'TRUNCATED') {
          setError('Your file has too many trades. Please try a smaller file or a single day\'s trades.')
        } else {
          setError(data.error || 'Analysis failed. Please try again.')
        }
        setLoading(false); setLoadingPct(0)
        return
      }

      setLoadingPct(100)
      setResult(data)
      setLoading(false); setLoadingPct(0)

      sessionStorage.setItem('tradesaath_results', JSON.stringify(data))

      try {
        fetch('/api/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trades: data.trades, analysis: data, broker: data.broker }),
        }).catch(() => {})
      } catch { /* ignore */ }
    } catch {
      clearInterval(progressTimer)
      setError('Failed to connect to server. Please try again.')
      setErrorCode(null)
      setLoading(false); setLoadingPct(0)
    }
  }

  /* ─── Payment handler ─── */
  function handlePay(plan: string) {
    if (!isSignedIn) {
      // Redirect to sign-in with return URL
      router.push('/sign-in?redirect_url=/upload')
      return
    }
    pay({
      plan,
      email: user?.primaryEmailAddress?.emailAddress,
      onSuccess: () => {
        setUnlocked(true)
        setPaySuccess(`Payment successful! All ${result?.trades?.length || 0} trades unlocked.`)
        setTimeout(() => setPaySuccess(null), 5000)
      },
      onError: (err) => {
        setError(err || 'Payment failed. Please try again.')
      },
    })
  }

  /* ─── Filtered trades for sidebar ─── */
  const filteredTrades = useMemo(() => {
    if (!result) return []
    const trades = result.trades
    if (sideFilter === 'all') return trades
    if (sideFilter === 'BUY') return trades.filter(t => t.side === 'BUY')
    if (sideFilter === 'SELL') return trades.filter(t => t.side === 'SELL')
    if (sideFilter === 'wins') return trades.filter(t => t.pnl > 0)
    if (sideFilter === 'losses') return trades.filter(t => t.pnl < 0)
    return trades
  }, [result, sideFilter])

  /* ═══════════════════════════════════════════
     RESULTS VIEW
  ═══════════════════════════════════════════ */
  if (result) {
    const { kpis, trades, momentum, vicious_cycle, technical_insights } = result
    const ts = TAG_STYLES
    const selectedTrade = trades[expandedTrade]
    const isLocked = expandedTrade > 0 && !unlocked

    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>

          {/* Success banner */}
          {paySuccess && (
            <div style={{
              padding: '12px 20px', marginBottom: 14, borderRadius: 10,
              background: 'rgba(54,211,153,.12)', border: '1px solid rgba(54,211,153,.3)',
              color: 'var(--green)', fontSize: 14, fontWeight: 600, textAlign: 'center',
            }}>
              ✅ {paySuccess}
            </div>
          )}

          {/* Nav */}
          <div className="results-nav">
            <button className="btn btn-ghost btn-sm" onClick={reset}>&larr; New Analysis</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{unlocked ? 'Pro' : 'Free tier'} &middot; {result.broker} &middot; {result.market}</span>
          </div>

          {/* KPI Strip */}
          <div className="kpi-strip">
            {[
              { label: 'Net P&L', val: fmtPnl(kpis.net_pnl), color: kpis.net_pnl >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Trades', val: String(kpis.total_trades), color: 'var(--text)' },
              { label: 'Winners', val: String(kpis.wins), color: 'var(--green)' },
              { label: 'Losers', val: String(kpis.losses), color: 'var(--red)' },
              { label: 'Win Rate', val: kpis.win_rate + '%', color: kpis.win_rate >= 50 ? 'var(--green)' : 'var(--red)' },
              { label: 'Profit Factor', val: String(kpis.profit_factor || '—'), color: 'var(--text)' },
              { label: 'Best Trade', val: fmtPnl(kpis.best_trade_pnl), color: 'var(--green)' },
              { label: 'Worst Trade', val: fmtPnl(kpis.worst_trade_pnl), color: 'var(--red)' },
            ].map((k, i) => (
              <div key={i} className="kpi-item">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Truncation / partial notice */}
          {(result.total_trades_in_file && result.trades_shown && result.total_trades_in_file > result.trades_shown) && (
            <div style={{
              padding: '10px 16px', marginBottom: 14, borderRadius: 8,
              background: 'rgba(240,180,41,.08)', border: '1px solid rgba(240,180,41,.25)',
              fontSize: 13, color: 'var(--gold)',
            }}>
              📊 Showing {result.trades_shown} of {result.total_trades_in_file} trades (most significant by P&L and pattern). KPIs reflect all {result.total_trades_in_file} trades.
            </div>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(result as any)._truncated && (
            <div style={{
              padding: '10px 16px', marginBottom: 14, borderRadius: 8,
              background: 'rgba(240,180,41,.08)', border: '1px solid rgba(240,180,41,.25)',
              fontSize: 13, color: 'var(--gold)',
            }}>
              ⚠ Some trades may be missing due to response size limits. KPIs and session analysis are complete.
            </div>
          )}

          {/* AI Summary */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">AI Session Summary<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {result.summary}
              </div>
            </div>
          </div>

          {/* Momentum */}
          {momentum && momentum.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Session Momentum<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div className="momentum-grid">
                  {momentum.map((m, i) => (
                    <div key={i} className="momentum-item">
                      <div className="momentum-head">
                        <span className="momentum-name">{m.name}</span>
                        <span className="momentum-val" style={{ color: `var(--${m.color})` }}>{m.score}%</span>
                      </div>
                      <div className="momentum-bar"><div className="momentum-fill" style={{ width: `${m.score}%`, background: `var(--${m.color})` }} /></div>
                      <div className="momentum-desc">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Vicious Cycle */}
          {vicious_cycle && vicious_cycle.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Vicious Cycle Detector<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div className="cycle-grid">
                  {vicious_cycle.map((s, i) => (
                    <div key={i} className={`cycle-stage${s.count > 0 ? ' active' : ''}`}>
                      <div className="cycle-icon">{CYCLE_ICONS[s.icon] || s.icon}</div>
                      <div className="cycle-label">{s.stage}</div>
                      {s.count > 0 && <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>{s.count}x</div>}
                      {s.count > 0 && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Technical Insights */}
          {technical_insights && technical_insights.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Free Technical Insights<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div className="fi-grid">
                  {technical_insights.map((ti, i) => (
                    <div key={i} className="fi-item">
                      <div className="fi-head">
                        <span className="fi-name">{ti.name}</span>
                        <span className="fi-score" style={{ color: `var(--${ti.color})` }}>{ti.score}/100</span>
                      </div>
                      <div className="fi-bar"><div className="fi-fill" style={{ width: `${ti.score}%`, background: `var(--${ti.color})` }} /></div>
                      <div className="fi-desc">{ti.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Per-Trade: Sidebar + Detail ═══ */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Per-Trade Analysis<span className="badge badge-free">{unlocked ? 'ALL UNLOCKED' : 'Trade 1 FREE'}</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ display: 'flex', minHeight: 500 }}>

                {/* ─── LEFT SIDEBAR ─── */}
                <div style={{
                  width: 320, minWidth: 320, borderRight: '1px solid var(--border)',
                  overflowY: 'auto', maxHeight: 700, position: 'sticky', top: 80,
                  background: 'var(--s1)',
                }}>
                  {/* Running P&L ticker */}
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,.02)',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Running P&L</div>
                    <div style={{
                      fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
                      color: kpis.net_pnl >= 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {fmtPnl(kpis.net_pnl)}
                    </div>
                  </div>

                  {/* Filter tabs — ALL / BUY / SELL / WIN / LOSS */}
                  <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
                    {['all', 'BUY', 'SELL', 'wins', 'losses'].map(f => (
                      <button key={f} onClick={() => setSideFilter(f)} style={{
                        flex: 1, padding: '8px 2px', fontSize: 9, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.3, cursor: 'pointer',
                        background: sideFilter === f ? 'var(--accent)' : 'transparent',
                        color: sideFilter === f ? '#000' : 'var(--muted)',
                        border: 'none', borderRight: '1px solid var(--border)',
                        transition: 'all .15s',
                      }}>
                        {f === 'losses' ? '📉Loss' : f === 'wins' ? '✅Win' : f === 'all' ? 'All' : f}
                      </button>
                    ))}
                  </div>

                  {/* Trade list */}
                  {filteredTrades.map((t) => {
                    const isActive = expandedTrade === t.index
                    const tagStyle = ts[t.tag] || { bg: 'rgba(150,150,150,.12)', color: 'var(--muted)' }
                    const tradeIsLocked = t.index > 0 && !unlocked
                    return (
                      <div key={t.index}
                        onClick={() => setExpandedTrade(t.index)}
                        style={{
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                          background: isActive ? 'rgba(93,120,255,.06)' : 'transparent',
                          transition: 'all .15s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', width: 22 }}>#{t.index + 1}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                          <span style={{ fontWeight: 700, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.symbol}</span>
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: t.side === 'BUY' ? 'rgba(54,211,153,.15)' : 'rgba(240,93,108,.15)',
                            color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)',
                          }}>{t.side}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
                            color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                          }}>{fmtPnl(t.pnl)}</span>
                          <span style={{
                            padding: '1px 8px', borderRadius: 10, fontSize: 9, fontWeight: 600,
                            background: tagStyle.bg, color: tagStyle.color,
                          }}>{t.label}</span>
                          {tradeIsLocked && <span style={{ fontSize: 9, marginLeft: 'auto' }}>🔒</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ─── RIGHT: Trade Detail ─── */}
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 700 }}>
                  {selectedTrade && (
                    <div style={{ padding: 20 }}>
                      {/* Trade header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                          Trade #{selectedTrade.index + 1}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedTrade.time}</span>
                        {selectedTrade.session && (() => {
                          const s = SESSION_COLORS[selectedTrade.session] || SESSION_COLORS.morning
                          return (
                            <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          )
                        })()}
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedTrade.symbol}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                          background: selectedTrade.side === 'BUY' ? 'rgba(54,211,153,.15)' : 'rgba(240,93,108,.15)',
                          color: selectedTrade.side === 'BUY' ? 'var(--green)' : 'var(--red)',
                        }}>{selectedTrade.side}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>&times;{selectedTrade.qty}</span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 16,
                          color: selectedTrade.pnl >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 'auto',
                        }}>{fmtPnl(selectedTrade.pnl)}</span>
                        {(() => {
                          const tagStyle = ts[selectedTrade.tag] || { bg: 'rgba(150,150,150,.12)', color: 'var(--muted)' }
                          return (
                            <span style={{ padding: '3px 12px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: tagStyle.bg, color: tagStyle.color }}>
                              {selectedTrade.label}
                            </span>
                          )
                        })()}
                      </div>

                      {/* LOCKED overlay for non-first trades */}
                      {isLocked ? (
                        <div style={{
                          textAlign: 'center', padding: '60px 20px',
                          background: 'rgba(255,255,255,.02)', borderRadius: 12,
                          border: '1px dashed var(--border)',
                        }}>
                          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Trade Detail Locked</div>
                          <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
                            Full psychology coaching, technical analysis, entry/exit efficiency, and counterfactual analysis for all {trades.length} trades.
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-accent" style={{ fontSize: 12, padding: '8px 20px' }} onClick={() => handlePay('single')}>
                              Buy Report — ₹99
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 20px' }} onClick={() => handlePay('pro_monthly')}>
                              Get Pro — ₹799/mo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Time gap badge */}
                          {selectedTrade.time_gap_from_last && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
                              ⏱ {selectedTrade.time_gap_from_last === 'first trade' ? 'First trade of session' : `${selectedTrade.time_gap_from_last} since last trade`}
                            </div>
                          )}

                          {/* Stats grid — 5 columns */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                            {[
                              { label: 'Entry', val: fmtPrice(selectedTrade.entry) },
                              { label: 'Exit', val: fmtPrice(selectedTrade.exit) },
                              { label: 'Qty', val: String(selectedTrade.qty) },
                              { label: 'Net P&L', val: fmtPnl(selectedTrade.pnl), color: selectedTrade.pnl >= 0 ? 'var(--green)' : 'var(--red)' },
                              { label: 'Cum. P&L', val: fmtPnl(selectedTrade.cum_pnl ?? selectedTrade.pnl), color: (selectedTrade.cum_pnl ?? selectedTrade.pnl) >= 0 ? 'var(--green)' : 'var(--red)' },
                            ].map((c, ci) => (
                              <div key={ci} style={{ padding: '10px 12px', background: 'var(--s2)', borderRadius: 8 }}>
                                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: c.color || 'var(--text)' }}>{c.val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Quick Summary */}
                          {selectedTrade.quick_summary && (
                            <div style={{
                              padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                              borderLeft: '3px solid var(--accent)', background: 'rgba(93,120,255,.04)',
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.8,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Quick Summary</div>
                              {selectedTrade.quick_summary}
                            </div>
                          )}

                          {/* Entry/Exit Efficiency */}
                          {selectedTrade.entry_exit_efficiency && (
                            <div style={{ marginBottom: 16, padding: '16px', background: 'var(--s2)', borderRadius: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Entry / Exit Efficiency</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <HalfGauge score={selectedTrade.entry_exit_efficiency.entry_score} label="Entry Score" color="var(--green)" />
                                <HalfGauge score={selectedTrade.entry_exit_efficiency.exit_score} label="Exit Score" color="var(--accent)" />
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>Risk : Reward</div>
                                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>
                                    {selectedTrade.entry_exit_efficiency.risk_reward}
                                  </div>
                                  {selectedTrade.entry_exit_efficiency.optimal_rr && (
                                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                                      Optimal: {selectedTrade.entry_exit_efficiency.optimal_rr}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Entry Timing */}
                          {selectedTrade.entry_timing && (
                            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--s2)', borderRadius: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Entry Timing</div>
                              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                                {selectedTrade.entry_timing.description}
                              </div>
                              <span style={{
                                marginTop: 6, display: 'inline-block',
                                padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                                background: selectedTrade.entry_timing.risk_level === 'High' ? 'rgba(240,93,108,.15)' :
                                  selectedTrade.entry_timing.risk_level === 'Medium' ? 'rgba(240,180,41,.15)' : 'rgba(54,211,153,.15)',
                                color: selectedTrade.entry_timing.risk_level === 'High' ? 'var(--red)' :
                                  selectedTrade.entry_timing.risk_level === 'Medium' ? 'var(--gold)' : 'var(--green)',
                              }}>
                                {selectedTrade.entry_timing.risk_level} Risk
                              </span>
                            </div>
                          )}

                          {/* In-Trade Behavior */}
                          {selectedTrade.in_trade_behavior && (
                            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--s2)', borderRadius: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 1 }}>In-Trade Behavior</span>
                                <span style={{
                                  padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                                  background: selectedTrade.in_trade_behavior.discipline === 'DISCIPLINED' ? 'rgba(54,211,153,.15)' :
                                    selectedTrade.in_trade_behavior.discipline === 'IMPULSIVE' ? 'rgba(240,180,41,.15)' : 'rgba(240,93,108,.15)',
                                  color: selectedTrade.in_trade_behavior.discipline === 'DISCIPLINED' ? 'var(--green)' :
                                    selectedTrade.in_trade_behavior.discipline === 'IMPULSIVE' ? 'var(--gold)' : 'var(--red)',
                                }}>
                                  {selectedTrade.in_trade_behavior.discipline}
                                </span>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                                {selectedTrade.in_trade_behavior.description}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                During trade: {selectedTrade.in_trade_behavior.during_trade}
                              </div>
                            </div>
                          )}

                          {/* What You Did vs Should Have Done — TEXT version */}
                          {selectedTrade.what_you_did_vs_should_have && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>What You Did vs What To Do Instead</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {/* Actual — Red */}
                                <div style={{ padding: '14px 16px', borderRadius: 10, borderLeft: '3px solid var(--red)', background: 'rgba(240,93,108,.04)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', marginBottom: 8, textTransform: 'uppercase' }}>What You Did</div>
                                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                                    {selectedTrade.what_you_did_vs_should_have.what_you_did}
                                  </div>
                                </div>
                                {/* Ideal — Green */}
                                <div style={{ padding: '14px 16px', borderRadius: 10, borderLeft: '3px solid var(--green)', background: 'rgba(54,211,153,.04)' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase' }}>What To Do Instead</div>
                                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                                    {selectedTrade.what_you_did_vs_should_have.what_to_do_instead}
                                  </div>
                                  {selectedTrade.what_you_did_vs_should_have.key_lesson && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                                      KEY LESSON: {selectedTrade.what_you_did_vs_should_have.key_lesson}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Vicious Cycle Stage */}
                          {selectedTrade.vicious_cycle_stage && (
                            <div style={{
                              padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                              borderLeft: '3px solid var(--gold)', background: 'rgba(240,180,41,.04)',
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Vicious Cycle Stage</div>
                              {selectedTrade.vicious_cycle_stage}
                            </div>
                          )}

                          {/* Psychology Coaching */}
                          {selectedTrade.psychology_coaching && (
                            <div style={{
                              padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                              borderLeft: '3px solid var(--purple)', background: 'rgba(157,122,247,.04)',
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--purple)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Psychology Coaching</div>
                              {selectedTrade.psychology_coaching}
                            </div>
                          )}

                          {/* Technical Analysis */}
                          {selectedTrade.technical_analysis && (
                            <div style={{
                              padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                              borderLeft: '3px solid var(--blue)', background: 'rgba(91,141,239,.04)',
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Technical Analysis</div>
                              {selectedTrade.technical_analysis}
                            </div>
                          )}

                          {/* Counterfactual */}
                          {selectedTrade.counterfactual && (
                            <div style={{
                              padding: '12px 16px', borderRadius: '0 8px 8px 0',
                              borderLeft: '3px solid #2dd4bf', background: 'rgba(45,212,191,.04)',
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                              position: 'relative', overflow: 'hidden',
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#2dd4bf', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                                🔒 Counterfactual — What If?
                              </div>
                              <div style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }}>
                                {selectedTrade.counterfactual}
                              </div>
                              <div style={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,.3)', borderRadius: '0 8px 8px 0',
                              }}>
                                <button className="btn btn-accent btn-sm" style={{ fontSize: 12 }} onClick={() => handlePay('single')}>
                                  🔒 Upgrade to unlock
                                </button>
                              </div>
                            </div>
                          )}

                          {/* If no detailed fields exist (should not happen for trade 0, but safety) */}
                          {!selectedTrade.quick_summary && !selectedTrade.psychology_coaching && (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                              Basic trade data shown. Detailed analysis available for Trade #1 (free) or all trades (Pro).
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom paywall */}
              {trades.length > 1 && !unlocked && (
                <PaywallPlans tradeCount={trades.length} onPay={handlePay} payLoading={payLoading} />
              )}
            </div>
          </div>

        </div>
      </section>
    )
  }

  /* ═══════════════════════════════════════════
     UPLOAD FORM
  ═══════════════════════════════════════════ */
  return (
    <section id="sec-app">
      <div className="wrap-narrow" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              📤 Analyse Your Trades
            </div>
            <span className="badge badge-free">Free &middot; No login</span>
          </div>
          <div className="card-body">

            {/* Auto-detect bar */}
            <div className="autodetect-bar">
              <span className="autodetect-icon">🔍</span>
              <span>Market, exchange &amp; currency will be <strong>auto-detected</strong> from your file</span>
              <span className={`autodetect-badge${file ? ' detected' : ''}`}>
                {file ? 'File ready' : 'Awaiting file\u2026'}
              </span>
            </div>

            {/* Dropzone */}
            {!loading && (
              <label className="dropzone"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag') }}
                onDragLeave={e => e.currentTarget.classList.remove('drag')}
                onDrop={e => { e.currentTarget.classList.remove('drag'); handleDrop(e) }}>
                <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" multiple={false}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  onChange={handleFileSelect} />
                <div className="dz-icon">📂</div>
                <div className="dz-title">Drop files here or click to browse</div>
                <div className="dz-sub">PDF, CSV, Excel, screenshots — any broker worldwide</div>
                <div className="dz-tags"><span>PDF</span><span>CSV</span><span>XLSX</span><span>XLS</span><span>PNG</span><span>JPG</span><span>JPEG</span></div>
              </label>
            )}

            {/* File chip */}
            {file && !loading && (
              <div className="file-list">
                <div className="file-chip">
                  <span className="chip-name">{file.name}</span>
                  <span className="chip-size">{formatSize(file.size)}</span>
                  <button className="chip-rm" onClick={() => setFile(null)}>&times;</button>
                </div>
              </div>
            )}

            {/* Trading Context */}
            {!loading && (
              <div className="ctx-box">
                <div className="ctx-header">
                  <span className="label" style={{ fontSize: 13, fontWeight: 600 }}>Trading Context</span>
                  <span className="ctx-optional">optional &middot; makes analysis sharper</span>
                </div>
                <div className="ctx-questions">
                  <div className="ctx-q">
                    <label className="ctx-label">Experience level</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="experienced">Experienced</option><option value="professional">Professional</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Total trading capital</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="micro">Under ₹50K</option><option value="small">₹50K–₹2L</option><option value="medium">₹2L–₹10L</option><option value="large">₹10L–₹50L</option><option value="xlarge">Above ₹50L</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Your mood going in</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="confident">Confident</option><option value="neutral">Neutral</option><option value="anxious">Anxious</option><option value="revenge">Revenge</option><option value="overexcited">Overexcited</option><option value="tired">Tired</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Market view that day</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option><option value="volatile">Volatile</option><option value="expiry">Expiry</option><option value="no_view">No view</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Stop loss rules</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="strict">Strict</option><option value="mental">Mental</option><option value="moved">Moved</option><option value="none">None</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Strategy intention</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="breakout">Breakout</option><option value="reversal">Reversal</option><option value="trend">Trend</option><option value="scalp">Scalp</option><option value="swing">Swing</option><option value="no_strategy">No strategy</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Pre-market plan</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="full">Full plan</option><option value="loose">Loose plan</option><option value="abandoned">Abandoned</option><option value="none">No plan</option></select>
                  </div>
                  <div className="ctx-q ctx-q-full">
                    <label className="ctx-label">Special notes</label>
                    <textarea className="ctx-textarea" rows={2} placeholder="e.g. First day trading new strategy, expiry day, etc." />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10, padding: '10px 14px', background: 'rgba(244,63,94,.08)', borderRadius: 8, border: '1px solid rgba(244,63,94,.2)' }}>
                <div>⚠ {error}</div>
                {errorCode === 'OVERLOADED' && (
                  <button className="btn btn-accent btn-sm" style={{ marginTop: 8, fontSize: 12 }} onClick={runAnalysis}>
                    🔄 Retry Now
                  </button>
                )}
              </div>
            )}

            {/* Analyse button */}
            {!loading && (
              <div className="analyse-row">
                <button className="btn btn-accent btn-lg" onClick={runAnalysis} disabled={!file}>
                  🔍 Analyse My Trades
                </button>
                <span className="analyse-note">
                  No login required &middot; {file ? '1 file ready' : 'select a file to start'}
                </span>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
                  ⏳ AI is reading your file and analysing trades...
                </div>
                <div className="loading-bar"><div className="loading-fill" style={{ width: `${loadingPct}%` }} /></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  This takes 20-60 seconds. Do not close this tab.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
