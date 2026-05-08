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
  bestTimeSlot?: { slot: string; winRate: number; trades: number } | null
}

export default function PerformanceKPIs({ month, score, hasMonthData, allTime, bestTimeSlot }: Props) {
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
    { label: "Best Time", value: bestTimeSlot ? `${bestTimeSlot.slot}–${(() => { const [h, m] = bestTimeSlot.slot.split(':').map(Number); const nm = m + 30; return nm >= 60 ? `${String(h + 1).padStart(2, '0')}:${String(nm - 60).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(nm).padStart(2, '0')}` })()}` : "—", pos: bestTimeSlot ? bestTimeSlot.winRate >= 50 : false },
  ]

  return (
    <div className="gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
      {kpis.map((k) => (
        <div key={k.label} className="p-4 rounded-xl border" style={{ background: "var(--s1)", borderColor: "var(--border)", minWidth: 0 }}>
          <div className="font-jetbrains-mono font-bold" style={{ color: k.pos ? "var(--green)" : "var(--red)", fontSize: 'clamp(14px, 4.5vw, 18px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>
            {k.value}
          </div>
          <div className="text-[10px] sm:text-[9px] uppercase tracking-widest mt-1" style={{ color: "var(--text2)" }}>{k.label}</div>
        </div>
      ))}
    </div>
  )
}
