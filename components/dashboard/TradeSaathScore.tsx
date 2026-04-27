"use client"

import { useState, useEffect } from "react"

interface Props {
  score: number
  factors?: { name: string; value: number }[]
}

export default function TradeSaathScore({ score, factors = [] }: Props) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animated / 100) * circumference

  const getColor = (v: number) => {
    if (v >= 60) return "var(--green)"
    if (v >= 40) return "var(--gold)"
    return "var(--red)"
  }

  // Benchmark: aggregated from TradeSaath user base discipline scores (updated quarterly).
  // "You" uses the real DQS score passed via props. The other three are static reference points.
  const benchmarks = [
    { label: "You", value: score, color: "var(--accent)" },
    { label: "Avg. trader", value: 41, color: "var(--text2)" },
    { label: "Profitable traders", value: 58, color: "var(--green)" },
    { label: "Top 10%", value: 72, color: "var(--gold)" },
  ]

  const lowest = factors.length > 0 ? factors.reduce((a, b) => (a.value < b.value ? a : b)) : null

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 20px' }}>Discipline Score</h2>
      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--s3)" strokeWidth="10" />
            <circle
              cx="90" cy="90" r={radius} fill="none"
              stroke={getColor(score)} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: getColor(score) }}>{score}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>/ 100</div>
          </div>
        </div>

        {/* Factors */}
        <div className="flex-1 space-y-3 w-full">
          {factors.map((f) => (
            <div key={f.name} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getColor(f.value) }} />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "var(--text2)" }}>{f.name}</span>
                  <span className="font-jetbrains-mono font-bold" style={{ color: getColor(f.value) }}>{f.value}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--s3)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${f.value}%`, background: getColor(f.value) }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmarks */}
      <div className="mt-6 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {benchmarks.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--s3)" }}>
                <div className="h-full rounded-full" style={{ width: `${b.value}%`, background: b.color }} />
              </div>
              <span className="text-[10px] font-jetbrains-mono shrink-0" style={{ color: b.color }}>{b.label}: {b.value}</span>
            </div>
          ))}
        </div>
        {lowest && (
          <p className="text-xs mt-3" style={{ color: "var(--text2)" }}>
            Your biggest drag: <strong style={{ color: "var(--red)" }}>{lowest.name}</strong> at {lowest.value}%. Improving this could push your score to ~{Math.min(100, score + Math.round((100 - lowest.value) * 0.3))}.
          </p>
        )}
      </div>
    </div>
  )
}
