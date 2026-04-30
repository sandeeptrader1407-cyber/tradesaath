"use client"

import { useState } from "react"

interface CurvePoint {
  pnl: number
  date: string
}

interface Props {
  equityCurve: CurvePoint[]
  streaks: { current: number; bestWin: number; worstLoss: number }
  risk: { maxDrawdown: number; avgLossAvgWin: string }
  totalAllTimePnl?: number
}

function fmt(v: number): string {
  const sign = v >= 0 ? "+" : ""
  return sign + "₹" + Math.abs(Math.round(v)).toLocaleString("en-IN")
}

function fmtShort(v: number): string {
  const abs = Math.abs(Math.round(v))
  const sign = v >= 0 ? "+" : "-"
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`
  return `${sign}₹${abs}`
}

export default function DashboardEquityCurve({ equityCurve, streaks, risk, totalAllTimePnl }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (equityCurve.length === 0) return null

  const maxAbs = Math.max(...equityCurve.map(d => Math.abs(d.pnl)), 1)
  const maxPnl = Math.max(...equityCurve.map(d => d.pnl))
  const minPnl = Math.min(...equityCurve.map(d => d.pnl))
  const barW = Math.max(8, Math.min(24, Math.floor(580 / equityCurve.length) - 2))

  // 5-session rolling average
  const rollingAvg = equityCurve.map((_, i) => {
    const window = equityCurve.slice(Math.max(0, i - 4), i + 1)
    return window.reduce((s, d) => s + d.pnl, 0) / window.length
  })

  // Chart height in pixels for SVG overlay
  const chartH = 140

  // X positions for bars (centre of each bar)
  const totalW = equityCurve.length * (barW + 2)

  // Trend insight
  const last5 = equityCurve.slice(-5)
  const prev5 = equityCurve.slice(-10, -5)
  const last5Avg = last5.reduce((s, d) => s + d.pnl, 0) / Math.max(last5.length, 1)
  const prev5Avg = prev5.length > 0 ? prev5.reduce((s, d) => s + d.pnl, 0) / prev5.length : 0
  const lossCount = last5.filter(d => d.pnl < 0).length
  const allPositive = last5.every(d => d.pnl > 0)
  let trendInsight = "No clear trend in recent sessions."
  if (last5.length >= 5) {
    if (allPositive) trendInsight = "5 consecutive positive sessions."
    else if (lossCount >= 3) trendInsight = "3 of last 5 sessions were losses. Review your approach."
    else if (prev5.length >= 5 && last5Avg > prev5Avg * 1.1) trendInsight = "Last 5 sessions trending up. Momentum building."
  }

  // X-axis date labels (4 evenly spaced)
  const dateIndices = [0, Math.floor(equityCurve.length / 3), Math.floor(2 * equityCurve.length / 3), equityCurve.length - 1]
  const formatAxisDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    } catch { return dateStr }
  }

  // Ratio for loss colour
  const ratio = parseFloat(risk.avgLossAvgWin)
  const ratioColor = ratio < 1.0 ? "var(--color-loss)" : "var(--color-profit)"
  const ratioLabel = ratio < 1.0 ? "losses avg more than wins" : "wins avg more than losses"

  // Drawdown as % of gross loss
  const grossLoss = Math.abs(totalAllTimePnl ?? 0) || Math.abs(minPnl) * equityCurve.length
  const drawdownPct = grossLoss > 0 ? ((Math.abs(risk.maxDrawdown) / grossLoss) * 100).toFixed(1) : null

  // Streak quality dots (last 7 sessions)
  const last7 = equityCurve.slice(-7)

  // Current streak win/loss run for avgDQS placeholder
  const currentIsWin = streaks.current > 0
  const streakCount = Math.abs(streaks.current)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <style>{`@media(max-width:768px){.equity-bars-wrap{height:160px!important}}`}</style>

      {/* Equity Curve */}
      <div className="md:col-span-2 rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 16px' }}>
          Session Performance, last {equityCurve.length}
        </h3>

        <div style={{ position: 'relative' }}>
          {/* Y-axis labels */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 24, width: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', lineHeight: 1 }}>{fmtShort(maxPnl)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', lineHeight: 1 }}>₹0</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', lineHeight: 1 }}>{fmtShort(minPnl)}</span>
          </div>

          {/* Chart area */}
          <div style={{ marginLeft: 44, position: 'relative' }}>
            {/* Zero baseline */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: 'var(--color-border)', zIndex: 1 }} />

            {/* Bars */}
            <div className="equity-bars-wrap" style={{ height: chartH, display: 'flex', alignItems: 'flex-end', gap: 2, overflowX: 'auto', position: 'relative', zIndex: 2 }}
              onMouseLeave={() => setHoveredIdx(null)}>
              {equityCurve.map((d, i) => {
                const height = Math.max(6, (Math.abs(d.pnl) / maxAbs) * (chartH / 2))
                const isHovered = hoveredIdx === i
                return (
                  <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div
                      onMouseEnter={() => setHoveredIdx(i)}
                      style={{
                        width: barW,
                        height,
                        background: d.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                        borderRadius: d.pnl >= 0 ? '2px 2px 0 0' : '0 0 2px 2px',
                        opacity: isHovered ? 1 : 0.75,
                        transition: 'opacity 0.1s',
                        cursor: 'default',
                        ...(d.pnl < 0 ? { alignSelf: 'flex-start', marginTop: 'auto' } : {}),
                      }}
                    />
                    {/* Tooltip */}
                    {isHovered && (
                      <div style={{
                        position: 'absolute',
                        bottom: d.pnl >= 0 ? height + 6 : undefined,
                        top: d.pnl < 0 ? height + 6 : undefined,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--color-ink)',
                        color: 'var(--color-canvas)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        padding: '6px 10px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        zIndex: 50,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}>
                        <div>{formatAxisDate(d.date)}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: d.pnl >= 0 ? '#4ADE80' : '#F87171' }}>{fmt(d.pnl)}</div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Rolling avg overlay */}
              <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={totalW} height={chartH}>
                <polyline
                  fill="none"
                  stroke="rgba(15,76,129,0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  strokeLinecap="round"
                  points={rollingAvg.map((avg, i) => {
                    const x = i * (barW + 2) + barW / 2
                    const y = chartH / 2 - (avg / maxAbs) * (chartH / 2)
                    return `${x},${y}`
                  }).join(' ')}
                />
              </svg>
            </div>

            {/* X-axis date labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingRight: 4 }}>
              {dateIndices.map(idx => (
                <span key={idx} style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-muted)' }}>
                  {formatAxisDate(equityCurve[idx]?.date || '')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Trend insight */}
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic', marginTop: 12, marginBottom: 0 }}>
          {trendInsight}
        </p>
      </div>

      {/* Right column: Streak + Risk */}
      <div className="space-y-4">
        {/* Streak card */}
        <div className="rounded-xl border p-4" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 10px' }}>Streak Tracking</h4>

          {/* Quality dots — last 7 sessions */}
          {last7.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {last7.map((d, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: d.pnl > 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                  opacity: 0.85,
                }} title={`${formatAxisDate(d.date)}: ${fmt(d.pnl)}`} />
              ))}
            </div>
          )}

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: currentIsWin ? 'var(--color-profit)' : 'var(--color-loss)', marginBottom: 6 }}>
            {currentIsWin ? `${streakCount}-session win run` : `Loss run: ${streakCount}`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text2)' }}>Best win streak</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--color-profit)' }}>{streaks.bestWin}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text2)' }}>Longest tough run</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--color-loss)' }}>{streaks.worstLoss}</span>
            </div>
          </div>
        </div>

        {/* Risk profile card */}
        <div className="rounded-xl border p-4" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 10px' }}>Risk Profile</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text2)' }}>Max Drawdown</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--color-loss)' }}>{fmt(-risk.maxDrawdown)}</span>
              </div>
              {drawdownPct && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', marginTop: 2, textAlign: 'right' }}>
                  {drawdownPct}% of gross P&L
                </div>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text2)' }}>Avg Loss / Avg Win</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: ratioColor }}>{risk.avgLossAvgWin}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: ratioColor, marginTop: 2, textAlign: 'right' }}>
                {ratioLabel}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
