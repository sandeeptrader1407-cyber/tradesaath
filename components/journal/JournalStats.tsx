"use client"

import { computeKPIs } from '@/lib/kpi/computeKPIs'

interface Session {
  net_pnl: number
  win_rate: number
  trade_count: number
  win_count?: number
  loss_count?: number
}

interface Props {
  sessions: Session[]
}

export default function JournalStats({ sessions }: Props) {
  const kpis = computeKPIs(sessions)

  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : "-"
    return `${sign}\u20B9${Math.abs(Math.round(v)).toLocaleString("en-IN")}`
  }

  const stats = [
    { label: "Cumulative P&L", value: fmt(kpis.totalPnl), pos: kpis.totalPnl >= 0 },
    { label: "Sessions", value: String(kpis.totalSessions), pos: true },
    { label: "Win Rate", value: `${kpis.winRate}%`, pos: kpis.winRate >= 50 },
    { label: "Best Day P&L", value: fmt(kpis.bestSessionPnl), pos: kpis.bestSessionPnl >= 0 },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {stats.map((s) => (
        <div key={s.label} className="p-3 rounded-xl border" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <div className="font-jetbrains-mono font-bold text-lg" style={{ color: s.pos ? "var(--green)" : "var(--red)" }}>
            {s.value}
          </div>
          <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: "var(--text2)" }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}
