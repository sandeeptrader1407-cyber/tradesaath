"use client"

import { useState, useEffect } from "react"

interface JourneyData {
  experience: string
  instruments: string
  challenge: string
  goal: string
  perfectDay: string
  oneChange: string
}

const SECTIONS = [
  {
    key: "experience",
    label: "How long have you been trading?",
    options: ["< 6 months", "6m-1y", "1-3 years", "3-5 years", "5+ years"],
  },
  {
    key: "instruments",
    label: "What do you mainly trade?",
    options: ["Equity", "F&O Options", "Futures", "Forex", "Crypto", "Commodities"],
  },
  {
    key: "challenge",
    label: "Biggest challenge right now?",
    options: ["Overtrading", "Revenge trading", "FOMO", "No discipline", "Inconsistent sizing", "Holding losers", "Exiting too early"],
  },
  {
    key: "goal",
    label: "What's your trading goal?",
    options: ["Consistent income", "Capital growth", "Stop losing money", "Go full-time"],
  },
]

export default function TradingJourney() {
  const [data, setData] = useState<JourneyData>({
    experience: "",
    instruments: "",
    challenge: "",
    goal: "",
    perfectDay: "",
    oneChange: "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editMode, setEditMode] = useState(true)

  useEffect(() => {
    fetch("/api/user/journey")
      .then((r) => r.json())
      .then((d) => {
        if (d.journey) {
          setData({
            experience: d.journey.experience || "",
            instruments: d.journey.instruments || "",
            challenge: d.journey.challenge || "",
            goal: d.journey.goal || "",
            perfectDay: d.journey.perfect_day || "",
            oneChange: d.journey.one_change || "",
          })
          setSaved(true)
          setEditMode(false)
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch("/api/user/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      setSaved(true)
      setEditMode(false)
    } catch {
      // silent fail
    }
    setSaving(false)
  }

  const setPill = (key: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [key]: prev[key as keyof JourneyData] === value ? "" : value,
    }))
  }

  if (saved && !editMode) {
    return (
      <div className="text-center py-12">
        <div className="text-3xl mb-3">&#x2705;</div>
        <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
          Journey Saved!
        </h3>
        <p className="text-sm mb-5" style={{ color: "var(--text2)" }}>Your coaching is now personalized based on your trading profile.</p>
        <button
          onClick={() => setEditMode(true)}
          className="text-sm px-5 py-2 rounded-lg font-semibold"
          style={{ background: "var(--s2)", color: "var(--accent)", border: "1px solid var(--border)" }}
        >
          Edit Journey &rarr;
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>Your Trading Journey</h2>
        <p className="text-xs mt-1" style={{ color: "var(--text2)" }}>This information personalizes your AI coaching. You can update it anytime.</p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.key} className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <label className="text-sm font-semibold block mb-3" style={{ color: "var(--text)" }}>{section.label}</label>
          <div className="flex flex-wrap gap-2">
            {section.options.map((opt) => {
              const isSelected = data[section.key as keyof JourneyData] === opt
              return (
                <button
                  key={opt}
                  onClick={() => setPill(section.key, opt)}
                  className="text-xs px-4 py-2 rounded-full border transition-all"
                  style={{
                    background: isSelected ? "rgba(62,232,196,.1)" : "var(--s2)",
                    borderColor: isSelected ? "var(--accent)" : "var(--border)",
                    color: isSelected ? "var(--accent)" : "var(--text2)",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <label className="text-sm font-semibold block mb-2" style={{ color: "var(--text)" }}>Describe your perfect trading day</label>
        <textarea
          value={data.perfectDay}
          onChange={(e) => setData({ ...data, perfectDay: e.target.value })}
          placeholder="e.g. Wake up early, review levels, take 3-5 high-conviction trades, stop by 11am, feel calm..."
          className="w-full text-sm p-3 rounded-lg border resize-none"
          style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }}
          rows={3}
        />
      </div>

      <div className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <label className="text-sm font-semibold block mb-2" style={{ color: "var(--text)" }}>If you could change ONE thing about your trading, what would it be?</label>
        <textarea
          value={data.oneChange}
          onChange={(e) => setData({ ...data, oneChange: e.target.value })}
          placeholder="e.g. Stop revenge trading after losses..."
          className="w-full text-sm p-3 rounded-lg border resize-none"
          style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }}
          rows={3}
        />
      </div>

      <div className="text-center pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: saving ? "var(--s3)" : "var(--accent)",
            color: saving ? "var(--muted)" : "#071a15",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Journey & Personalise Coaching \u2192"}
        </button>
      </div>
    </div>
  )
}
