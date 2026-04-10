"use client"

import { useState } from "react"

const INTENTIONS = [
  "No revenge trades",
  "Stop at 10:30 AM",
  "Max 8 trades",
  "Fixed 20 lots",
  "Stop loss every trade",
]

export default function PreMarketCheckin() {
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
      <div className="rounded-xl border p-5 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="text-2xl mb-2">{"✅"}</div>
        <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>Intention set. Have a disciplined session.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>{"☀️"} Before you trade today</h3>
      <p className="text-xs mb-4" style={{ color: "var(--text2)" }}>Take 30 seconds to set your intention. What's your one rule you won't break today?</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {INTENTIONS.map((item) => (
          <button
            key={item}
            onClick={() => toggle(item)}
            className="text-xs px-3 py-1.5 rounded-full border transition-all"
            style={{
              background: selected.has(item) ? "rgba(62,232,196,.15)" : "var(--s2)",
              borderColor: selected.has(item) ? "var(--accent)" : "var(--border)",
              color: selected.has(item) ? "var(--accent)" : "var(--text2)",
              fontWeight: selected.has(item) ? 600 : 400,
            }}
          >
            {item}
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
        I'm ready {"→"}
      </button>
    </div>
  )
}
