"use client"

import { useState } from "react"

interface Session {
  trade_date: string
  net_pnl: number
}

interface Props {
  sessions: Session[]
  onSelectDate: (date: string) => void
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

export default function CalendarCard({ sessions, onSelectDate }: Props) {
  const [viewDate, setViewDate] = useState(new Date())
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  // Build date->pnl map
  const dateMap = new Map<string, number>()
  for (const s of sessions) {
    if (s.trade_date) {
      const existing = dateMap.get(s.trade_date) || 0
      dateMap.set(s.trade_date, existing + Number(s.net_pnl || 0))
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const monthLabel = viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="rounded-xl border p-4 mb-3" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text2)" }}>&lsaquo;</button>
        <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{monthLabel}</span>
        <button onClick={nextMonth} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text2)" }}>&rsaquo;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d) => (
          <div key={d} className="text-[10px] sm:text-[9px] py-1" style={{ color: "var(--muted)" }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const pnl = dateMap.get(dateStr)
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const hasData = pnl !== undefined

          return (
            <div
              key={dateStr}
              onClick={() => hasData && onSelectDate(dateStr)}
              className="relative flex items-center justify-center text-[10px] py-1.5 rounded cursor-pointer transition-all"
              style={{
                color: isToday ? "var(--accent)" : hasData ? "var(--text)" : "var(--muted)",
                fontWeight: isToday || hasData ? 600 : 400,
                background: isToday ? "rgba(62,232,196,.08)" : "transparent",
              }}
            >
              {day}
              {hasData && (
                <div
                  className="absolute bottom-0.5 w-1 h-1 rounded-full"
                  style={{ background: pnl >= 0 ? "var(--green)" : "var(--red)" }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
