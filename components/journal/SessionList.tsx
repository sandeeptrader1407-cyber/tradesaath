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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)' }}>
            Sessions
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--color-muted)' }}>
            {sessions.length}
          </span>
        </div>
        {/* Search input — 36px height, 0.5px border, radius 6px */}
        <input
          type="text"
          placeholder="Search date, market..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            height: 36,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            color: 'var(--color-ink)',
            background: '#FFFFFF',
            border: '0.5px solid var(--color-border)',
            borderRadius: 6,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Session rows */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '60vh' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>
            No sessions found
          </div>
        )}
        {filtered.map((s) => {
          const isActive = s.id === activeId
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                minHeight: 44,
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '0.5px solid var(--color-border)',
                // Active: blue-tint bg (#F0F5FB), 3px left accent border
                background: isActive ? 'var(--session-active-bg, rgba(15,76,129,.05))' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-raised, #F5F2EC)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = isActive ? 'var(--session-active-bg, rgba(15,76,129,.05))' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  {/* Date: DM Mono 12px */}
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-muted)', marginBottom: 2 }}>
                    {s.trade_date || "Unknown date"}
                  </div>
                  {/* Market + trade count: DM Sans 13px 500 */}
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)' }}>
                    {s.detected_market || "Market"}
                    <span style={{ fontWeight: 400, color: 'var(--color-muted)', marginLeft: 4 }}>
                      &middot; {s.trade_count || 0} {(s.trade_count || 0) === 1 ? 'trade' : 'trades'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {/* P&L: DM Mono 500 13px */}
                  <div style={{
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    color: Number(s.net_pnl) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                    marginBottom: 2,
                  }}>
                    {formatPnl(Number(s.net_pnl || 0))}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--color-muted)' }}>
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
