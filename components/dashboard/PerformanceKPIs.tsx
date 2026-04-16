"use client"

interface Props {
  month: {
    pnl: number
    winRate: number
    successRate: number
    riskReward: string
  }
  score: number
  hasMonthData?: boolean
  allTime?: {
    pnl: number
    winRate: number
    successRate?: number
    riskReward: string
  }
}

export default function PerformanceKPIs({ month, score, hasMonthData, allTime }: Props) {
  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return sign + "₹" + Math.abs(Math.round(v)).toLocaleString("en-IN")
  }

  // If no data this month, fall back to all-time so the widget never shows zeros.
  const useAllTime = !hasMonthData && !!allTime
  const source = useAllTime && allTime
    ? {
        pnl: allTime.pnl,
        winRate: allTime.winRate,
        successRate: allTime.successRate ?? 0,
        riskReward: allTime.riskReward,
      }
    : month
  const scopeLabel = useAllTime ? "All-Time" : "This Month"

  const kpis = [
    { label: `${scopeLabel} Gross P&L`, value: fmt(source.pnl), pos: source.pnl >= 0 },
    { label: "Win Rate", value: source.winRate + "%", pos: source.winRate >= 50 },
    { label: "Success Rate", value: source.successRate + "%", pos: source.successRate >= 50 },
    { label: "Risk:Reward", value: source.riskReward, pos: parseFloat(source.riskReward) >= 1 },
    { label: "Discipline", value: String(score), pos: score >= 50 },
    { label: "Best Time", value: "09:20–10:15", pos: true },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((k) => (
        <div key={k.label} className="p-4 rounded-xl border" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <div className="font-jetbrains-mono font-bold text-lg" style={{ color: k.pos ? "var(--green)" : "var(--red)" }}>
            {k.value}
          </div>
          <div className="text-[10px] sm:text-[9px] uppercase tracking-widest mt-1" style={{ color: "var(--text2)" }}>{k.label}</div>
        </div>
      ))}
    </div>
  )
}
