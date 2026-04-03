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
  counterfactual?: string; last_5_trades_context?: string
}
interface Momentum { name: string; score: number; color: string; desc: string }
interface CycleStage { stage: string; count: number; icon: string; desc: string }
interface TechInsight { name: string; score: number; color: string; desc: string }
interface KPIs {
  net_pnl: number; total_trades: number; wins: number; losses: number
  win_rate: number; profit_factor: number; best_trade_pnl: number; worst_trade_pnl: number
  gross_buy_value?: number; gross_sell_value?: number
  gross_profit?: number; gross_loss?: number
}
interface AnalysisResult {
  broker: string; market: string; trade_date: string; currency: string
  total_trades_in_file?: number; trades_shown?: number
  kpis: KPIs; summary: string; momentum: Momentum[]
  vicious_cycle: CycleStage[]; technical_insights: TechInsight[]
  dqs?: { score: number; factors: { name: string; score: number; color: string }[] }
  financial_impact?: { total_lost_to_mistakes: number; potential_pnl_without_mistakes: number; message: string }
  mistake_patterns?: { name: string; icon: string; count: number; cost: number; frequency: string }[]
  rules_for_next_session?: string[]
  trades: Trade[]
  time_analysis?: { avg_time_gap_minutes: number; trading_duration_minutes: number }
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
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
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
    setUnlocked(false); setPaySuccess(null); setAiLoading(false); setAiDone(false); setAiError(null)
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

  /* ─── STEP 1: Fast local parse — no AI ─── */
  async function runAnalysis() {
    if (!file) { setError('Please select a file first'); return }
    setError(null); setErrorCode(null); setLoading(true); setLoadingPct(10)
    setAiDone(false); setAiError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      setLoadingPct(30)
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      setLoadingPct(80)

      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorCode(data.code || null)
        setError(data.error || 'Failed to parse file. Please try again.')
        setLoading(false); setLoadingPct(0)
        return
      }

      setLoadingPct(100)

      // Sort trades chronologically (frontend safety net)
      if (data.trades && data.trades.length > 0) {
        data.trades.sort((a: Trade, b: Trade) => {
          const timeA = (a.time || '00:00').replace(/:/g, '')
          const timeB = (b.time || '00:00').replace(/:/g, '')
          return parseInt(timeA) - parseInt(timeB)
        })
        let cumPnl = 0
        data.trades.forEach((t: Trade, i: number) => {
          t.index = i
          cumPnl += t.pnl || 0
          t.cum_pnl = cumPnl
        })
      }

      // Add empty AI fields so the UI doesn't break
      data.momentum = data.momentum || []
      data.vicious_cycle = data.vicious_cycle || []
      data.technical_insights = data.technical_insights || []
      data.dqs = data.dqs || null
      data.financial_impact = data.financial_impact || null
      data.mistake_patterns = data.mistake_patterns || []
      data.rules_for_next_session = data.rules_for_next_session || []

      setResult(data)
      setLoading(false); setLoadingPct(0)

