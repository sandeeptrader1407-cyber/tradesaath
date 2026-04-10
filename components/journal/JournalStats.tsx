"use client"

interface Session {
  net_pnl: number
  win_rate: number
  trade_count: number
}

interface Props {
  sessions: Session[]
}

export default function JournalStats({ sessions }: Props) {
  const totalPnl = sessions.reduce((s, x) => s + Number(x.net_pnl || 0), 0)
  const avgWinRate = sessions.length > 0
    ? Math.round(sessions.reduce((s, x) => s + (x.win_rate || 0), 0) / sessions.length)
    : 0
  const bestSession = sessions.length > 0
    ? Math.max(...sessions.map((s) => Number(s.net_pnl || 0)))
    : 0

  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return `${sign}\u20B9${Math.abs(Math.round(v)).toLocaleString("en-IN")}`
  }

  const stats = [
    { label: "Cumulative P&L", value: fmt(totalPnl), pos: totalPnl >= 0 },
    { label: "Sessions", value: String(sessions.length), pos: true },
    { label: "Avg Win Rate", value: `${avgWinRate}%`, pos: avgWinRate >= 50 },
    { label: "Best Session", value: fmt(bestSession), pos: bestSession >= 0 },
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
