"use client"

import { useState, useEffect } from "react"

interface Session {
  trade_date: string
  net_pnl: number
}

interface Props {
  sessions: Session[]
  onSelectDate: (date: string) => void
  activeDate?: string | null
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

export default function CalendarCard({ sessions, onSelectDate, activeDate }: Props) {
  const [viewDate, setViewDate] = useState<Date>(() => latestSessionMonth(sessions))
  const [autoJumped, setAutoJumped] = useState(false)

  useEffect(() => {
    if (autoJumped) return
    if (!sessions || sessions.length === 0) return
    const target = latestSessionMonth(sessions)
    setViewDate(target)
    setAutoJumped(true)
  }, [sessions, autoJumped])

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const normalizeDate = (d: string): string => {
    const parts = d.split("-")
    if (parts.length !== 3) return d
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
  }

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

  const normalizedActive = activeDate ? normalizeDate(activeDate) : null

  return (
    <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', padding: '14px', marginBottom: 10 }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button
          onClick={prevMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-muted)', padding: '10px 14px', lineHeight: 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          &lsaquo;
        </button>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)' }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-muted)', padding: '10px 14px', lineHeight: 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          &rsaquo;
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center" style={{ marginBottom: 4 }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            fontSize: 11,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-muted)',
            paddingBottom: 4,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const entry = dateMap.get(dateStr)
          const pnl = entry?.pnl ?? 0
          const sessionCount = entry?.count ?? 0
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const isActive = normalizedActive === dateStr
          const hasData = entry !== undefined

          return (
            <div
              key={dateStr}
              onClick={() => hasData && onSelectDate(dateStr)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: hasData ? 500 : 400,
                paddingTop: 6,
                paddingBottom: 6,
                minHeight: 36,
                borderRadius: 6,
                cursor: hasData ? 'pointer' : 'default',
                // Active selected day: dark bg, light text
                background: isActive ? 'var(--color-ink)' : 'transparent',
                color: isActive
                  ? 'var(--color-canvas)'
                  : hasData
                    ? 'var(--color-ink)'
                    : 'var(--color-muted)',
                // Today: accent border (only when not already selected)
                outline: isToday && !isActive ? '1.5px solid var(--accent)' : 'none',
                outlineOffset: '-1px',
              }}
            >
              {day}
              {hasData && !isActive && (
                <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <div style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                  }} />
                  {sessionCount > 1 && (
                    <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', lineHeight: 1 }}>
                      {sessionCount}
                    </span>
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
