"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { usePlan } from "@/lib/planStore"
import { useRazorpay } from "@/hooks/useRazorpay"
import Link from "next/link"
import TradeSaathScore from "@/components/dashboard/TradeSaathScore"
import PreMarketCheckin from "@/components/dashboard/PreMarketCheckin"
import DashboardEquityCurve from "@/components/dashboard/DashboardEquityCurve"
import SummaryCards from "@/components/dashboard/SummaryCards"
import BehavioralInsights from "@/components/dashboard/BehavioralInsights"
import GoalTracking from "@/components/dashboard/GoalTracking"
import RecentActivity from "@/components/dashboard/RecentActivity"
import PerformanceHeatmap from "@/components/dashboard/PerformanceHeatmap"
import MistakeCostCalculator from "@/components/dashboard/MistakeCostCalculator"
import DecisionQualityScore from "@/components/dashboard/DecisionQualityScore"
import Toaster from "@/components/ui/Toast"
import ErrorBoundary from "@/components/ui/ErrorBoundary"
import BatchAnalysisRunner from "@/components/BatchAnalysisRunner"
import FirstSessionGuide from "@/components/FirstSessionGuide"

interface DashStats {
  hasData: boolean
  pendingAnalysisCount?: number
  sessionCount: number
  totalTrades: number
  allTime?: {
    pnl: number; sessions: number; trades: number; wins: number; losses: number
    winRate: number; successRate?: number; bestSessionPnl: number; bestSessionDate?: string
    worstSessionPnl?: number; worstSessionDate?: string; avgWin: number; avgLoss: number
    profitFactor: number; riskReward: string; maxDrawdown?: number; disciplineScore?: number
  }
  month: {
    pnl: number; sessions: number; trades: number; wins: number; losses: number
    winRate: number; successRate: number; successRateScope?: string; avgWin: number
    avgLoss: number; riskReward: string; riskRewardScope?: string; bestSessionPnl?: number; profitFactor?: number
  }
  week: { pnl: number; sessions: number; trades: number }
  today: { pnl: number; sessions: number }
  equityCurve: { pnl: number; date: string }[]
  streaks: { current: number; bestWin: number; worstLoss: number }
  risk: { maxDrawdown: number; avgLossAvgWin: string }
  recentTrades?: { time?: string; symbol?: string; side?: string; pnl?: number; tag?: string; sessionDate?: string }[]
  recentSessions?: { date?: string; trades?: number; pnl?: number; winRate?: number; dqsScore?: number }[]
  lastMonthPnl?: number
  lastMonthWinRate?: number
  lastSessionDate?: string | null
  topPatternThisMonth?: { label: string; count: number; cost: number } | null
  topPatternLastMonth?: { label: string; count: number; cost: number } | null
  monthPatterns?: { label: string; count: number; cost: number }[]
  mistakeTrades?: { type: string; icon: string; count: number; cost: number }[]
  totalMistakeCost?: number
  counterfactualPnl?: number
  actualMonthPnl?: number
  actualAllTimePnl?: number
  tradesByTimeDay?: { entry_time: string; pnl: number }[]
  hasRealTimeData?: boolean
  bestTimeSlot?: { slot: string; winRate: number; trades: number } | null
  maxDailyTrades?: number
  revengeTradeCount?: number
  dqsScore?: number
  dqsFactors?: { name: string; score: number }[]
  hasMonthData?: boolean
  dqs?: { overall: number; grade: string | null; subScores: Record<string, number> }
  patterns?: { byTag: { label: string; count: number; cost: number }[]; totalMistakeCost: number; totalMistakeCount: number }
  latestAiCoaching?: string | null
}

