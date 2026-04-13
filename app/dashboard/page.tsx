"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { usePlan } from "@/lib/planStore"
import Link from "next/link"
import TradeSaathScore from "@/components/dashboard/TradeSaathScore"
import PreMarketCheckin from "@/components/dashboard/PreMarketCheckin"
import PerformanceKPIs from "@/components/dashboard/PerformanceKPIs"
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
import CouponInput from "@/components/CouponInput"

interface DashStats {
  hasData: boolean
  sessionCount: number
  totalTrades: number
  month: {
    pnl: number
    sessions: number
    trades: number
    wins: number
    losses: number
    winRate: number
    successRate: number
    successRateScope?: string
    avgWin: number
    avgLoss: number
    riskReward: string
    riskRewardScope?: string
    bestSessionPnl?: number
    profitFactor?: number
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
  tradesByTimeDay?: { entry_time: string; pnl: number }[]
  dqsScore?: number
  dqsFactors?: { name: string; score: number }[]
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function getMonthYear(): string {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}

function getDisplayName(user: { firstName?: string | null; lastName?: string | null; username?: string | null; fullName?: string | null; primaryEmailAddress?: { emailAddress?: string } | null } | null | undefined): string {
  if (!user) return "Trader"
  // Block any name that looks like the app name, an email, or is empty
  const isOk = (s?: string | null) => {
    if (!s) return false
    const trimmed = s.trim()
    if (!trimmed) return false
    const lower = trimmed.toLowerCase()
    if (lower.includes("tradesaath") || lower.includes("trade saath") || lower.includes("saathi")) return false
    if (lower.includes("@")) return false // email address
    if (/^\d+$/.test(trimmed)) return false // pure digits
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

export default function DashboardPage() {
  const router = useRouter()
  const { isSignedIn, isLoaded, user } = useUser()
  const { isPro, isPaid } = usePlan()
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetailed, setShowDetailed] = useState(false)

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in")
    }
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (!isSignedIn) return
    fetch("/api/dashboard/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setStats(d); setLoading(false) })
      .catch((err) => {
        console.error("Dashboard stats fetch failed:", err)
        setLoading(false)
        import("@/components/ui/Toast").then(({ showToast }) => {
          showToast.error("Could not load dashboard data. Please refresh the page.")
        })
      })
  }, [isSignedIn])

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        </div>
      </main>
    )
  }

  const score = stats?.dqsScore || (stats?.hasData ? 45 : 0)
  const factors = stats?.dqsFactors?.length ? stats.dqsFactors.map(f => ({ name: f.name, value: f.score })) : (stats?.hasData ? [
    { name: "Entry Quality", value: 52 },
    { name: "Exit Timing", value: 38 },
    { name: "Position Sizing", value: 61 },
    { name: "Rule Following", value: 44 },
    { name: "Emotional Control", value: 30 },
  ] : [])

  const TAG_LABELS: Record<string, string> = {
    loss: "Taking Losses Poorly",
    rvg: "Revenge Trading",
    fomo: "FOMO Entries",
    vs: "Vicious Cycle",
    avg: "Averaging Down",
    pnc: "Panic Exits",
    win: "Overconfidence After Wins",
    revenge_trading: "Revenge Trading",
    fomo_entry: "FOMO Entries",
    overtrading: "Overtrading",
  }

  const topMistake = stats?.mistakeTrades?.length ? stats.mistakeTrades[0] : null
  const lowest = factors.length > 0 ? factors.reduce((a, b) => (a.value < b.value ? a : b)) : null

  const streakDir = stats?.streaks?.current
    ? stats.streaks.current > 0 ? "↑" : "↓"
    : "→"

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <Toaster />
      <div className="max-w-6xl mx-auto flex flex-col gap-5">

        <div className="rounded-xl border px-4 md:px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{
          background: isPaid ? "rgba(62,232,196,.06)" : "var(--s1)",
          borderColor: isPaid ? "var(--accent)" : "var(--border)",
        }}>
          <span className="text-sm" style={{ color: isPaid ? "var(--accent)" : "var(--text2)" }}>
            {isPro ? "⭐ Pro Plan Active" : isPaid ? "⭐ Single Report Plan" : "Free Plan — Upgrade for full features"}
          </span>
          {!isPaid && (
            <div className="flex items-center gap-3">
              <CouponInput compact />
              <a href="/#pricing" className="text-xs px-4 py-1.5 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "#071a15" }}>
                Upgrade {"→"}
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
              {getGreeting()}, {getDisplayName(user)}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
              {getMonthYear()} {"·"} {stats?.sessionCount || 0} {(stats?.sessionCount || 0) === 1 ? "session" : "sessions"} {"·"} {stats?.totalTrades || 0} trades analysed
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0"
            style={{ background: "var(--accent)", color: "#071a15" }}
          >
            {"📤"} New Analysis
          </button>
        </div>

        {!stats?.hasData && !loading && (
          <div className="rounded-xl border p-12 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
            <div className="text-5xl mb-4">{"📊"}</div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>Welcome to your Trading Dashboard</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text2)" }}>Upload your first trading session to see your performance insights, discipline score, and behavioral patterns.</p>
            <button
              onClick={() => router.push("/upload")}
              className="px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#071a15" }}
            >
              {"📋"} Upload First Session {"→"}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {stats?.hasData && !loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: "var(--text2)" }}>Your Score</div>
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--s3)" strokeWidth="8" />
                      <circle
                        cx="60" cy="60" r="48" fill="none"
                        stroke={score >= 60 ? "var(--green)" : score >= 40 ? "var(--gold)" : "var(--red)"}
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeDashoffset={2 * Math.PI * 48 - (score / 100) * 2 * Math.PI * 48}
                        transform="rotate(-90 60 60)"
                        style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: score >= 60 ? "var(--green)" : score >= 40 ? "var(--gold)" : "var(--red)" }}>{score}</div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>/ 100</div>
                    </div>
                  </div>
                  {lowest && (
                    <div className="text-xs mt-3 text-center" style={{ color: "var(--text2)" }}>
                      Drag: <strong style={{ color: "var(--red)" }}>{lowest.name}</strong> at {lowest.value}%
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: "var(--text2)" }}>Your #1 Issue</div>
                <div className="flex-1 flex flex-col justify-center">
                  {topMistake ? (
                    <>
                      <div className="text-2xl mb-2">{topMistake.icon}</div>
                      <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                        {TAG_LABELS[topMistake.type] || topMistake.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                      <div className="text-xs mb-3" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
                        Cost you <strong style={{ color: "var(--red)" }}>{fmtPnl(-topMistake.cost)}</strong> across{" "}
                        <strong>{topMistake.count}</strong> trades this month
                      </div>
                    </>
                  ) : lowest ? (
                    <>
                      <div className="text-2xl mb-2">{"⚠️"}</div>
                      <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                        {lowest.name}
                      </div>
                      <div className="text-xs mb-3" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
                        Your weakest area at <strong style={{ color: "var(--red)" }}>{lowest.value}%</strong>.{" "}
                        Improving this could lift your score by ~{Math.round((100 - lowest.value) * 0.3)} points.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl mb-2">{"📊"}</div>
                      <div className="text-xs" style={{ color: "var(--text2)", lineHeight: 1.6 }}>
                        Upload more sessions to discover your patterns
                      </div>
                    </>
                  )}
                  {isPro ? (
                    <Link href="/coach" className="text-xs font-semibold mt-auto" style={{ color: "var(--accent)" }}>
                      Fix this in Saathi {"→"}
                    </Link>
                  ) : (
                    <Link href="/#pricing" className="text-xs font-semibold mt-auto" style={{ color: "var(--accent)" }}>
                      Upgrade to unlock Saathi {"→"}
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: "var(--text2)" }}>Before You Trade</div>
                <ErrorBoundary name="PreMarketCheckin"><PreMarketCheckin compact /></ErrorBoundary>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "This Month Gross P&L", value: fmtPnl(stats.month.pnl), pos: stats.month.pnl >= 0 },
                { label: "Win Rate", value: `${stats.month.winRate}%`, pos: stats.month.winRate >= 50 },
                { label: "Sessions", value: String(stats.month.sessions), pos: true },
                { label: stats.month.sessions === 1 ? "Last Session" : "Best Day", value: fmtPnl(stats.month.bestSessionPnl || 0), pos: (stats.month.bestSessionPnl || 0) >= 0 },
                { label: "Discipline", value: `${score} ${streakDir}`, pos: score >= 50 },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border px-3 py-2.5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                  <div className="font-jetbrains-mono font-bold text-sm" style={{ color: s.pos ? "var(--green)" : "var(--red)" }}>{s.value}</div>
                  <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text2)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowDetailed(!showDetailed)}
                className="text-xs px-5 py-2 rounded-lg font-semibold transition-all"
                style={{ background: "var(--s2)", color: "var(--text2)", border: "1px solid var(--border)" }}
              >
                {showDetailed ? "📊 Hide detailed analytics ▲" : "📊 Show detailed analytics ▼"}
              </button>
            </div>

            {showDetailed && (
              <div className="flex flex-col gap-5">
                <ErrorBoundary name="TradeSaathScore"><TradeSaathScore score={score} factors={factors} /></ErrorBoundary>
                <ErrorBoundary name="PerformanceKPIs"><PerformanceKPIs month={stats.month} score={score} /></ErrorBoundary>
                <ErrorBoundary name="EquityCurve"><DashboardEquityCurve equityCurve={stats.equityCurve} streaks={stats.streaks} risk={stats.risk} /></ErrorBoundary>
                <ErrorBoundary name="Heatmap"><PerformanceHeatmap trades={stats.tradesByTimeDay || []} /></ErrorBoundary>
                <ErrorBoundary name="RecentActivity"><RecentActivity recentTrades={stats.recentTrades || []} recentSessions={stats.recentSessions || []} /></ErrorBoundary>
                <ErrorBoundary name="GoalTracking"><GoalTracking winRate={stats.month.winRate} revengeTrades={0} maxDailyTrades={0} riskReward={parseFloat(stats.month.riskReward) || 0} /></ErrorBoundary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ErrorBoundary name="MistakeCost"><MistakeCostCalculator
                    totalCost={stats.totalMistakeCost || 0}
                    counterfactualPnl={stats.counterfactualPnl || 0}
                    actualPnl={stats.actualMonthPnl || 0}
                    mistakes={stats.mistakeTrades || []}
                  /></ErrorBoundary>
                  <ErrorBoundary name="DQS"><DecisionQualityScore
                    score={stats.dqsScore || 0}
                    factors={stats.dqsFactors || []}
                  /></ErrorBoundary>
                </div>
                <ErrorBoundary name="BehavioralInsights"><BehavioralInsights sessionCount={stats.sessionCount} /></ErrorBoundary>
                <ErrorBoundary name="SummaryCards"><SummaryCards today={stats.today} week={stats.week} month={{ pnl: stats.month.pnl, sessions: stats.month.sessions }} /></ErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