      sessionStorage.setItem('tradesaath_results', JSON.stringify(data))
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : ''
      if (msg.includes('abort') || msg.includes('timeout') || msg.includes('AbortError')) {
        setError('Parsing took too long. Please try a smaller file.')
      } else {
        setError('Could not parse file. Please check the format and try again.')
      }
      setErrorCode(null)
      setLoading(false); setLoadingPct(0)
    }
  }

  /* ─── STEP 2: AI psychology analysis (uses pre-parsed data, no file upload) ─── */
  async function runAIAnalysis() {
    if (!result) return
    setAiLoading(true); setAiError(null)

    try {
      const ctx = getContext()
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trades: result.trades,
          kpis: result.kpis,
          broker: result.broker,
          market: result.market,
          trade_date: result.trade_date,
          currency: result.currency,
          total_trades_in_file: result.total_trades_in_file,
          time_analysis: result.time_analysis,
          context: ctx,
        }),
      })

      const data = await res.json()

      if (data.error && !data.trades) {
        setAiError(data.error)
        setAiLoading(false)
        return
      }

      // Merge AI results into existing result
      setResult(prev => {
        if (!prev) return prev
        // Sort AI trades same way
        if (data.trades && data.trades.length > 0) {
          data.trades.sort((a: Trade, b: Trade) => {
            const timeA = (a.time || '00:00').replace(/:/g, '')
            const timeB = (b.time || '00:00').replace(/:/g, '')
            return parseInt(timeA) - parseInt(timeB)
          })
          let cumPnl = 0
          data.trades.forEach((t: Trade, i: number) => {
            t.index = i
            cumPnl += t.pnl || 0
            t.cum_pnl = cumPnl
          })
        }
        const merged = {
          ...prev,
          summary: data.summary || prev.summary,
          momentum: data.momentum?.length > 0 ? data.momentum : prev.momentum,
          vicious_cycle: data.vicious_cycle?.length > 0 ? data.vicious_cycle : prev.vicious_cycle,
          technical_insights: data.technical_insights?.length > 0 ? data.technical_insights : prev.technical_insights,
          dqs: data.dqs || prev.dqs,
          financial_impact: data.financial_impact || prev.financial_impact,
          mistake_patterns: data.mistake_patterns?.length > 0 ? data.mistake_patterns : prev.mistake_patterns,
          rules_for_next_session: data.rules_for_next_session?.length > 0 ? data.rules_for_next_session : prev.rules_for_next_session,
          trades: data.trades?.length > 0 ? data.trades : prev.trades,
        }
        sessionStorage.setItem('tradesaath_results', JSON.stringify(merged))
        // Save session
        try {
          fetch('/api/sessions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trades: merged.trades,
              analysis: merged,
              broker: merged.broker,
              market: merged.market,
              trade_date: merged.trade_date,
              plan_used: 'free',
            }),
          }).catch(() => {})
        } catch { /* ignore */ }
        return merged
      })

      setAiDone(true)
      setAiLoading(false)
    } catch (fetchErr: unknown) {
      setAiError('AI analysis failed. Your trade data is still available above.')
      setAiLoading(false)
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
              ...(kpis.gross_buy_value ? [
                { label: 'Buy Value', val: fmtPnl(kpis.gross_buy_value), color: 'var(--text)' },
                { label: 'Sell Value', val: fmtPnl(kpis.gross_sell_value || 0), color: 'var(--text)' },
              ] : []),
              ...(kpis.gross_profit ? [
                { label: 'Gross Profit', val: fmtPnl(kpis.gross_profit), color: 'var(--green)' },
                { label: 'Gross Loss', val: fmtPnl(kpis.gross_loss || 0), color: 'var(--red)' },
              ] : []),
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

          {/* ═══ AI Analysis Button / Status ═══ */}
          {!aiDone && !aiLoading && (
            <div style={{
              padding: '16px 20px', marginBottom: 14, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(93,120,255,.08), rgba(157,122,247,.08))',
              border: '1px solid rgba(93,120,255,.25)',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Trades parsed successfully
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
                  Get AI psychology analysis, vicious cycle detection, coaching insights, and more.
                </div>
              </div>
              <button className="btn btn-accent" style={{ fontSize: 13, padding: '10px 24px', whiteSpace: 'nowrap' }} onClick={runAIAnalysis}>
                Analyse with AI
              </button>
            </div>
          )}
          {aiLoading && (
            <div style={{
              padding: '16px 20px', marginBottom: 14, borderRadius: 10,
              background: 'rgba(93,120,255,.06)', border: '1px solid rgba(93,120,255,.2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
                AI is analysing your trading psychology...
              </div>
              <div className="loading-bar"><div className="loading-fill" style={{ width: '60%', animation: 'pulse 2s ease-in-out infinite' }} /></div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                This takes 20-60 seconds. Your trades are already visible below.
              </div>
            </div>
          )}
          {aiError && (
            <div style={{
              padding: '12px 16px', marginBottom: 14, borderRadius: 8,
              background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)',
              fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ flex: 1 }}>AI analysis: {aiError}</span>
              <button className="btn btn-accent btn-sm" style={{ fontSize: 11 }} onClick={runAIAnalysis}>Retry</button>
            </div>
          )}
          {aiDone && (
            <div style={{
              padding: '10px 16px', marginBottom: 14, borderRadius: 8,
              background: 'rgba(54,211,153,.08)', border: '1px solid rgba(54,211,153,.25)',
              fontSize: 13, color: 'var(--green)', fontWeight: 600,
            }}>
              AI analysis complete
            </div>
          )}

          {/* AI Summary */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Session Summary<span className="badge badge-free">FREE</span></div>
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

          {/* ═══ DQS Ring + Factors ═══ */}
          {result.dqs && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Decision Quality Score<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 120, height: 120 }}>
                    <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
                      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--s3)" strokeWidth="8" />
                      <circle cx="60" cy="60" r="52" fill="none"
                        stroke={result.dqs.score >= 70 ? 'var(--green)' : result.dqs.score >= 50 ? 'var(--gold)' : result.dqs.score >= 30 ? 'var(--orange)' : 'var(--red)'}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 52}`}
                        strokeDashoffset={`${2 * Math.PI * 52 - (result.dqs.score / 100) * 2 * Math.PI * 52}`}
                        transform="rotate(-90 60 60)" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: result.dqs.score >= 70 ? 'var(--green)' : result.dqs.score >= 50 ? 'var(--gold)' : 'var(--red)' }}>{result.dqs.score}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>out of 100</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.dqs.factors.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted2)', width: 110, flexShrink: 0 }}>{f.name}</span>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.04)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${f.score}%`, height: '100%', background: `var(--${f.color})`, borderRadius: 3, transition: 'width 1s ease' }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)', width: 28, textAlign: 'right' }}>{f.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Financial Impact ═══ */}
          {result.financial_impact && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Financial Impact<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Learning cost</div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--red)' }}>
                      {fmtPnl(result.financial_impact.total_lost_to_mistakes)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Disciplined potential</div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: 'var(--green)' }}>
                      {fmtPnl(result.financial_impact.potential_pnl_without_mistakes)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>{result.financial_impact.message}</div>
                {result.mistake_patterns && result.mistake_patterns.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.mistake_patterns.map((mp, i) => {
                      const maxCount = Math.max(...(result.mistake_patterns || []).map(m => m.count), 1)
                      return (
                        <div key={i} className="mc-row">
                          <span className="mc-row-icon">{mp.icon}</span>
                          <span className="mc-row-name">{mp.name}</span>
                          <span className="mc-row-count">{mp.count}x</span>
                          <div className="mc-row-bar"><div className="mc-row-fill" style={{ width: `${(mp.count / maxCount) * 100}%` }} /></div>
                          <span style={{ color: 'var(--red)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{fmtPnl(mp.cost)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Rules for Next Session ═══ */}
          {result.rules_for_next_session && result.rules_for_next_session.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Rules for Next Session<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.rules_for_next_session.map((rule, i) => (
                    <div key={i} style={{
                      padding: '10px 14px', borderRadius: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                      background: 'rgba(62,232,196,.04)', borderLeft: '3px solid var(--accent)',
                    }}>
                      <strong style={{ color: 'var(--accent)', marginRight: 8 }}>Rule {i + 1}:</strong>{rule}
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
                    // Session badge
                    const sess = SESSION_COLORS[t.session] || SESSION_COLORS.morning
                    // Time gap from previous trade
                    const prevTrade = t.index > 0 ? trades.find(tr => tr.index === t.index - 1) : null
                    let timeGapMin = 0
                    let timeGapLabel = ''
                    if (prevTrade) {
                      const [h1, m1] = (prevTrade.time || '0:0').split(':').map(Number)
                      const [h2, m2] = (t.time || '0:0').split(':').map(Number)
                      timeGapMin = (h2 * 60 + m2) - (h1 * 60 + m1)
                      if (timeGapMin > 0) timeGapLabel = `${timeGapMin}m`
                    }
                    const gapColor = timeGapMin >= 10 ? 'var(--green)' : timeGapMin >= 2 ? 'var(--gold)' : timeGapMin > 0 ? 'var(--red)' : 'var(--muted)'
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)', width: 22 }}>#{t.index + 1}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                          <span style={{ padding: '1px 5px', borderRadius: 6, fontSize: 8, fontWeight: 700, background: sess.bg, color: sess.color }}>{sess.label}</span>
                          {timeGapLabel && (
                            <span style={{ fontSize: 8, color: gapColor, fontWeight: 600 }}>⏱{timeGapLabel}</span>
                          )}
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: t.side === 'BUY' ? 'rgba(54,211,153,.15)' : 'rgba(240,93,108,.15)',
                            color: t.side === 'BUY' ? 'var(--green)' : 'var(--red)',
                          }}>{t.side}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.symbol}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
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

                          {/* Last 5 Trades Context */}
                          {(() => {
                            const tIdx = selectedTrade.index
                            const prev5 = trades.filter(tr => tr.index < tIdx).slice(-5)
                            if (prev5.length === 0 && !selectedTrade.last_5_trades_context) {
                              // First trade — show opening context
                              return selectedTrade.last_5_trades_context ? (
                                <div style={{
                                  padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                                  borderLeft: '3px solid var(--accent)', background: 'rgba(93,120,255,.04)',
                                  fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                                }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>📊 Recent Momentum</div>
                                  {selectedTrade.last_5_trades_context}
                                </div>
                              ) : null
                            }
                            return (
                              <div style={{
                                padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                                borderLeft: '3px solid var(--accent)', background: 'rgba(93,120,255,.04)',
                                fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                              }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>📊 Recent Momentum (Last {prev5.length} Trades)</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                  {prev5.map(pt => (
                                    <span key={pt.index} style={{
                                      padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                                      fontFamily: "'JetBrains Mono', monospace",
                                      background: pt.pnl >= 0 ? 'rgba(54,211,153,.1)' : 'rgba(240,93,108,.1)',
                                      color: pt.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                                    }}>
                                      #{pt.index + 1} {fmtPnl(pt.pnl)}
                                    </span>
                                  ))}
                                </div>
                                {selectedTrade.last_5_trades_context && (
                                  <div style={{ fontSize: 12, color: 'var(--muted2)' }}>{selectedTrade.last_5_trades_context}</div>
                                )}
                              </div>
                            )
                          })()}

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

                          {/* Vicious Cycle Stage */}
                          {selectedTrade.vicious_cycle_stage && (
                            <div style={{
                              padding: '12px 16px', marginBottom: 16, borderRadius: '0 8px 8px 0',
                              borderLeft: '3px solid var(--gold)', background: 'rgba(240,180,41,.04)',
                              fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>🔄 Vicious Cycle Stage</div>
                              {selectedTrade.vicious_cycle_stage}
                            </div>
                          )}

                          {/* Counterfactual */}
                          {selectedTrade.counterfactual && (
                            unlocked ? (
                              <div style={{
                                padding: '12px 16px', borderRadius: '0 8px 8px 0',
                                borderLeft: '3px solid #2dd4bf', background: 'rgba(45,212,191,.04)',
                                fontSize: 13, color: 'var(--text2)', lineHeight: 1.7,
                              }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#2dd4bf', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                                  Counterfactual — What If?
                                </div>
                                {selectedTrade.counterfactual}
                              </div>
                            ) : (
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
                            )
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
                  Parse My Trades
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
                  Parsing your trades...
                </div>
                <div className="loading-bar"><div className="loading-fill" style={{ width: `${loadingPct}%` }} /></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  This takes just a few seconds.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
