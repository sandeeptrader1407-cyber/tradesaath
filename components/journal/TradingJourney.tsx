"use client"

import { useState, useEffect } from "react"

interface JourneyData {
  experience: string
  instruments: string
  challenge: string
  goal: string
  perfectDay: string
  oneChange: string
  step1Beginning: string
  step2DarkDays: string
  step3Shift: string
  step4Today: string
  step5Truth: string
}

const PROFILE_SECTIONS = [
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
    label: "What\u2019s your trading goal?",
    options: ["Consistent income", "Capital growth", "Stop losing money", "Go full-time"],
  },
]

const JOURNEY_STEPS = [
  {
    key: "step1Beginning",
    title: "The Beginning",
    icon: "\u2728",
    prompt: "Why did you start trading? What excited you about it?",
    placeholder: "e.g. I saw a friend make money in F&O and thought I could too. The idea of being my own boss, making money from anywhere...",
  },
  {
    key: "step2DarkDays",
    title: "The Dark Days",
    icon: "\u26C8\uFE0F",
    prompt: "What was your worst period? What happened?",
    placeholder: "e.g. I blew my first 2L account in 3 months. Revenge traded every day, couldn\u2019t sleep, hid losses from family...",
  },
  {
    key: "step3Shift",
    title: "The Shift",
    icon: "\u26A1",
    prompt: "What moment changed your approach?",
    placeholder: "e.g. One day I looked at my journal and saw 47 revenge trades in a month. That number shocked me. I decided to...",
  },
  {
    key: "step4Today",
    title: "Today",
    icon: "\uD83D\uDCCD",
    prompt: "Where are you now? What\u2019s your current reality?",
    placeholder: "e.g. I\u2019m profitable 3 out of 4 weeks now. Still struggle with position sizing after wins. Working on...",
  },
  {
    key: "step5Truth",
    title: "Your Truth",
    icon: "\uD83D\uDCA1",
    prompt: "What one thing do you know now that you wish you knew then?",
    placeholder: "e.g. That trading is 90% psychology. No strategy works if you can\u2019t follow it. The market doesn\u2019t care about your feelings.",
  },
]

export default function TradingJourney() {
  const [data, setData] = useState<JourneyData>({
    experience: "", instruments: "", challenge: "", goal: "",
    perfectDay: "", oneChange: "",
    step1Beginning: "", step2DarkDays: "", step3Shift: "", step4Today: "", step5Truth: "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [showProfile, setShowProfile] = useState(false)

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
            step1Beginning: d.journey.step_1_beginning || "",
            step2DarkDays: d.journey.step_2_dark_days || "",
            step3Shift: d.journey.step_3_shift || "",
            step4Today: d.journey.step_4_today || "",
            step5Truth: d.journey.step_5_truth || "",
          })
          const hasStory = d.journey.step_1_beginning || d.journey.step_2_dark_days
          if (hasStory || d.journey.experience) setSaved(true)
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
    } catch { /* silent */ }
    setSaving(false)
  }

  const setPill = (key: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [key]: prev[key as keyof JourneyData] === value ? "" : value,
    }))
  }

  const setField = (key: string, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  const filledSteps = JOURNEY_STEPS.filter((s) => data[s.key as keyof JourneyData]).length

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── 5-Step Narrative Journey ── */}
      <div className="rounded-xl border p-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="mb-5">
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
            Your Trading Story
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Every trader has a journey. Writing yours helps you understand your patterns.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {JOURNEY_STEPS.map((s, i) => {
            const filled = !!data[s.key as keyof JourneyData]
            const isActive = i === activeStep
            return (
              <button
                key={s.key}
                onClick={() => setActiveStep(i)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all"
                style={{
                  background: isActive ? "rgba(62,232,196,.12)" : filled ? "rgba(62,232,196,.05)" : "var(--s2)",
                  border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                  color: isActive ? "var(--accent)" : filled ? "var(--text)" : "var(--muted)",
                }}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            )
          })}
        </div>

        {/* Active step content */}
        {(() => {
          const step = JOURNEY_STEPS[activeStep]
          return (
            <div key={step.key}>
              <div className="text-center mb-4">
                <div className="text-2xl mb-1">{step.icon}</div>
                <h4 className="text-sm font-bold" style={{ color: "var(--text)" }}>Step {activeStep + 1}: {step.title}</h4>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{step.prompt}</p>
              </div>
              <textarea
                value={data[step.key as keyof JourneyData] || ""}
                onChange={(e) => setField(step.key, e.target.value)}
                placeholder={step.placeholder}
                className="w-full text-sm p-4 rounded-lg border resize-none leading-relaxed"
                style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)", minHeight: 120 }}
                rows={5}
              />
            </div>
          )
        })()}

        {/* Step navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
            disabled={activeStep === 0}
            className="text-xs px-4 py-2 rounded-lg font-semibold"
            style={{
              background: activeStep === 0 ? "var(--s2)" : "var(--s3)",
              color: activeStep === 0 ? "var(--muted)" : "var(--text)",
              cursor: activeStep === 0 ? "default" : "pointer",
            }}
          >
            \u2190 Previous
          </button>
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>{filledSteps}/5 steps written</span>
          {activeStep < JOURNEY_STEPS.length - 1 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="text-xs px-4 py-2 rounded-lg font-semibold"
              style={{ background: "var(--accent)", color: "#071a15" }}
            >
              Next \u2192
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-4 py-2 rounded-lg font-semibold"
              style={{ background: saving ? "var(--s3)" : "var(--accent)", color: saving ? "var(--muted)" : "#071a15" }}
            >
              {saving ? "Saving..." : "Save Story \u2713"}
            </button>
          )}
        </div>
      </div>

      {/* ── Trading Profile (collapsible) ── */}
      <div className="rounded-xl border" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Trading Profile</span>
            <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
              {data.experience || data.instruments ? "\u2713 Filled" : "Set up your profile"}
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{showProfile ? "\u25B2" : "\u25BC"}</span>
        </button>

        {showProfile && (
          <div className="px-4 pb-5 space-y-4">
            {PROFILE_SECTIONS.map((section) => (
              <div key={section.key}>
                <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>{section.label}</label>
                <div className="flex flex-wrap gap-2">
                  {section.options.map((opt) => {
                    const isSelected = data[section.key as keyof JourneyData] === opt
                    return (
                      <button
                        key={opt}
                        onClick={() => setPill(section.key, opt)}
                        className="text-[11px] px-3 py-1.5 rounded-full border transition-all"
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

            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>Describe your perfect trading day</label>
              <textarea
                value={data.perfectDay}
                onChange={(e) => setField("perfectDay", e.target.value)}
                placeholder="e.g. Wake up early, review levels, take 3-5 trades, stop by 11am..."
                className="w-full text-sm p-3 rounded-lg border resize-none"
                style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }}
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>If you could change ONE thing about your trading?</label>
              <textarea
                value={data.oneChange}
                onChange={(e) => setField("oneChange", e.target.value)}
                placeholder="e.g. Stop revenge trading after losses..."
                className="w-full text-sm p-3 rounded-lg border resize-none"
                style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }}
                rows={2}
              />
            </div>

            <div className="text-center pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-5 py-2 rounded-lg font-semibold"
                style={{ background: saving ? "var(--s3)" : "var(--accent)", color: saving ? "var(--muted)" : "#071a15" }}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
