"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface Props {
  score: number
  factors?: { name: string; value: number }[]
  equityCurve?: { pnl: number; date: string }[]
}

function getRingColor(v: number): string {
  if (v >= 80) return "#0F7A5A"
  if (v >= 60) return "var(--color-profit)"
  if (v >= 40) return "#C07B2A"
  return "var(--color-loss)"
}

function getBarColor(v: number): string {
  if (v >= 60) return "var(--color-profit)"
  if (v >= 40) return "#C07B2A"
  return "var(--color-loss)"
}

function StatusBadge({ score }: { score: number }) {
  if (score < 40) return (
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(192,57,43,0.08)', color: 'var(--color-loss)', border: '1px solid rgba(192,57,43,0.2)' }}>
      CRITICAL
    </span>
  )
  if (score <= 60) return (
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(192,123,42,0.08)', color: '#C07B2A', border: '1px solid rgba(192,123,42,0.2)' }}>
      IMPROVE
    </span>
  )
  if (score > 80) return (
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(29,158,117,0.08)', color: 'var(--color-profit)', border: '1px solid rgba(29,158,117,0.2)' }}>
      STRONG
    </span>
  )
  return null
}

export default function TradeSaathScore({ score, factors = [], equityCurve = [] }: Props) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animated / 100) * circumference
  const ringColor = getRingColor(score)

  // Sort factors ascending (worst first)
  const sortedFactors = [...factors].sort((a, b) => a.value - b.value)
  const lowest = sortedFactors[0] || null
  const potential = lowest ? Math.min(100, score + Math.round((100 - lowest.value) * 0.3)) : score

  // Percentile label
  const percentileLabel = score >= 72 ? "Top 10% of traders" : score >= 58 ? "Above profitable avg" : score >= 41 ? "Above avg trader" : "Below average"

  // 30-day sparkline from equityCurve (proxy: positive pnl sessions = disciplined)
  const sparkPts = equityCurve.slice(-20)
  const sparkValues = sparkPts.length > 0
    ? (() => {
        const maxAbs = Math.max(...sparkPts.map(p => Math.abs(p.pnl)), 1)
        return sparkPts.map(p => Math.max(0, Math.min(100, 50 + (p.pnl / maxAbs) * 30)))
      })()
    : []
  const showSparkline = sparkValues.length >= 3
  const sparkMin = sparkValues.length > 0 ? Math.min(...sparkValues) : 0
  const sparkMax = sparkValues.length > 0 ? Math.max(...sparkValues) : 100
  const sparkRange = sparkMax - sparkMin || 1
  const sparkW = 80, sparkH = 20
  const sparkPolyline = sparkValues.map((v, i) => {
    const x = (i / Math.max(sparkValues.length - 1, 1)) * sparkW
    const y = sparkH - ((v - sparkMin) / sparkRange) * sparkH
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 12px' }}>Discipline Score</h2>

      {/* Focus insight at top */}
      {lowest && (
        <div style={{ marginBottom: 16, padding: '8px 12px', borderLeft: '2px solid var(--color-loss)', borderRadius: '0 6px 6px 0', background: 'rgba(192,57,43,0.03)' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-loss)', marginBottom: 2 }}>
            FOCUS: {lowest.name} at {lowest.value}%
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)' }}>
            Improving this could push your score to ~{potential}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* Ring */}
        <div className="relative shrink-0 flex flex-col items-center">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--s3)" strokeWidth="10" />
            <circle
              cx="90" cy="90" r={radius} fill="none"
              stroke={ringColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 400, color: ringColor, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", fontFamily: "var(--font-sans)" }}>/ 100</div>
          </div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-sans)", fontSize: 11, color: ringColor, fontWeight: 400, textAlign: 'center' }}>{percentileLabel}</div>
          {showSparkline && (
            <svg width={sparkW} height={sparkH} style={{ marginTop: 6, opacity: 0.8 }}>
              <polyline points={sparkPolyline} fill="none" stroke={ringColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Factors — sorted worst first */}
        <div className="flex-1 space-y-2 w-full">
          {sortedFactors.map((f, idx) => {
            const isWorst = idx === 0
            return (
              <div key={f.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  ...(isWorst ? { paddingLeft: 8, borderLeft: '2px solid var(--color-loss)', background: 'rgba(192,57,43,0.04)', borderRadius: '0 4px 4px 0' } : {}),
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: isWorst ? 'var(--color-loss)' : "var(--text2)" }}>{f.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: getBarColor(f.value) }}>{f.value}%</span>
                      <StatusBadge score={f.value} />
                      {isWorst && (
                        <Link href="/coach" style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Work on this →
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="rounded-full" style={{ height: 5, background: "var(--s3)" }}>
                    <div className="rounded-full transition-all duration-700" style={{ height: '100%', width: `${f.value}%`, background: getBarColor(f.value) }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Benchmarks — text row */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--color-border)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', margin: 0 }}>
          You: <span style={{ color: ringColor }}>{score}</span>
          &nbsp;&middot;&nbsp;Avg trader: 41
          &nbsp;&middot;&nbsp;Profitable: 58
          &nbsp;&middot;&nbsp;Top 10%: 72
        </p>
      </div>
    </div>
  )
}
