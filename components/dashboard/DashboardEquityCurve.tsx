"use client"

interface Props {
  equityCurve: { pnl: number; date: string }[]
  streaks: { current: number; bestWin: number; worstLoss: number }
  risk: { maxDrawdown: number; avgLossAvgWin: string }
}

export default function DashboardEquityCurve({ equityCurve, streaks, risk }: Props) {
  const maxAbs = Math.max(...equityCurve.map((d) => Math.abs(d.pnl)), 1)
  const barW = Math.max(8, Math.min(24, Math.floor(600 / equityCurve.length) - 2))

  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return sign + "₹" + Math.abs(Math.round(v)).toLocaleString("en-IN")
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Equity Curve */}
      <div className="md:col-span-2 rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Equity Curve — Last {equityCurve.length} Sessions</h3>
        <div className="flex items-end gap-[3px] h-[140px] overflow-x-auto">
          {equityCurve.map((d, i) => {
            const height = Math.max(6, (Math.abs(d.pnl) / maxAbs) * 100)
            return (
              <div
                key={i}
                className="rounded-t-sm flex-shrink-0 transition-all hover:opacity-70"
                style={{
                  width: barW,
                  height: height + "%",
                  background: d.pnl >= 0 ? "var(--green)" : "var(--red)",
                }}
                title={d.date + ": " + fmt(d.pnl)}
              />
            )
          })}
        </div>
      </div>

      {/* Streaks + Risk */}
      <div className="space-y-4">
        <div className="rounded-xl border p-4" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text)" }}>Streak Tracking</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text2)" }}>Current</span>
              <span className="font-jetbrains-mono font-bold" style={{ color: streaks.current > 0 ? "var(--green)" : "var(--red)" }}>
                {streaks.current > 0 ? streaks.current + "W" : Math.abs(streaks.current) + "L"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text2)" }}>Best Win Streak</span>
              <span className="font-jetbrains-mono font-bold" style={{ color: "var(--green)" }}>{streaks.bestWin}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text2)" }}>Worst Loss Streak</span>
              <span className="font-jetbrains-mono font-bold" style={{ color: "var(--red)" }}>{streaks.worstLoss}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text)" }}>Risk Management</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text2)" }}>Max Drawdown</span>
              <span className="font-jetbrains-mono font-bold" style={{ color: "var(--red)" }}>{fmt(-risk.maxDrawdown)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text2)" }}>Avg Loss / Avg Win</span>
              <span className="font-jetbrains-mono font-bold" style={{ color: "var(--text)" }}>{risk.avgLossAvgWin}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
