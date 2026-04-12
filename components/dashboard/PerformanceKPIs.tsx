"use client"

interface Props {
  month: {
    pnl: number
    winRate: number
    successRate: number
    riskReward: string
  }
  score: number
}

export default function PerformanceKPIs({ month, score }: Props) {
  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return sign + "₹" + Math.abs(Math.round(v)).toLocaleString("en-IN")
  }

  const kpis = [
    { label: "This Month Gross P&L", value: fmt(month.pnl), pos: month.pnl >= 0 },
    { label: "Win Rate", value: month.winRate + "%", pos: month.winRate >= 50 },
    { label: "Success Rate", value: month.successRate + "%", pos: month.successRate >= 50 },
    { label: "Risk:Reward", value: month.riskReward, pos: parseFloat(month.riskReward) >= 1 },
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
