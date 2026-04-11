"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { usePlan } from "@/lib/hooks/usePlan"
import TradeSaathScore from "@/components/dashboard/TradeSaathScore"
import PreMarketCheckin from "@/components/dashboard/PreMarketCheckin"
import PerformanceKPIs from "@/components/dashboard/PerformanceKPIs"
import DashboardEquityCurve from "@/components/dashboard/DashboardEquityCurve"
import SummaryCards from "@/components/dashboard/SummaryCards"
import BehavioralInsights from "@/components/dashboard/BehavioralInsights"
import GoalTracking from "@/components/dashboard/GoalTracking"
import RecentActivity from "@/components/dashboard/RecentActivity"
import { ChatWrapper } from "@/components/chat/ChatWrapper"

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
  const { isSignedIn, isLoaded } = useUser()
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
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
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

  const score = stats?.hasData ? 45 : 0
  const factors = stats?.hasData ? [
    { name: "Entry Quality", value: 52 },
    { name: "Exit Timing", value: 38 },
    { name: "Position Sizing", value: 61 },
    { name: "Rule Following", value: 44 },
    { name: "Emotional Control", value: 30 },
  ] : []

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        <div className="rounded-xl border px-5 py-3 flex items-center justify-between" style={{
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

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
              {getGreeting()}, Trader
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
              {getMonthYear()} · {stats?.sessionCount || 0} sessions · {stats?.totalTrades || 0} trades analysed
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "var(--accent)", color: "#071a15", boxShadow: "0 0 20px rgba(62,232,196,.15)" }}
          >
            📂 New Analysis
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
            <TradeSaathScore score={score} factors={factors} />
            <PreMarketCheckin />

            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => router.push("/upload")} className="rounded-xl border p-4 text-center transition-all hover:border-[var(--accent)]" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-xl mb-1">📂</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>Add Trade</div>
              </button>
              <button onClick={() => router.push("/journal")} className="rounded-xl border p-4 text-center transition-all hover:border-[var(--accent)]" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-xl mb-1">📓</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>Open Journal</div>
              </button>
              <button onClick={() => router.push("/journal?tab=journey")} className="rounded-xl border p-4 text-center transition-all hover:border-[var(--accent)]" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-xl mb-1">🗺</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>Trading Journey</div>
              </button>
            </div>

            <PerformanceKPIs month={stats.month} score={score} />
            <DashboardEquityCurve equityCurve={stats.equityCurve} streaks={stats.streaks} risk={stats.risk} />
            <SummaryCards today={stats.today} week={stats.week} month={{ pnl: stats.month.pnl, sessions: stats.month.sessions }} />
            <BehavioralInsights sessionCount={stats.sessionCount} />
            <GoalTracking winRate={stats.month.winRate} revengeTrades={0} maxDailyTrades={0} riskReward={parseFloat(stats.month.riskReward) || 0} />
            <RecentActivity recentTrades={[]} recentSessions={[]} />
          </>
        )}
      </div>
      <ChatWrapper />
    </main>
  )
}
