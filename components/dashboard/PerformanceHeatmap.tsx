"use client"

import { useMemo } from "react"

interface Trade {
  entry_time: string
  exit_time?: string
  pnl: number
}

interface Props {
  trades?: Trade[]
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const
const SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30",
] as const

function getSlot(time: string): string | null {
  try {
    // Parse HH:MM directly from the string to avoid timezone drift
    // Format expected: "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DDTHH:MM"
    const timeMatch = time.match(/T(\d{1,2}):(\d{2})/)
    if (!timeMatch) return null
    const h = Number(timeMatch[1])
    const m = Number(timeMatch[2])
    if (h < 9 || h > 15) return null
    if (h === 15 && m > 30) return null
    const slotMin = m < 30 ? 0 : 30
    return `${String(h).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`
  } catch {
    return null
  }
}

function getDayIndex(time: string): number {
  try {
    // Extract just the date part (YYYY-MM-DD) to avoid timezone shifts
    // Format expected: "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DD"
    const dateMatch = time.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!dateMatch) return -1
    const [, y, m, d] = dateMatch
    // Use noon UTC for the given calendar date — timezone-independent weekday
    const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0))
    const day = dt.getUTCDay() // 0=Sun
    if (day === 0 || day === 6) return -1
    return day - 1 // 0=Mon
  } catch {
    return -1
  }
}

function cellColor(winRate: number | null): string {
  if (winRate === null) return "rgba(255,255,255,.04)"
  if (winRate > 60) return "rgba(34,197,94,.45)"
  if (winRate >= 40) return "rgba(234,179,8,.4)"
  return "rgba(239,68,68,.4)"
}

export default function PerformanceHeatmap({ trades = [] }: Props) {
  const grid = useMemo(() => {
    // grid[dayIdx][slotIdx] = { wins, total }
    const g: { wins: number; total: number }[][] = DAYS.map(() =>
      SLOTS.map(() => ({ wins: 0, total: 0 }))
    )
    for (const t of trades) {
      const slot = getSlot(t.entry_time)
      const dayIdx = getDayIndex(t.entry_time)
      if (!slot || dayIdx < 0) continue
      const slotIdx = SLOTS.indexOf(slot as typeof SLOTS[number])
      if (slotIdx < 0) continue
      g[dayIdx][slotIdx].total++
      if (t.pnl > 0) g[dayIdx][slotIdx].wins++
    }
    return g
  }, [trades])

  const hasData = trades.length >= 5

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-base font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
          Performance Heatmap
        </h2>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
          padding: "2px 8px", borderRadius: 6,
          background: "rgba(62,232,196,.12)", color: "var(--accent)",
        }}>PRO</span>
      </div>

      {!hasData ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-3">🗓️</div>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            Needs at least 5 trades to generate heatmap.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Upload more sessions to see your best trading windows.
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 600, display: "grid", gridTemplateColumns: `48px repeat(${SLOTS.length}, 1fr)`, gap: 3 }}>
              {/* Header row */}
              <div />
              {SLOTS.map((s) => (
                <div key={s} style={{
                  fontSize: 9, color: "var(--muted)", textAlign: "center",
                  fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap",
                }}>
                  {s}
                </div>
              ))}

              {/* Data rows */}
              {DAYS.map((day, di) => (
                <>
                  <div key={`label-${day}`} style={{
                    fontSize: 11, color: "var(--text2)", display: "flex",
                    alignItems: "center", fontWeight: 600,
                  }}>
                    {day}
                  </div>
                  {SLOTS.map((_, si) => {
                    const cell = grid[di][si]
                    const wr = cell.total > 0 ? (cell.wins / cell.total) * 100 : null
                    return (
                      <div
                        key={`${day}-${si}`}
                        title={wr !== null ? `${Math.round(wr)}% win rate (${cell.total} trades)` : "No data"}
                        style={{
                          background: cellColor(wr),
                          borderRadius: 4,
                          height: 28,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: wr !== null ? "rgba(255,255,255,.8)" : "transparent",
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: "default",
                          transition: "transform .15s",
                        }}
                      >
                        {wr !== null ? `${Math.round(wr)}%` : ""}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>

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
