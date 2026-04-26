"use client"

import { useMemo } from "react"

interface Trade {
  entry_time: string
  exit_time?: string
  pnl: number
}

interface Props {
  trades?: Trade[]
  hasRealTimeData?: boolean
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

function getSlotKey(time: string): string | null {
  try {
    const timeMatch = time.match(/T(\d{1,2}):(\d{2})/)
    if (!timeMatch) return null
    const h = Number(timeMatch[1])
    const m = Number(timeMatch[2])
    const slotMin = m < 30 ? 0 : 30
    return `${String(h).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`
  } catch {
    return null
  }
}

function getDayName(time: string): string | null {
  try {
    const dateMatch = time.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!dateMatch) return null
    const [, y, mo, d] = dateMatch
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0))
    const day = dt.getUTCDay() // 0=Sun
    return ALL_DAYS[day === 0 ? 6 : day - 1] // remap: 0=Sun->6, 1=Mon->0, etc.
  } catch {
    return null
  }
}

function cellColor(winRate: number | null): string {
  if (winRate === null) return "rgba(255,255,255,.04)"
  if (winRate > 60) return "rgba(34,197,94,.45)"
  if (winRate >= 40) return "rgba(234,179,8,.4)"
  return "rgba(239,68,68,.4)"
}

export default function PerformanceHeatmap({ trades = [], hasRealTimeData = true }: Props) {
  const { days, slots, grid } = useMemo(() => {
    // Discover days and time slots from actual data
    const daySet = new Set<string>()
    const slotSet = new Set<string>()

    for (const t of trades) {
      const day = getDayName(t.entry_time)
      const slot = getSlotKey(t.entry_time)
      if (day) daySet.add(day)
      if (slot) slotSet.add(slot)
    }

    // Sort days in Mon-Sun order, only include days with data
    const dayOrder = ALL_DAYS as readonly string[]
    const activeDays = dayOrder.filter(d => daySet.has(d))
    // If no days found, default to Mon-Fri
    const days = activeDays.length > 0 ? activeDays : ["Mon", "Tue", "Wed", "Thu", "Fri"]

    // Sort slots chronologically, only include slots with data
    const activeSlots = Array.from(slotSet).sort()
    // If no slots, use sensible defaults
    const slots = activeSlots.length > 0 ? activeSlots : [
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
      "15:00", "15:30",
    ]

    // Build grid: grid[dayIdx][slotIdx] = { wins, total }
    const g: { wins: number; total: number }[][] = days.map(() =>
      slots.map(() => ({ wins: 0, total: 0 }))
    )

    for (const t of trades) {
      const day = getDayName(t.entry_time)
      const slot = getSlotKey(t.entry_time)
      if (!day || !slot) continue
      const di = days.indexOf(day)
      const si = slots.indexOf(slot)
      if (di < 0 || si < 0) continue
      g[di][si].total++
      if (t.pnl > 0) g[di][si].wins++
    }

    return { days, slots, grid: g }
  }, [trades])

  const hasData = trades.length >= 5

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>
          Performance Heatmap
        </h2>
        <span style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 20,
          background: 'var(--color-ink)', color: 'var(--color-canvas)',
        }}>PRO</span>
      </div>

      {!hasData ? (
        <div className="text-center py-10">
          <p className="t-h3" style={{ marginBottom: 6, color: 'var(--color-ink)' }}>No time data.</p>
          <p className="t-caption" style={{ color: "var(--color-muted)" }}>
            {!hasRealTimeData
              ? "Time data not available in uploaded files."
              : "Needs at least 5 trades to generate heatmap."}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {!hasRealTimeData
              ? "Upload tradebooks with entry/exit times for detailed time analysis."
              : "Upload more sessions to see your best trading windows."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: Math.max(400, slots.length * 44 + 48), display: "grid", gridTemplateColumns: `48px repeat(${slots.length}, 1fr)`, gap: 3 }}>
              {/* Header row */}
              <div />
              {slots.map((s) => (
                <div key={s} style={{
                  fontSize: 9, color: "var(--muted)", textAlign: "center",
                  fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap",
                }}>
                  {s}
                </div>
              ))}

              {/* Data rows */}
              {days.map((day, di) => (
                <>
                  <div key={`label-${day}`} style={{
                    fontSize: 11, color: "var(--text2)", display: "flex",
                    alignItems: "center", fontWeight: 600,
                  }}>
                    {day}
                  </div>
                  {slots.map((_, si) => {
                    const cell = grid[di][si]
                    const wr = cell.total > 0 ? (cell.wins / cell.total) * 100 : null
                    const lowConfidence = cell.total > 0 && cell.total < 3
                    return (
                      <div
                        key={`${day}-${si}`}
                        title={wr !== null
                          ? `${Math.round(wr)}% win rate (${cell.total} trade${cell.total === 1 ? '' : 's'})${lowConfidence ? ' \u2014 low sample' : ''}`
                          : "No trades in this slot"}
                        style={{
                          background: cellColor(wr),
                          borderRadius: 4,
                          height: 28,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9,
                          color: wr !== null
                            ? (lowConfidence ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.8)")
                            : "rgba(255,255,255,.15)",
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: "default",
                          transition: "transform .15s",
                        }}
                      >
                        {wr !== null ? `${Math.round(wr)}%` : "\u2014"}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>

          {/* Mobile scroll hint */}
          <p className="heatmap-scroll-hint" style={{ display: 'none', fontSize: 11, fontFamily: 'var(--font-sans)', color: '#888780', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>
            &#8592; Scroll to see full heatmap &#8594;
          </p>
          {/* Legend */}
          <div className="flex items-center flex-wrap gap-3 sm:gap-4 mt-4" style={{ fontSize: 10, color: "var(--text2)" }}>
            <span className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(239,68,68,.4)", display: "inline-block" }} />
              {"<40%"}
            </span>
            <span className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(234,179,8,.4)", display: "inline-block" }} />
              40-60%
            </span>
            <span className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(34,197,94,.45)", display: "inline-block" }} />
              {">60%"}
            </span>
            <span className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,.04)", display: "inline-block", border: "1px solid rgba(255,255,255,.08)" }} />
              No data
            </span>
          </div>
        </>
      )}
    </div>
  )
}
