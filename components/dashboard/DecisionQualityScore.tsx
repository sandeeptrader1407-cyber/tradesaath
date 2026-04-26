"use client"

import { useState, useEffect } from "react"

interface Factor {
  name: string
  score: number
  color?: string
}

interface Props {
  score?: number
  grade?: string | null
  factors?: Factor[]
  pendingCount?: number
}

const DEFAULT_FACTORS: Factor[] = [
  { name: "Risk Management", score: 0 },
  { name: "Emotional Control", score: 0 },
  { name: "Position Sizing", score: 0 },
  { name: "Exit Discipline", score: 0 },
  { name: "Entry Quality", score: 0 },
  { name: "Exit Timing", score: 0 },
  { name: "Rule Following", score: 0 },
]

function getColor(v: number): string {
  if (v >= 80) return "var(--green, #22c55e)"
  if (v >= 65) return "var(--gold, #eab308)"
  if (v >= 45) return "#f59e0b"
  return "var(--red, #ef4444)"
}

function getGrade(v: number): string {
  if (v >= 80) return "A"
  if (v >= 65) return "B"
  if (v >= 45) return "C"
  if (v >= 25) return "D"
  return "F"
}

export default function DecisionQualityScore({ score = 0, grade = null, factors = DEFAULT_FACTORS, pendingCount = 0 }: Props) {
  const [animated, setAnimated] = useState(0)
  const hasData = score > 0

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 150)
    return () => clearTimeout(timer)
  }, [score])

  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animated / 100) * circumference

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>
          Decision Quality Score
        </h2>
        <span style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 20,
          background: 'var(--color-ink)', color: 'var(--color-canvas)',
        }}>PRO</span>
      </div>

      {!hasData ? (
        <div className="text-center py-10">
          <p className="text-sm font-semibold" style={{ color: pendingCount > 0 ? "#f59e0b" : "var(--text2)" }}>
            {pendingCount > 0 ? "Analysis pending" : "Upload sessions to get your Decision Quality Score."}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {pendingCount > 0
              ? `${pendingCount} session${pendingCount === 1 ? '' : 's'} awaiting analysis — click "Run AI analysis" above to process them.`
              : "We score every session across 7 factors including Risk Management, Emotional Control, Position Sizing, and Exit Discipline."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* SVG Ring */}
          <div className="relative shrink-0">
            <svg className="dqs-ring-svg" width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--s3, rgba(255,255,255,.06))" strokeWidth="8" />
              <circle
                cx="70" cy="70" r={radius} fill="none"
                stroke={getColor(score)} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset}
                transform="rotate(-90 70 70)"
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: "'Fraunces', serif",
                color: getColor(score),
                lineHeight: 1,
              }}>
                {score}
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginTop: 2 }}>
                out of 100
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, marginTop: 4,
                padding: "1px 8px", borderRadius: 4,
                background: `${getColor(score)}22`, color: getColor(score),
              }}>
                Grade {grade || getGrade(score)}
              </div>
            </div>
          </div>

          {/* Factor bars */}
          <div className="flex-1 space-y-3 w-full">
            {factors.map((f) => (
              <div key={f.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: "var(--text2)" }}>{f.name}</span>
                  <span className="text-xs font-semibold" style={{
                    color: getColor(f.score),
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {f.score}/100
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: f.color || getColor(f.score),
                    width: `${f.score}%`,
                    transition: "width .8s ease-out",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
