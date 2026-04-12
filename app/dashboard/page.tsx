"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { usePlan } from "@/lib/planStore"
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
    avgWin: number
    avgLoss: number
    riskReward: string
  }
  week: { pnl: number; sessions: number; trades: number }
  today: { pnl: number; sessions: number }
  equityCurve: { pnl: number; date: string }[]
  streaks: { current: number; bestWin: number; worstLoss: number }
  risk: { maxDrawdown: number; avgLossAvgWin: string }
  // New fields for dashboard components
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

export default function DashboardPage() {
  const router = useRouter()
  const { isSignedIn, isLoaded, user } = useUser()
  const { isPro, isPaid } = usePlan()
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)

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
        // Import dynamically to avoid circular deps
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

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <Toaster />
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        <div className="rounded-xl border px-4 md:px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{
          background: isPaid ? "rgba(62,232,196,.06)" : "var(--s1)",
          borderColor: isPaid ? "var(--accent)" : "var(--border)",
        }}>
          <span className="text-sm" style={{ color: isPaid ? "var(--accent)" : "var(--text2)" }}>
            {isPro ? "⭐ Pro Plan Active" : isPaid ? "⭐ Single Report Plan" : "Free Plan — Upgrade for full features"}
          </span>
          {!isPaid && (
            <a href="/#pricing" className="text-xs px-4 py-1.5 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "#071a15" }}>
              Upgrade →
            </a>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
              {getGreeting()}, {user?.firstName || "Trader"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
              {getMonthYear()} · {stats?.sessionCount || 0} sessions · {stats?.totalTrades || 0} trades analysed
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0"
            style={{ background: "var(--accent)", color: "#071a15" }}
          >
            📤 New Analysis
          </button>
        </div>

        {!stats?.hasData && !loading && (
          <div className="rounded-xl border p-12 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>Welcome to your Trading Dashboard</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text2)" }}>Upload your first trading session to see your performance insights, discipline score, and behavioral patterns.</p>
            <button
              onClick={() => router.push("/upload")}
              className="px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#071a15" }}
            >
              📂 Upload First Session →
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
            <ErrorBoundary name="TradeSaathScore"><TradeSaathScore score={score} factors={factors} /></ErrorBoundary>
            <ErrorBoundary name="PreMarketCheckin"><PreMarketCheckin /></ErrorBoundary>

            <ErrorBoundary name="PerformanceKPIs"><PerformanceKPIs month={stats.month} score={score} /></ErrorBoundary>
            <ErrorBoundary name="EquityCurve"><DashboardEquityCurve equityCurve={stats.equityCurve} streaks={stats.streaks} risk={stats.risk} /></ErrorBoundary>
            <ErrorBoundary name="SummaryCards"><SummaryCards today={stats.today} week={stats.week} month={{ pnl: stats.month.pnl, sessions: stats.month.sessions }} /></ErrorBoundary>
            <ErrorBoundary name="BehavioralInsights"><BehavioralInsights sessionCount={stats.sessionCount} /></ErrorBoundary>
            <ErrorBoundary name="GoalTracking"><GoalTracking winRate={stats.month.winRate} revengeTrades={0} maxDailyTrades={0} riskReward={parseFloat(stats.month.riskReward) || 0} /></ErrorBoundary>
            <ErrorBoundary name="RecentActivity"><RecentActivity recentTrades={stats.recentTrades || []} recentSessions={stats.recentSessions || []} /></ErrorBoundary>

            {/* Pro Analytics Section */}
            <ErrorBoundary name="Heatmap"><PerformanceHeatmap trades={stats.tradesByTimeDay || []} /></ErrorBoundary>
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
          </>
        )}
      </div>
    </main>
  )
}