function getMonthYear(): string {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

function getDisplayName(user: { firstName?: string | null; lastName?: string | null; username?: string | null; fullName?: string | null; primaryEmailAddress?: { emailAddress?: string } | null } | null | undefined): string {
  if (!user) return "Trader"
  const isOk = (s?: string | null) => {
    if (!s) return false
    const t = s.trim()
    if (!t) return false
    const l = t.toLowerCase()
    if (l.includes("tradesaath") || l.includes("trade saath") || l.includes("saathi")) return false
    if (l.includes("@")) return false
    if (/^\d+$/.test(t)) return false
    return true
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (isOk(user.firstName)) return cap((user.firstName as string).trim())
  if (isOk(user.fullName)) {
    const first = (user.fullName as string).split(" ")[0].trim()
    if (isOk(first)) return cap(first)
  }
  if (isOk(user.username)) return cap((user.username as string).trim())
  const email = user.primaryEmailAddress?.emailAddress
  if (email) {
    const prefix = email.split("@")[0]?.replace(/[._-]+/g, " ").replace(/\d+$/, "").trim()
    if (prefix && isOk(prefix)) return cap(prefix)
  }
  return "Trader"
}

function fmtPnl(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : ""
  return `${sign}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`
}

function fmtShortDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

const PATTERN_WHEN: Record<string, string> = {
  'Revenge Trading':    'After a losing trade, within minutes of the loss',
  'Revenge Trade':      'After a losing trade, within minutes of the loss',
  'Averaging Down':     'When a position moves against you by 1–2%',
  'Late Exit':          'When in profit but held past your target',
  'FOMO Entries':       'When you see price moving fast or others profiting',
  'FOMO Entry':         'When you see price moving fast or others profiting',
  'Panic Exits':        'When a position briefly moves against you',
  'Panic Exit':         'When a position briefly moves against you',
  'Overtrading':        'Late session, or after a strong start earlier in the day',
  'Oversized Position': 'After a winning streak: size creep from overconfidence',
  'Oversized':          'After a winning streak: size creep from overconfidence',
  'Vicious Cycle':      'A chain of emotional decisions, each making the next worse',
  'Decision Fatigue':   'After your 8th+ trade, or late afternoon',
}

const DIVIDER = (
  <hr style={{ border: "none", borderTop: "0.5px solid var(--color-border, #E5E2D9)", margin: 0 }} />
)

export default function DashboardPage() {
  const router = useRouter()
  const { isSignedIn, isLoaded, user } = useUser()
  const { isPro } = usePlan()
  const { pay, loading: payLoading } = useRazorpay()
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [payError, setPayError] = useState<string | null>(null)
  const [showStickyNav, setShowStickyNav] = useState(false)
  const [activeSection, setActiveSection] = useState('score')
  const obsRef = useRef<IntersectionObserver[]>([])

  function openCheckout(plan: string = "pro_monthly") {
    setPayError(null)
    pay({ plan, onSuccess: () => { window.location.href = "/upload" }, onError: (err) => setPayError(err) })
  }

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in")
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const autopay = params.get("autopay")
    if (!autopay) return
    const allowed = new Set(["single", "pro_monthly", "pro_yearly"])
    if (!allowed.has(autopay)) return
    window.history.replaceState({}, "", "/dashboard")
    openCheckout(autopay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (!isSignedIn) return
    fetch("/api/dashboard/stats")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { setStats(d); setLoading(false) })
      .catch((err) => {
        console.error("Dashboard stats fetch failed:", err)
        setLoading(false)
        import("@/components/ui/Toast").then(({ showToast }) => {
          showToast.error("Could not load dashboard data. Please refresh the page.")
        })
      })
  }, [isSignedIn])

  useEffect(() => {
    if (loading || !isSignedIn || !stats) return
    if (!stats.hasData) {
      try {
        const hasNewUserCookie = document.cookie.split(';').some(c => c.trim().startsWith('ts-new-user='))
        if (hasNewUserCookie) {
          document.cookie = 'ts-new-user=; max-age=0; path=/'
          import("@/components/ui/Toast").then(({ showToast }) => {
            showToast.success("Welcome to TradeSaath. Upload your first broker statement to get started.")
          })
        }
      } catch { /* non-blocking */ }
    }
  }, [loading, isSignedIn, stats])

  // Sticky nav scroll visibility
  useEffect(() => {
    const onScroll = () => setShowStickyNav(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sticky nav active section via IntersectionObserver
  useEffect(() => {
    if (!stats?.hasData || loading) return
    const ids = ['section-score', 'section-patterns', 'section-performance', 'section-activity']
    obsRef.current.forEach(o => o.disconnect())
    obsRef.current = []
    ids.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id.replace('section-', '')) },
        { threshold: 0.25 }
      )
      obs.observe(el)
      obsRef.current.push(obs)
    })
    return () => { obsRef.current.forEach(o => o.disconnect()) }
  }, [stats?.hasData, loading])

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        </div>
      </main>
    )
  }

  if (!loading && stats !== null && !stats.hasData) {
    return (<><Toaster /><FirstSessionGuide /></>)
  }

  const score = stats?.dqs?.overall ?? stats?.dqsScore ?? stats?.allTime?.disciplineScore ?? 0
  const factors = stats?.dqsFactors?.length ? stats.dqsFactors.map(f => ({ name: f.name, value: f.score })) : []

  const TAG_LABELS: Record<string, string> = {
    rvg: "Revenge Trading", fomo: "FOMO Entries", vs: "Vicious Cycle", avg: "Averaging Down",
    pnc: "Panic Exits", win: "Overconfidence After Wins", over: "Overtrading",
    size: "Oversized Position", late: "Late Exit",
    revenge_trading: "Revenge Trading", fomo_entry: "FOMO Entries", overtrading: "Overtrading",
  }

  const topMistake = stats?.mistakeTrades?.length ? stats.mistakeTrades[0] : null
  const lowest = factors.length > 0 ? factors.reduce((a, b) => (a.value < b.value ? a : b)) : null

  const INSIGHT_META: Record<string, { color: string }> = {
    "Revenge Trading": { color: "var(--color-loss)" }, "Revenge Trade": { color: "var(--color-loss)" },
    "FOMO Entries": { color: "var(--color-loss)" }, "FOMO Entry": { color: "var(--color-loss)" },
    "Panic Exits": { color: "var(--gold)" }, "Panic Exit": { color: "var(--gold)" },
    "Averaging Down": { color: "var(--color-loss)" }, "Overtrading": { color: "var(--gold)" },
    "Oversized Position": { color: "var(--color-loss)" }, "Oversized": { color: "var(--color-loss)" },
    "Late Exit": { color: "var(--gold)" }, "Vicious Cycle": { color: "var(--color-loss)" },
    "Decision Fatigue": { color: "var(--gold)" },
  }

  const patternMistakes = (stats?.patterns?.byTag || []).map(p => ({ type: p.label, count: p.count, cost: p.cost }))
  const hasPatternData = patternMistakes.length > 0 && patternMistakes.some(m => m.cost > 0)
  const mistakesForCalc = hasPatternData ? patternMistakes : (stats?.mistakeTrades || [])
  const totalCostForCalc = hasPatternData ? (stats?.patterns?.totalMistakeCost || 0) : (stats?.totalMistakeCost || 0)

  const insights = (stats?.patterns?.byTag || []).slice(0, 4).map(p => {
    const meta = INSIGHT_META[p.label] || { color: 'var(--gold)' }
    return { title: p.label, color: meta.color, desc: `${p.count} ${p.count === 1 ? 'trade' : 'trades'} flagged. Excess cost: ₹${Math.round(p.cost).toLocaleString('en-IN')}.` }
  })
  const insightsForBI = insights.length > 0 ? insights : (stats?.mistakeTrades || []).slice(0, 4).map(m => {
    const meta = INSIGHT_META[m.type] || { color: 'var(--gold)' }
    return { title: m.type, color: meta.color, desc: `${m.count} ${m.count === 1 ? 'trade' : 'trades'} flagged. Cost: ₹${Math.round(m.cost).toLocaleString('en-IN')}.` }
  })

  const isAnalysisPending = stats?.hasData === true && (stats.pendingAnalysisCount ?? 0) > 0

  // 4 rationalised KPI cards with delta sub-text
  const winRate = stats?.allTime?.winRate ?? stats?.month.winRate ?? 0
  const lastMonthWR = stats?.lastMonthWinRate ?? 0
  const wrDelta = lastMonthWR > 0 ? winRate - lastMonthWR : null

  // KPI 1 — P&L direction
  const pnlSub = stats?.lastMonthPnl !== undefined && stats.lastMonthPnl !== 0
    ? (stats.month.pnl > stats.lastMonthPnl
        ? `↑ Improving vs last month`
        : `↓ Down from last month`)
    : `${stats?.month.sessions || 0} sessions`
  const pnlSubColor = stats?.lastMonthPnl !== undefined && stats.lastMonthPnl !== 0
    ? (stats.month.pnl > stats.lastMonthPnl ? "var(--color-profit)" : "var(--color-loss)")
    : "var(--color-muted)"

  // KPI 2 — WR delta + cross-metric insight
  const wrCrossInsight = winRate > 50 && (stats?.month.pnl ?? 0) < 0
    ? "High WR. Check position sizing."
    : null

  // KPI 4 — Discipline percentile
  const disciplineLabel = score >= 72 ? "Top 10%" : score >= 58 ? "Above avg profitable" : score >= 41 ? "Above avg trader" : "Below average"
  const disciplineColor = score >= 58 ? "var(--color-profit)" : score >= 41 ? "var(--color-muted)" : "var(--color-loss)"

  const kpiCards = stats ? [
    {
      label: "This Month P&L",
      value: fmtPnl(stats.month.pnl),
      color: stats.month.pnl >= 0 ? "var(--green)" : "var(--red)",
      sub: pnlSub,
      subColor: pnlSubColor,
      sub2: `${stats.month.sessions} sessions`,
      sub2Color: "var(--color-muted)",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      color: winRate >= 50 ? "var(--green)" : "var(--red)",
      sub: wrDelta !== null
        ? (Math.abs(wrDelta) < 0.5
          ? 'Stable vs last month'
          : `${wrDelta > 0 ? '↑' : '↓'} ${wrDelta > 0 ? '+' : ''}${wrDelta.toFixed(1)}% vs last month`)
        : 'all-time',
      subColor: wrDelta !== null && Math.abs(wrDelta) >= 0.5
        ? (wrDelta > 0 ? "var(--color-profit)" : "var(--color-loss)")
        : "var(--color-muted)",
      sub2: wrCrossInsight,
      sub2Color: "var(--color-muted)",
    },
    {
      label: "Best Day P&L",
      value: fmtPnl(stats.allTime?.bestSessionPnl ?? stats.month.bestSessionPnl ?? 0),
      color: (stats.allTime?.bestSessionPnl ?? stats.month.bestSessionPnl ?? 0) >= 0 ? "var(--green)" : "var(--red)",
      sub: stats.allTime?.bestSessionDate ? `on ${fmtShortDate(stats.allTime.bestSessionDate)}` : '',
      subColor: "var(--color-muted)",
    },
    {
      label: "Discipline",
      value: String(score),
      color: "var(--color-ink)",
      sub: disciplineLabel,
      subColor: disciplineColor,
    },
  ] : []

  const NAV_SECTIONS = [
    { id: 'score',       label: 'Score' },
    { id: 'patterns',    label: 'Patterns' },
    { id: 'performance', label: 'Performance' },
    { id: 'activity',    label: 'Activity' },
  ]

  return (
    <>
      {/* Sticky sub-nav */}
      {showStickyNav && stats?.hasData && !loading && (
        <div className="dash-sticky-nav" style={{
          position: 'fixed', top: 'var(--nav-h, 52px)', left: 0, right: 0,
          height: 36, background: 'var(--color-canvas)',
          borderBottom: '0.5px solid var(--color-border)',
          zIndex: 40, display: 'flex', alignItems: 'center',
          opacity: showStickyNav ? 1 : 0, transition: 'opacity 0.2s',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', width: '100%' }}>
            {NAV_SECTIONS.map(({ id, label }) => (
              <button key={id}
                onClick={() => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  height: 36, padding: '0 16px', background: 'transparent', border: 'none',
                  borderBottom: activeSection === id ? '2px solid var(--color-ink)' : '2px solid transparent',
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400,
                  color: activeSection === id ? 'var(--color-ink)' : 'var(--color-muted)',
                  cursor: 'pointer', transition: 'color 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

    <main className="min-h-screen pb-16 px-4" style={{ background: "var(--bg)", paddingTop: showStickyNav && stats?.hasData && !loading ? 116 : 80 }}>
      <Toaster />
      <style>{`
        @keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @media(max-width:768px){
          .dash-hero-score{order:2}
          .dash-hero-issue{order:3}
          .dash-hero-before{order:1}
          .kpi-4-grid{grid-template-columns:repeat(2,1fr)!important}
          .dash-new-btn{width:100%!important;height:44px!important;justify-content:center}
          .kpi-val-lg{font-size:18px!important}
          .dash-sticky-nav{display:none!important}
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 4 }}>
        <ErrorBoundary name="BatchAnalysisRunner">
          <BatchAnalysisRunner autoStart slim onComplete={() => window.location.reload()} />
        </ErrorBoundary>
      </div>

      <div className="flex flex-col gap-5" style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header — name only, no time-of-day greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 style={{ fontFamily: "var(--font-display, 'DM Serif Display', serif)", fontSize: 28, fontWeight: 400, color: "var(--color-ink, #1A1F2E)", margin: 0 }}>
              {getDisplayName(user)}
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-muted, #888780)", marginTop: 4, marginBottom: 0 }}>
              <span style={{ fontFamily: "var(--font-mono)" }}>{(stats?.sessionCount || 0).toLocaleString("en-IN")}</span>
              {" sessions · "}
              <span style={{ fontFamily: "var(--font-mono)" }}>{(stats?.totalTrades || 0).toLocaleString("en-IN")}</span>
              {" trades"}
              {stats?.lastSessionDate
                ? <>{" · Last session: "}<span style={{ fontFamily: "var(--font-mono)" }}>{fmtShortDate(stats.lastSessionDate)}</span></>
                : <>{" · "}{getMonthYear()}</>
              }
            </p>
          </div>
          <button onClick={() => router.push("/upload")} className="btn btn-accent btn-sm shrink-0 dash-new-btn">
            New Analysis
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {stats?.hasData && !loading && (
          <>
            {/* AI coaching note — emoji removed */}
            {stats.latestAiCoaching && (
              <div className="rounded-xl border-l-4 px-4 py-3" style={{ background: "rgba(157,122,247,.05)", borderLeftColor: "var(--purple)", borderTop: "1px solid var(--border)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, color: "var(--purple)", fontFamily: "var(--font-sans)", marginBottom: 4 }}>
                    Saathi&apos;s take on your last session
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", margin: 0 }}>
                    {stats.latestAiCoaching}
                  </p>
                </div>
              </div>
            )}

            {/* 3-col hero — mobile order: Before You Trade first */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="dash-hero-score rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted, #888780)", marginBottom: 12 }}>Your Score</div>
                {(() => {
                  const ringColor = score >= 80 ? "#0F7A5A" : score >= 60 ? "var(--color-profit)" : score >= 40 ? "#C07B2A" : "var(--color-loss)"
                  const percentileLabel = score >= 72 ? "Top 10% of traders" : score >= 58 ? "Above profitable avg" : score >= 41 ? "Above avg trader" : "Below average"
                  const sparkPts = stats?.equityCurve?.slice(-20) || []
                  const sparkValues = sparkPts.map(p => Math.max(0, Math.min(100, 50 + (p.pnl / (Math.max(...sparkPts.map(x => Math.abs(x.pnl)), 1)) * 30))))
                  const showSparkline = sparkValues.length >= 3
                  const sparkMin = Math.min(...sparkValues)
                  const sparkMax = Math.max(...sparkValues)
                  const sparkRange = sparkMax - sparkMin || 1
                  const sparkW = 80, sparkH = 20
                  const sparkPolyline = sparkValues.map((v, i) => {
                    const x = (i / (sparkValues.length - 1)) * sparkW
                    const y = sparkH - ((v - sparkMin) / sparkRange) * sparkH
                    return `${x},${y}`
                  }).join(' ')
                  return (
                    <div className="flex flex-col items-center">
                      <div className="relative" style={{ cursor: 'pointer' }}
                        onClick={() => document.getElementById('section-score-detail')?.scrollIntoView({ behavior: 'smooth' })}>
                        <svg width="120" height="120" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--s3)" strokeWidth="8" />
                          <circle cx="60" cy="60" r="48" fill="none"
                            stroke={ringColor}
                            strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 48}
                            strokeDashoffset={2 * Math.PI * 48 - (score / 100) * 2 * Math.PI * 48}
                            transform="rotate(-90 60 60)"
                            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 400, color: ringColor }}>{score}</div>
                          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontFamily: "var(--font-sans)" }}>/ 100</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, marginTop: 6, color: ringColor, fontFamily: "var(--font-sans)", fontWeight: 400 }}>{percentileLabel}</div>
                      {showSparkline && (
                        <svg width={sparkW} height={sparkH} style={{ marginTop: 6 }}>
                          <polyline points={sparkPolyline} fill="none" stroke={ringColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {lowest && (
                        <div style={{ fontSize: 11, marginTop: 8, textAlign: "center", color: "var(--text2)", fontFamily: "var(--font-sans)" }}>
                          Weakest area: <strong style={{ color: "var(--color-loss)" }}>{lowest.name}</strong> at <span style={{ fontFamily: "var(--font-mono)" }}>{lowest.value}%</span>
                        </div>
                      )}
                      <Link href="/coach" style={{ fontSize: 11, marginTop: 6, color: "var(--accent)", fontFamily: "var(--font-sans)", fontWeight: 400, textDecoration: "none" }}>
                        Fix in Saathi →
                      </Link>
                    </div>
                  )
                })()}
              </div>

              <div className="dash-hero-issue rounded-xl border p-5 flex flex-col" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)" }}>Top Issue</div>
                  {(() => {
                    const thisM = stats?.topPatternThisMonth
                    const lastM = stats?.topPatternLastMonth
                    if (!thisM) return null
                    let trend: 'worsening' | 'improving' | 'stable' = 'stable'
                    if (lastM && lastM.count > 0) {
                      const ratio = thisM.count / lastM.count
                      if (ratio > 1.1) trend = 'worsening'
                      else if (ratio < 0.9) trend = 'improving'
                    } else if (thisM.count > 0 && !lastM) {
                      trend = 'worsening'
                    }
                    const trendColors = {
                      worsening: { bg: 'rgba(192,57,43,0.1)', border: 'rgba(192,57,43,0.3)', color: 'var(--color-loss)' },
                      improving: { bg: 'rgba(29,158,117,0.1)', border: 'rgba(29,158,117,0.3)', color: 'var(--color-profit)' },
                      stable: { bg: 'rgba(136,135,128,0.1)', border: 'rgba(136,135,128,0.3)', color: 'var(--color-muted)' },
                    }
                    const tc = trendColors[trend]
                    const labels = { worsening: 'Worsening', improving: 'Improving', stable: 'Stable' }
                    return (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 8px", borderRadius: 20, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color }}>
                        {labels[trend]}
                      </span>
                    )
                  })()}
                </div>
                <div className="flex-1 flex flex-col">
                  {topMistake ? (
                    <>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, color: "var(--color-loss)", marginBottom: 4 }}>
                        {TAG_LABELS[topMistake.type] || topMistake.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                      {stats?.topPatternThisMonth && stats.topPatternThisMonth.count > 0 ? (
                        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                          Cost you <span style={{ color: "var(--color-loss)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{fmtPnl(-stats.topPatternThisMonth.cost)}</span> this month (<span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{stats.topPatternThisMonth.count}</span> {stats.topPatternThisMonth.count === 1 ? "trade" : "trades"})
                        </div>
                      ) : stats?.topPatternThisMonth ? (
                        <div style={{ fontSize: 12, color: "var(--color-profit)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                          Clean month for this pattern
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                          Cost you <span style={{ color: "var(--color-loss)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{fmtPnl(-topMistake.cost)}</span> across <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{topMistake.count}</span> {topMistake.count === 1 ? "trade" : "trades"} all-time
                        </div>
                      )}
                      <hr style={{ border: "none", borderTop: "0.5px solid var(--color-border)", margin: "12px 0" }} />
                      <div style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 4 }}>
                        Your trigger
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-ink)", lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
                        {PATTERN_WHEN[TAG_LABELS[topMistake.type] || topMistake.type] ||
                         PATTERN_WHEN[topMistake.type] ||
                         "Review your last 10 flagged trades for the pattern"}
                      </div>
                    </>
                  ) : lowest ? (
                    <>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, marginBottom: 4, color: "var(--text)" }}>{lowest.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                        Weakest area at <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{lowest.value}%</span>. Improving this could lift your score by ~<span style={{ fontFamily: "var(--font-mono)" }}>{Math.round((100 - lowest.value) * 0.3)}</span> points.
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>Upload more sessions to discover your patterns</div>
                  )}
                  {isPro ? (
                    <Link href="/coach" style={{ fontSize: 12, fontWeight: 500, marginTop: "auto", paddingTop: 12, color: "var(--accent)", fontFamily: "var(--font-sans)" }}>
                      Fix this in Saathi &rarr;
                    </Link>
                  ) : (
                    <button type="button" disabled={payLoading} onClick={() => openCheckout("pro_monthly")}
                      style={{ fontSize: 12, fontWeight: 500, marginTop: "auto", paddingTop: 12, color: "var(--accent)", background: "transparent", border: "none", padding: 0, cursor: payLoading ? "wait" : "pointer", opacity: payLoading ? 0.6 : 1, textAlign: "left", fontFamily: "var(--font-sans)" }}>
                      {payLoading ? "Opening..." : "Upgrade to unlock Saathi →"}
                    </button>
                  )}
                  {payError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6, fontFamily: "var(--font-sans)" }}>{payError}</div>}
                </div>
              </div>

              <div className="dash-hero-before rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted, #888780)", marginBottom: 12 }}>Pre-Session</div>
                <ErrorBoundary name="PreMarketCheckin"><PreMarketCheckin compact /></ErrorBoundary>
              </div>
            </div>

            {/* 4 KPI cards — one row */}
            <div className="kpi-4-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {kpiCards.map((k) => (
                <div key={k.label} style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)", borderRadius: 10, padding: "14px 16px" }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted)", margin: "0 0 6px" }}>
                    {k.label}
                  </p>
                  <p className="kpi-val-lg" style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: k.color, margin: 0, lineHeight: 1 }}>
                    {k.value}
                  </p>
                  {k.sub && (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: k.subColor, margin: "4px 0 0", lineHeight: 1.3 }}>
                      {k.sub}
                    </p>
                  )}
                  {'sub2' in k && k.sub2 && (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 400, color: (k as { sub2Color?: string }).sub2Color || "var(--color-muted)", margin: "3px 0 0", lineHeight: 1.3, fontStyle: 'italic' }}>
                      {k.sub2}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {DIVIDER}

            {/* DQS breakdown */}
            <div id="section-score">
              <div id="section-score-detail">
                <ErrorBoundary name="TradeSaathScore"><TradeSaathScore score={score} factors={factors} equityCurve={stats.equityCurve} /></ErrorBoundary>
              </div>
            </div>

            {DIVIDER}

            {/* Equity curve + Heatmap */}
            <div id="section-performance">
              <ErrorBoundary name="EquityCurve"><DashboardEquityCurve equityCurve={stats.equityCurve} streaks={stats.streaks} risk={stats.risk} totalAllTimePnl={stats.actualAllTimePnl} /></ErrorBoundary>

              {DIVIDER}

              {/* Heatmap */}
              <ErrorBoundary name="Heatmap"><PerformanceHeatmap trades={stats.tradesByTimeDay || []} hasRealTimeData={stats.hasRealTimeData ?? true} /></ErrorBoundary>
            </div>

            {DIVIDER}

            {/* DQS + Mistake cost */}
            <div id="section-patterns" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isAnalysisPending && totalCostForCalc === 0 && mistakesForCalc.length === 0
                ? <div style={{ height: 280, borderRadius: 12, background: "#F1EFE8", animation: "sk-pulse 1.4s ease-in-out infinite" }} />
                : <ErrorBoundary name="MistakeCost"><MistakeCostCalculator totalCost={totalCostForCalc} counterfactualPnl={stats.counterfactualPnl || 0} actualPnl={stats.actualAllTimePnl ?? stats.actualMonthPnl ?? 0} mistakes={mistakesForCalc} pendingCount={stats.pendingAnalysisCount ?? 0} /></ErrorBoundary>
              }
              {isAnalysisPending && (stats.dqs?.overall ?? stats.dqsScore ?? 0) === 0
                ? <div style={{ height: 280, borderRadius: 12, background: "#F1EFE8", animation: "sk-pulse 1.4s ease-in-out infinite" }} />
                : <ErrorBoundary name="DQS"><DecisionQualityScore score={stats.dqs?.overall ?? stats.dqsScore ?? 0} grade={stats.dqs?.grade ?? null} factors={stats.dqsFactors || []} pendingCount={stats.pendingAnalysisCount ?? 0} /></ErrorBoundary>
              }
            </div>

            {DIVIDER}

            {isAnalysisPending && insightsForBI.length === 0
              ? <div style={{ height: 180, borderRadius: 12, background: "#F1EFE8", animation: "sk-pulse 1.4s ease-in-out infinite" }} />
              : <ErrorBoundary name="BehavioralInsights"><BehavioralInsights sessionCount={stats.sessionCount} insights={insightsForBI} pendingCount={stats.pendingAnalysisCount ?? 0} /></ErrorBoundary>
            }

            {DIVIDER}

            <ErrorBoundary name="RecentActivity"><RecentActivity recentTrades={stats.recentTrades || []} recentSessions={stats.recentSessions || []} /></ErrorBoundary>

            {DIVIDER}

            <ErrorBoundary name="GoalTracking"><GoalTracking winRate={stats.month.winRate} revengeTrades={stats.revengeTradeCount ?? 0} maxDailyTrades={stats.maxDailyTrades ?? 0} riskReward={parseFloat(stats.month.riskReward) || 0} /></ErrorBoundary>

            {DIVIDER}

            <ErrorBoundary name="SummaryCards"><SummaryCards today={stats.today} week={stats.week} month={{ pnl: stats.month.pnl, sessions: stats.month.sessions }} /></ErrorBoundary>
          </>
        )}
      </div>
    </main>
    </>
  )
}
