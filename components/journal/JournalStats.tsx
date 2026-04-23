"use client"

import { computeKPIs } from '@/lib/kpi/computeKPIs'

interface Session {
  net_pnl: number
  win_rate: number
  trade_count: number
  win_count?: number
  loss_count?: number
}

interface Props {
  sessions: Session[]
}

export default function JournalStats({ sessions }: Props) {
  const kpis = computeKPIs(sessions)

  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : "-"
    return `${sign}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`
  }

  const stats = [
    { label: "Cumulative Gross P&L", value: fmt(kpis.totalPnl),        pos: kpis.totalPnl >= 0 },
    { label: "Sessions",             value: String(kpis.totalSessions), pos: null },
    { label: "Win Rate",             value: `${kpis.winRate}%`,         pos: kpis.winRate >= 50 },
    { label: "Best Day Gross P&L",   value: fmt(kpis.bestSessionPnl),   pos: kpis.bestSessionPnl >= 0 },
  ]

  const cardStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderRadius: 10,
    background: '#FFFFFF',
    border: '0.5px solid var(--color-border)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--font-sans)',
    fontWeight: 400,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--color-muted)',
    marginBottom: 6,
  }

  function valueColor(pos: boolean | null, value: string): string {
    if (pos === null) return 'var(--color-ink)'
    if (pos) return 'var(--color-profit)'
    return 'var(--color-loss)'
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {stats.map((s) => (
        <div key={s.label} style={cardStyle}>
          <div style={labelStyle}>{s.label}</div>
          <div style={{
            fontSize: 22,
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: valueColor(s.pos, s.value),
            lineHeight: 1.1,
          }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}
