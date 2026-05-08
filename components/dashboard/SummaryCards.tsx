"use client"

import { formatPnl } from "@/lib/format/money"

interface Props {
  today: { pnl: number; sessions: number }
  week: { pnl: number; sessions: number }
  month: { pnl: number; sessions: number }
}

export default function SummaryCards({ today, week, month }: Props) {
  const fmt = formatPnl

  const cards = [
    { label: "Today (Gross P&L)", pnl: today.pnl, sessions: today.sessions, empty: "No session yet" },
    { label: "This Week (Gross P&L)", pnl: week.pnl, sessions: week.sessions, empty: "No sessions this week" },
    { label: "This Month (Gross P&L)", pnl: month.pnl, sessions: month.sessions, empty: "No sessions this month" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <div className="text-[11px] sm:text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>{c.label}</div>
          {c.sessions > 0 ? (
            <div>
              <div className="font-jetbrains-mono font-bold text-2xl" style={{ color: c.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                {fmt(c.pnl)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text2)" }}>{c.sessions} session{c.sessions > 1 ? "s" : ""}</div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--text2)" }}>{c.empty}</div>
          )}
        </div>
      ))}
    </div>
  )
}
