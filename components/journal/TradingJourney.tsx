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
  { key: "step1Beginning", title: "The Beginning", prompt: "Why did you start trading? What excited you about it?", placeholder: "e.g. I saw a friend make money in F&O and thought I could too..." },
  { key: "step2DarkDays", title: "The Dark Days", prompt: "What was your worst period? What happened?", placeholder: "e.g. I blew my first 2L account in 3 months. Revenge traded every day..." },
  { key: "step3Shift", title: "The Shift", prompt: "What moment changed your approach?", placeholder: "e.g. One day I looked at my journal and saw 47 revenge trades in a month..." },
  { key: "step4Today", title: "Today", prompt: "Where are you now? What's your current reality?", placeholder: "e.g. I'm profitable 3 out of 4 weeks now. Still struggle with sizing..." },
  { key: "step5Truth", title: "Your Truth", prompt: "What one thing do you know now that you wish you knew then?", placeholder: "e.g. Trading is 90% psychology. No strategy works if you can't follow it." },
]

const EMPTY_DATA: JourneyData = {
  experience: "", instruments: "", challenge: "", goal: "",
  perfectDay: "", oneChange: "",
  step1Beginning: "", step2DarkDays: "", step3Shift: "", step4Today: "", step5Truth: "",
}

export default function TradingJourney() {
  const [data, setData] = useState<JourneyData>(EMPTY_DATA)
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const [showNarrative, setShowNarrative] = useState(false)
  const [generatedStory, setGeneratedStory] = useState("")
  const [storyLoading, setStoryLoading] = useState(false)
  const [storyError, setStoryError] = useState("")
  const [storyEmpty, setStoryEmpty] = useState(false)
  const [copied, setCopied] = useState(false)

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
          if (d.journey.generated_story) {
            setGeneratedStory(d.journey.generated_story)
          }
        }
      })
      .catch(() => {})
  }, [])

  const generateStory = async (currentData: JourneyData) => {
    setStoryLoading(true)
    setStoryError("")
    setStoryEmpty(false)
    try {
      const res = await fetch("/api/user/journey/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1Beginning: currentData.step1Beginning,
          step2DarkDays: currentData.step2DarkDays,
          step3Shift: currentData.step3Shift,
          step4Today: currentData.step4Today,
          step5Truth: currentData.step5Truth,
        }),
      })
      const result = await res.json()
      if (result.story) {
        setGeneratedStory(result.story)
      } else if (result.empty) {
        setStoryEmpty(true)
        setStoryError(result.error || "Upload your first session to generate your story")
      } else {
        setStoryError(result.error || "Story generation failed")
      }
    } catch {
      setStoryError("Could not generate story. Try again.")
    }
    setStoryLoading(false)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await fetch("/api/user/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleSaveNarrative = async () => {
    setSaving(true)
    try {
      await fetch("/api/user/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleShare = async () => {
    if (!generatedStory) return
    try {
      await navigator.clipboard.writeText(`My trading journey:\n\n${generatedStory}\n\n— generated on TradeSaathi`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
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
  const hasStory = !!generatedStory

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* SECTION 1: Auto-generated Trading Story */}
      <div className="rounded-xl border p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
              {"\ud83c\udfac"} Your Trading Story
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {hasStory ? "Generated from your real trading data. Regenerate anytime." : "Auto-generated from your trade history. No typing required."}
            </p>
          </div>
          {!hasStory && !storyLoading && !storyEmpty && (
            <button onClick={() => generateStory(data)} className="text-xs px-4 py-2 rounded-lg font-semibold whitespace-nowrap" style={{ background: "var(--accent)", color: "#071a15" }}>
              {"\u2728 Generate My Story"}
            </button>
          )}
        </div>

        {storyLoading && (
          <div className="text-center py-10">
            <div className="text-2xl mb-3">{"\u270d\ufe0f"}</div>
            <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Crafting your trading story...</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Reading your sessions, finding your patterns</div>
          </div>
        )}

        {storyEmpty && !storyLoading && (
          <div className="text-center py-10 px-4 rounded-lg" style={{ background: "var(--s2)" }}>
            <div className="text-3xl mb-3">{"\ud83d\udcc4"}</div>
            <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>No trading data yet</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>Upload your first session to generate your story</div>
            <a href="/" className="inline-block mt-4 text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "#071a15" }}>
              Upload trades {"\u2192"}
            </a>
          </div>
        )}

        {storyError && !storyEmpty && !storyLoading && (
          <div className="rounded-lg border p-4 mb-3" style={{ background: "rgba(240,93,108,.05)", borderColor: "rgba(240,93,108,.2)" }}>
            <div className="text-xs" style={{ color: "var(--red)" }}>{storyError}</div>
          </div>
        )}

        {hasStory && !storyLoading && (
          <>
            <div className="text-[14px] leading-[1.9] whitespace-pre-line" style={{ fontFamily: "'Fraunces', serif", color: "var(--text2)" }}>
              {generatedStory}
            </div>
            <div className="flex items-center gap-2 mt-5 pt-4 border-t flex-wrap" style={{ borderColor: "var(--border)" }}>
              <button onClick={handleShare} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5" style={{ background: "var(--s2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {copied ? "\u2713 Copied!" : "\ud83d\udccb Copy to share"}
              </button>
              <button onClick={() => generateStory(data)} disabled={storyLoading} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5" style={{ background: "var(--s2)", border: "1px solid var(--border)", color: "var(--text2)" }}>
                {"\u21bb"} Regenerate
              </button>
              {filledSteps === 0 && (
                <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>
                  Want a more personal story? Add your voice below {"\u2193"}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* SECTION 2: Add Your Voice (collapsed by default) */}
      <div className="rounded-xl border" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <button onClick={() => setShowNarrative(!showNarrative)} className="w-full flex items-center justify-between p-4 text-left">
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Add Your Voice</span>
            <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
              {filledSteps > 0 ? `${filledSteps}/5 chapters written` : "(optional) Want to add your personal narrative?"}
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{showNarrative ? "\u25b2" : "\u25bc"}</span>
        </button>

        {showNarrative && (
          <div className="px-5 pb-5">
            <p className="text-[11px] mb-4" style={{ color: "var(--muted)" }}>
              These are optional. The story above works without them — but if you fill any in, your next regenerate will weave them with your data.
            </p>

            <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
              {JOURNEY_STEPS.map((s, i) => {
                const filled = !!data[s.key as keyof JourneyData]
                const isActive = i === activeStep
                return (
                  <button key={s.key} onClick={() => setActiveStep(i)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all" style={{ background: isActive ? "rgba(62,232,196,.12)" : filled ? "rgba(62,232,196,.05)" : "var(--s2)", border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)", color: isActive ? "var(--accent)" : filled ? "var(--text)" : "var(--muted)" }}>
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                )
              })}
            </div>

            {(() => {
              const step = JOURNEY_STEPS[activeStep]
              return (
                <div key={step.key}>
                  <div className="text-center mb-3">
                    <h4 className="text-sm font-bold" style={{ color: "var(--text)" }}>Step {activeStep + 1}: {step.title}</h4>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{step.prompt}</p>
                  </div>
                  <textarea value={data[step.key as keyof JourneyData] || ""} onChange={(e) => setField(step.key, e.target.value)} placeholder={step.placeholder} className="w-full text-sm p-4 rounded-lg border resize-none leading-relaxed" style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)", minHeight: 110 }} rows={4} />
                </div>
              )
            })()}

            <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
              <button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0} className="text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: activeStep === 0 ? "var(--s2)" : "var(--s3)", color: activeStep === 0 ? "var(--muted)" : "var(--text)", cursor: activeStep === 0 ? "default" : "pointer" }}>
                {"\u2190 Previous"}
              </button>
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>{filledSteps}/5 written</span>
              {activeStep < JOURNEY_STEPS.length - 1 ? (
                <button onClick={() => setActiveStep(activeStep + 1)} className="text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--accent)", color: "#071a15" }}>
                  {"Next \u2192"}
                </button>
              ) : (
                <button onClick={async () => { await handleSaveNarrative(); if (filledSteps > 0) await generateStory(data) }} disabled={saving || storyLoading} className="text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: (saving || storyLoading) ? "var(--s3)" : "var(--accent)", color: (saving || storyLoading) ? "var(--muted)" : "#071a15" }}>
                  {saving ? "Saving..." : storyLoading ? "Crafting..." : "Save & Regenerate"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Trading Profile (collapsed by default) */}
      <div className="rounded-xl border" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <button onClick={() => setShowProfile(!showProfile)} className="w-full flex items-center justify-between p-4 text-left">
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Trading Profile</span>
            <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
              {data.experience || data.instruments ? "\u2713 Filled" : "Set up your profile"}
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{showProfile ? "\u25b2" : "\u25bc"}</span>
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
                      <button key={opt} onClick={() => setPill(section.key, opt)} className="text-[11px] px-3 py-1.5 rounded-full border transition-all" style={{ background: isSelected ? "rgba(62,232,196,.1)" : "var(--s2)", borderColor: isSelected ? "var(--accent)" : "var(--border)", color: isSelected ? "var(--accent)" : "var(--text2)", fontWeight: isSelected ? 600 : 400 }}>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>Describe your perfect trading day</label>
              <textarea value={data.perfectDay} onChange={(e) => setField("perfectDay", e.target.value)} placeholder="e.g. Wake up early, review levels, take 3-5 trades, stop by 11am..." className="w-full text-sm p-3 rounded-lg border resize-none" style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }} rows={2} />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text)" }}>If you could change ONE thing about your trading?</label>
              <textarea value={data.oneChange} onChange={(e) => setField("oneChange", e.target.value)} placeholder="e.g. Stop revenge trading after losses..." className="w-full text-sm p-3 rounded-lg border resize-none" style={{ background: "var(--s2)", borderColor: "var(--border)", color: "var(--text)" }} rows={2} />
            </div>

            <div className="text-center pt-1">
              <button onClick={handleSaveProfile} disabled={saving} className="text-xs px-5 py-2 rounded-lg font-semibold" style={{ background: saving ? "var(--s3)" : "var(--accent)", color: saving ? "var(--muted)" : "#071a15" }}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
