"use client"

import { useState, useEffect } from "react"
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
  recentTrades?: { time?: string; symbol?: string; side?: string; pnl?: number; tag?: string }[]
  recentSessions?: { date?: string; trades?: number; pnl?: number; winRate?: number }[]
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
    return { title: p.label, color: meta.color, desc: `${p.count} ${p.count === 1 ? 'trade' : 'trades'} flagged — excess cost ₹${Math.round(p.cost).toLocaleString('en-IN')}.` }
  })
  const insightsForBI = insights.length > 0 ? insights : (stats?.mistakeTrades || []).slice(0, 4).map(m => {
    const meta = INSIGHT_META[m.type] || { color: 'var(--gold)' }
    return { title: m.type, color: meta.color, desc: `${m.count} ${m.count === 1 ? 'trade' : 'trades'} flagged — cost ₹${Math.round(m.cost).toLocaleString('en-IN')}.` }
  })

  const isAnalysisPending = stats?.hasData === true && (stats.pendingAnalysisCount ?? 0) > 0

  // 4 rationalised KPI cards
  const kpiCards = stats ? [
    { label: "This Month P&L", value: fmtPnl(stats.month.pnl), color: stats.month.pnl >= 0 ? "var(--green)" : "var(--red)" },
    { label: "Win Rate", value: `${stats.allTime?.winRate ?? stats.month.winRate}%`, color: (stats.allTime?.winRate ?? stats.month.winRate) >= 50 ? "var(--green)" : "var(--red)" },
    { label: "Best Day P&L", value: fmtPnl(stats.allTime?.bestSessionPnl ?? stats.month.bestSessionPnl ?? 0), color: (stats.allTime?.bestSessionPnl ?? stats.month.bestSessionPnl ?? 0) >= 0 ? "var(--green)" : "var(--red)" },
    { label: "Discipline", value: String(score), color: "var(--color-ink, #1A1F2E)" },
  ] : []

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <Toaster />
      <style>{`
        @keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @media(max-width:768px){
          .dash-hero-score{order:2}
          .dash-hero-issue{order:3}
          .dash-hero-before{order:1}
          .kpi-4-grid{grid-template-columns:repeat(2,1fr)!important}
        }
      `}</style>

      <div className="max-w-6xl mx-auto" style={{ paddingTop: 4 }}>
        <ErrorBoundary name="BatchAnalysisRunner">
          <BatchAnalysisRunner autoStart slim onComplete={() => window.location.reload()} />
        </ErrorBoundary>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col gap-5">

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
              {" trades · "}
              {getMonthYear()}
            </p>
          </div>
          <button onClick={() => router.push("/upload")} className="btn btn-accent btn-sm shrink-0">
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
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--s3)" strokeWidth="8" />
                      <circle cx="60" cy="60" r="48" fill="none"
                        stroke={score >= 60 ? "var(--green)" : score >= 40 ? "var(--gold)" : "var(--red)"}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 - (score / 100) * 2 * Math.PI * 48}
                        transform="rotate(-90 60 60)"
                        style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 400, color: score >= 60 ? "var(--green)" : score >= 40 ? "var(--gold)" : "var(--red)" }}>{score}</div>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontFamily: "var(--font-sans)" }}>/ 100</div>
                    </div>
                  </div>
                  {lowest && (
                    <div style={{ fontSize: 12, marginTop: 10, textAlign: "center", color: "var(--text2)", fontFamily: "var(--font-sans)" }}>
                      Drag: <strong style={{ color: "var(--red)" }}>{lowest.name}</strong> at <span style={{ fontFamily: "var(--font-mono)" }}>{lowest.value}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="dash-hero-issue rounded-xl border p-5 flex flex-col" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted, #888780)", marginBottom: 12 }}>Top Issue</div>
                <div className="flex-1 flex flex-col justify-center">
                  {topMistake ? (
                    <>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, color: "var(--color-loss)", marginBottom: 4 }}>
                        {TAG_LABELS[topMistake.type] || topMistake.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                        Cost you <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{fmtPnl(-topMistake.cost)}</span> across <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{topMistake.count}</span> {topMistake.count === 1 ? "trade" : "trades"} all-time
                      </div>
                    </>
                  ) : lowest ? (
                    <>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, marginBottom: 4, color: "var(--text)" }}>{lowest.name}</div>
                      <div style={{ fontSize: 12, marginBottom: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                        Weakest area at <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{lowest.value}%</span>. Improving this could lift your score by ~<span style={{ fontFamily: "var(--font-mono)" }}>{Math.round((100 - lowest.value) * 0.3)}</span> points.
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>Upload more sessions to discover your patterns</div>
                  )}
                  {isPro ? (
                    <Link href="/coach" style={{ fontSize: 12, fontWeight: 500, marginTop: "auto", color: "var(--accent)", fontFamily: "var(--font-sans)" }}>
                      Fix this in Saathi &rarr;
                    </Link>
                  ) : (
                    <button type="button" disabled={payLoading} onClick={() => openCheckout("pro_monthly")}
                      style={{ fontSize: 12, fontWeight: 500, marginTop: "auto", color: "var(--accent)", background: "transparent", border: "none", padding: 0, cursor: payLoading ? "wait" : "pointer", opacity: payLoading ? 0.6 : 1, textAlign: "left", fontFamily: "var(--font-sans)" }}>
                      {payLoading ? "Opening..." : "Upgrade to unlock Saathi →"}
                    </button>
                  )}
                  {payError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6, fontFamily: "var(--font-sans)" }}>{payError}</div>}
                </div>
              </div>

              <div className="dash-hero-before rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div style={{ fontSize: 10, fontFamily: "var(--font-sans)", fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted, #888780)", marginBottom: 12 }}>Before You Trade</div>
                <ErrorBoundary name="PreMarketCheckin"><PreMarketCheckin compact /></ErrorBoundary>
              </div>
            </div>

            {/* 4 KPI cards — one row */}
            <div className="kpi-4-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {kpiCards.map((k) => (
                <div key={k.label} style={{ background: "#FFFFFF", border: "0.5px solid var(--color-border, #E5E2D9)", borderRadius: 10, padding: "14px 16px" }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-muted, #888780)", margin: "0 0 6px" }}>
                    {k.label}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: k.color, margin: 0, lineHeight: 1 }}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            {DIVIDER}

            {/* DQS breakdown */}
            <ErrorBoundary name="TradeSaathScore"><TradeSaathScore score={score} factors={factors} /></ErrorBoundary>

            {DIVIDER}

            {/* Equity curve */}
            <ErrorBoundary name="EquityCurve"><DashboardEquityCurve equityCurve={stats.equityCurve} streaks={stats.streaks} risk={stats.risk} /></ErrorBoundary>

            {DIVIDER}

            {/* Heatmap */}
            <ErrorBoundary name="Heatmap"><PerformanceHeatmap trades={stats.tradesByTimeDay || []} hasRealTimeData={stats.hasRealTimeData ?? true} /></ErrorBoundary>

            {DIVIDER}

            {/* DQS + Mistake cost */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
  )
}
