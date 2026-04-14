"use client"

import { useState } from "react"
import { formatPnl } from "@/lib/format/money"

interface Session {
  id: string
  trade_date: string
  detected_market: string
  trade_count: number
  net_pnl: number
  win_count: number
  loss_count: number
}

interface Props {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
}

export default function SessionList({ sessions, activeId, onSelect }: Props) {
  const [search, setSearch] = useState("")

  const filtered = sessions.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (s.trade_date || "").toLowerCase().includes(q) ||
      (s.detected_market || "").toLowerCase().includes(q)
    )
  })

  const fmt = formatPnl

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Sessions</h3>
          <span className="text-[10px] font-jetbrains-mono" style={{ color: "var(--muted)" }}>{sessions.length}</span>
        </div>
        <input
          type="text"
          placeholder="Search date, market..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs px-3 py-2 rounded-lg border"
          style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }}
        />
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "60vh" }}>
        {filtered.length === 0 && (
          <div className="p-4 text-center text-xs" style={{ color: "var(--muted)" }}>
            No sessions found
          </div>
        )}
        {filtered.map((s) => {
          const isActive = s.id === activeId
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="px-4 py-3 cursor-pointer border-b transition-all"
              style={{
                borderColor: "var(--border)",
                background: isActive ? "rgba(62,232,196,.06)" : "transparent",
                borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold" style={{ color: "var(--text)" }}>{s.trade_date || "Unknown date"}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {s.detected_market || "NSE"} &middot; {s.trade_count || 0} {(s.trade_count || 0) === 1 ? 'trade' : 'trades'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-jetbrains-mono font-bold" style={{ color: Number(s.net_pnl) >= 0 ? "var(--green)" : "var(--red)" }}>
                    {fmt(Number(s.net_pnl || 0))}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {s.win_count || 0}W / {s.loss_count || 0}L
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
