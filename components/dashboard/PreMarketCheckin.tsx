"use client"

import { useState } from "react"

const INTENTIONS = [
  "No revenge trades",
  "Stop at 10:30 AM",
  "Max 8 trades",
  "Fixed 20 lots",
  "Stop loss every trade",
]

interface Props {
  compact?: boolean
}

export default function PreMarketCheckin({ compact = false }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)

  const toggle = (item: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }

  if (done) {
    return (
      <div className={compact ? "text-center py-2" : "rounded-xl border p-5 text-center"} style={compact ? {} : { background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="text-2xl mb-2">{"✅"}</div>
        <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>Intention set. Have a disciplined session.</p>
      </div>
    )
  }

  return (
    <div {...(compact ? {} : { className: "rounded-xl border p-5", style: { background: "var(--s1)", borderColor: "var(--border)" } as React.CSSProperties })}>
      {!compact && (
        <>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>{"☀️"} Before you trade today</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text2)" }}>Take 30 seconds to set your intention. What&apos;s your one rule you won&apos;t break today?</p>
        </>
      )}
      {compact && (
        <p className="text-xs mb-3" style={{ color: "var(--text2)" }}>Set your intention for today:</p>
      )}
      <div className="flex flex-wrap gap-2 mb-3">
        {INTENTIONS.map((item) => (
          <button
            key={item}
            onClick={() => toggle(item)}
            className="text-xs px-3 py-1.5 rounded-full border transition-all"
            style={{
              background: selected.has(item) ? "rgba(62,232,196,.25)" : "var(--s2)",
              borderColor: selected.has(item) ? "var(--accent)" : "var(--border)",
              color: selected.has(item) ? "var(--accent)" : "var(--text2)",
              fontWeight: selected.has(item) ? 700 : 400,
              boxShadow: selected.has(item) ? "0 0 8px rgba(62,232,196,.2)" : "none",
            }}
          >
            {selected.has(item) ? "\u2713 " : ""}{item}
          </button>
        ))}
      </div>
      <button
        onClick={() => setDone(true)}
        disabled={selected.size === 0}
        className="text-sm px-5 py-2 rounded-lg font-semibold transition-all"
        style={{
          background: selected.size > 0 ? "var(--accent)" : "var(--s3)",
          color: selected.size > 0 ? "#071a15" : "var(--muted)",
          cursor: selected.size > 0 ? "pointer" : "not-allowed",
        }}
      >
        I&apos;m ready {"→"}
      </button>
    </div>
  )
}
