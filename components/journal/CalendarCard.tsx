"use client"

import { useState, useEffect } from "react"

interface Session {
  trade_date: string
  net_pnl: number
}

interface Props {
  sessions: Session[]
  onSelectDate: (date: string) => void
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function latestSessionMonth(sessions: Session[]): Date {
  const today = new Date()
  if (!sessions || sessions.length === 0) return today
  let latest = 0
  for (const s of sessions) {
    if (!s.trade_date) continue
    const t = new Date(s.trade_date + "T12:00:00").getTime()
    if (!Number.isNaN(t) && t > latest) latest = t
  }
  if (latest === 0) return today
  const d = new Date(latest)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function CalendarCard({ sessions, onSelectDate }: Props) {
  const [viewDate, setViewDate] = useState<Date>(() => latestSessionMonth(sessions))
  const [autoJumped, setAutoJumped] = useState(false)

  // If sessions load after mount (async fetch), jump to their latest month once
  useEffect(() => {
    if (autoJumped) return
    if (!sessions || sessions.length === 0) return
    const target = latestSessionMonth(sessions)
    setViewDate(target)
    setAutoJumped(true)
  }, [sessions, autoJumped])
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  // Normalize date string to YYYY-MM-DD with zero-padded month/day
  const normalizeDate = (d: string): string => {
    const parts = d.split("-")
    if (parts.length !== 3) return d
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
  }

  // Build date->pnl+count map
  const dateMap = new Map<string, { pnl: number; count: number }>()
  for (const s of sessions) {
    if (s.trade_date) {
      const key = normalizeDate(s.trade_date)
      const existing = dateMap.get(key) || { pnl: 0, count: 0 }
      dateMap.set(key, { pnl: existing.pnl + Number(s.net_pnl || 0), count: existing.count + 1 })
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
          const entry = dateMap.get(dateStr)
          const pnl = entry?.pnl ?? 0
          const sessionCount = entry?.count ?? 0
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const hasData = entry !== undefined

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
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: pnl >= 0 ? "var(--green)" : "var(--red)" }}
                  />
                  {sessionCount > 1 && (
                    <span className="text-[7px] font-bold leading-none" style={{ color: "var(--muted)" }}>{sessionCount}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
