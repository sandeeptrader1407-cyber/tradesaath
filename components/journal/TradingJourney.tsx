"use client"

import { Fragment, useState, useEffect } from "react"

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
    label: "What’s your trading goal?",
    options: ["Consistent income", "Capital growth", "Stop losing money", "Go full-time"],
  },
]

const JOURNEY_STEPS = [
  { key: "step1Beginning", title: "The Beginning",  prompt: "Why did you start trading? What excited you about it?",                   placeholder: "e.g. I saw a friend make money in F&O and thought I could too..." },
  { key: "step2DarkDays",  title: "The Dark Days",  prompt: "What was your worst period? What happened?",                              placeholder: "e.g. I blew my first 2L account in 3 months. Revenge traded every day..." },
  { key: "step3Shift",     title: "The Shift",      prompt: "What moment changed your approach?",                                      placeholder: "e.g. One day I looked at my journal and saw 47 revenge trades in a month..." },
  { key: "step4Today",     title: "Today",          prompt: "Where are you now? What’s your current reality?",                   placeholder: "e.g. I’m profitable 3 out of 4 weeks now. Still struggle with sizing..." },
  { key: "step5Truth",     title: "Your Truth",     prompt: "What one thing do you know now that you wish you knew then?",             placeholder: "e.g. Trading is 90% psychology. No strategy works if you can’t follow it." },
]

const EMPTY_DATA: JourneyData = {
  experience: "", instruments: "", challenge: "", goal: "",
  perfectDay: "", oneChange: "",
  step1Beginning: "", step2DarkDays: "", step3Shift: "", step4Today: "", step5Truth: "",
}

// Wrap ₹ amounts and percentages in DM Mono spans so financial data
// stands out typographically within the prose narrative.
const MONEY_RE = /₹[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%/g

function renderParagraph(text: string) {
  const parts = text.split(MONEY_RE)
  const matches = Array.from(text.matchAll(MONEY_RE))
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {matches[i] && (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          {matches[i][0]}
        </span>
      )}
    </Fragment>
  ))
}

// CSS border-trick triangle chevron
function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 0,
      height: 0,
      borderLeft: '5px solid transparent',
      borderRight: '5px solid transparent',
      borderTop: open ? 'none' : '5px solid var(--color-muted)',
      borderBottom: open ? '5px solid var(--color-muted)' : 'none',
      flexShrink: 0,
      marginLeft: 2,
    }} />
  )
}

// Ghost button — shared style for Copy and Regenerate
const ghostBtn: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  border: '1px solid var(--color-border-strong, #D3D1C7)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--color-ink)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  fontWeight: 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background 0.1s',
}

// Skeleton paragraph block for loading state
function SkeletonParagraph() {
  return (
    <div style={{ marginBottom: 20 }}>
      {[100, 80, 60].map((w, i) => (
        <div key={i} style={{
          height: 20,
          borderRadius: 4,
          background: 'var(--color-surface-raised, #F1EFE8)',
          width: `${w}%`,
          marginBottom: i < 2 ? 10 : 0,
          animation: 'sk-pulse 1.4s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
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
            experience:     d.journey.experience          || "",
            instruments:    d.journey.instruments         || "",
            challenge:      d.journey.challenge           || "",
            goal:           d.journey.goal                || "",
            perfectDay:     d.journey.perfect_day         || "",
            oneChange:      d.journey.one_change          || "",
            step1Beginning: d.journey.step_1_beginning    || "",
            step2DarkDays:  d.journey.step_2_dark_days    || "",
            step3Shift:     d.journey.step_3_shift        || "",
            step4Today:     d.journey.step_4_today        || "",
            step5Truth:     d.journey.step_5_truth        || "",
          })
          if (d.journey.generated_story) setGeneratedStory(d.journey.generated_story)
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
          step2DarkDays:  currentData.step2DarkDays,
          step3Shift:     currentData.step3Shift,
          step4Today:     currentData.step4Today,
          step5Truth:     currentData.step5Truth,
        }),
      })
      const result = await res.json()
      if (result.story)       setGeneratedStory(result.story)
      else if (result.empty)  { setStoryEmpty(true); setStoryError(result.error || "Upload your first session to generate your story") }
      else                    setStoryError(result.error || "Story generation failed")
    } catch {
      setStoryError("Could not generate story. Try again.")
    }
    setStoryLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    try { await fetch("/api/user/journey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) }
    catch { /* silent */ }
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

  const setPill = (key: string, value: string) =>
    setData((prev) => ({ ...prev, [key]: prev[key as keyof JourneyData] === value ? "" : value }))

  const setField = (key: string, value: string) =>
    setData((prev) => ({ ...prev, [key]: value }))

  const filledSteps = JOURNEY_STEPS.filter((s) => data[s.key as keyof JourneyData]).length
  const hasStory    = !!generatedStory

  // Story paragraphs (split on blank lines or single newlines)
  const storyParas  = generatedStory.split(/\n+/).filter(p => p.trim())

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 16,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    color: 'var(--color-ink)',
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Skeleton pulse keyframes */}
      <style>{`@keyframes sk-pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      {/* Ghost button hover via global class */}
      <style>{`.jny-ghost:hover{background:var(--color-surface-raised,#F5F2EC)!important}`}</style>
      {/* Textarea focus ring */}
      <style>{`.jny-textarea:focus{outline:1.5px solid var(--accent);outline-offset:-1px}`}</style>

      {/* ── SECTION 1: Your Trading Story ── */}
      <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', padding: '24px' }}>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 400,
              color: 'var(--color-ink)',
              margin: 0,
            }}>
              Your Trading Story
            </h2>
            <p style={{
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--color-muted)',
              marginTop: 4,
            }}>
              {hasStory
                ? "Generated from your real trading data. Regenerate anytime."
                : "Auto-generated from your trade history. No typing required."}
            </p>
          </div>
          {!hasStory && !storyLoading && !storyEmpty && (
            <button
              onClick={() => generateStory(data)}
              style={{
                height: 36,
                padding: '0 16px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--color-canvas)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Generate My Story
            </button>
          )}
        </div>

        {/* Loading — skeleton paragraphs, no emoji */}
        {storyLoading && (
          <div style={{ padding: '8px 0' }}>
            {[0, 1, 2, 3].map((i) => <SkeletonParagraph key={i} />)}
            <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>
              Crafting your trading story...
            </p>
          </div>
        )}

        {/* Empty state — no emoji */}
        {storyEmpty && !storyLoading && (
          <div style={{ textAlign: 'center', padding: '32px 16px', borderRadius: 8, background: 'var(--color-canvas)' }}>
            <p style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 4 }}>
              No trading data yet
            </p>
            <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginBottom: 16 }}>
              Upload your first session to generate your story
            </p>
            <a href="/" style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'var(--color-canvas)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              textDecoration: 'none',
            }}>
              Upload trades &rarr;
            </a>
          </div>
        )}

        {/* Error */}
        {storyError && !storyEmpty && !storyLoading && (
          <div style={{ borderRadius: 6, border: '0.5px solid rgba(192,57,43,.2)', padding: '10px 14px', marginBottom: 12, background: 'rgba(192,57,43,.04)' }}>
            <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-loss)', margin: 0 }}>{storyError}</p>
          </div>
        )}

        {/* Story body — editorial typography, money in mono */}
        {hasStory && !storyLoading && (
          <>
            <div>
              {storyParas.map((para, i) => (
                <p key={i} style={{
                  fontSize: 16,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  color: 'var(--color-ink)',
                  lineHeight: 1.85,
                  marginBottom: 20,
                  marginTop: 0,
                }}>
                  {renderParagraph(para)}
                </p>
              ))}
            </div>

            {/* Action buttons — ghost, plain text, no icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, borderTop: '0.5px solid var(--color-border)', flexWrap: 'wrap' }}>
              <button
                onClick={handleShare}
                className="jny-ghost"
                style={ghostBtn}
              >
                {copied ? "Copied!" : "Copy to share"}
              </button>
              <button
                onClick={() => generateStory(data)}
                disabled={storyLoading}
                className="jny-ghost"
                style={{ ...ghostBtn, opacity: storyLoading ? 0.55 : 1, cursor: storyLoading ? 'not-allowed' : 'pointer' }}
              >
                Regenerate
              </button>
              {filledSteps === 0 && (
                <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginLeft: 'auto' }}>
                  Want a more personal story? Add your voice below
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Divider between sections */}
      <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: 0 }} />

      {/* ── SECTION 2: Add Your Voice ── */}
      <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', overflow: 'hidden' }}>
        <button
          onClick={() => setShowNarrative(!showNarrative)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={sectionHeaderStyle}>Add Your Voice</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-muted)' }}>
              {filledSteps > 0 ? `${filledSteps}/5 chapters written` : "optional — add your personal narrative"}
            </span>
          </div>
          <Chevron open={showNarrative} />
        </button>

        {showNarrative && (
          <div style={{ padding: '0 20px 20px' }}>
            <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              These are optional. The story above works without them — but if you fill any in, your next regenerate will weave them with your data.
            </p>

            {/* Step tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {JOURNEY_STEPS.map((s, i) => {
                const filled   = !!data[s.key as keyof JourneyData]
                const isActive = i === activeStep
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveStep(i)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer',
                      border: '0.5px solid',
                      background: isActive ? 'rgba(15,76,129,.06)' : filled ? 'rgba(15,76,129,.03)' : 'transparent',
                      borderColor: isActive ? 'var(--accent)' : 'var(--color-border)',
                      color: isActive ? 'var(--accent)' : filled ? 'var(--color-ink)' : 'var(--color-muted)',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                )
              })}
            </div>

            {/* Active step textarea */}
            {(() => {
              const step = JOURNEY_STEPS[activeStep]
              return (
                <div key={step.key}>
                  <div style={{ marginBottom: 10 }}>
                    <h4 style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 4px' }}>
                      Step {activeStep + 1}: {step.title}
                    </h4>
                    <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', margin: 0 }}>{step.prompt}</p>
                  </div>
                  <textarea
                    className="jny-textarea"
                    value={data[step.key as keyof JourneyData] || ""}
                    onChange={(e) => setField(step.key, e.target.value)}
                    placeholder={step.placeholder}
                    rows={4}
                    style={{
                      width: '100%',
                      height: 100,
                      minHeight: 100,
                      padding: '10px 12px',
                      fontSize: 14,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 400,
                      color: 'var(--color-ink)',
                      background: '#FFFFFF',
                      border: '0.5px solid var(--color-border)',
                      borderRadius: 6,
                      resize: 'vertical',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )
            })()}

            {/* Step navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                className="jny-ghost"
                style={{ ...ghostBtn, opacity: activeStep === 0 ? 0.4 : 1, cursor: activeStep === 0 ? 'not-allowed' : 'pointer' }}
              >
                &larr; Previous
              </button>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                {filledSteps}/5 written
              </span>
              {activeStep < JOURNEY_STEPS.length - 1 ? (
                <button
                  onClick={() => setActiveStep(activeStep + 1)}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 6, border: 'none',
                    background: 'var(--accent)', color: 'var(--color-canvas)',
                    fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, cursor: 'pointer',
                  }}
                >
                  Next &rarr;
                </button>
              ) : (
                <button
                  onClick={async () => { await handleSaveNarrative(); if (filledSteps > 0) await generateStory(data) }}
                  disabled={saving || storyLoading}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 6, border: 'none',
                    background: (saving || storyLoading) ? 'var(--color-border)' : 'var(--accent)',
                    color: (saving || storyLoading) ? 'var(--color-muted)' : 'var(--color-canvas)',
                    fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
                    cursor: (saving || storyLoading) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? "Saving..." : storyLoading ? "Crafting..." : "Save & Regenerate"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3: Trading Profile ── */}
      <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', overflow: 'hidden' }}>
        <button
          onClick={() => setShowProfile(!showProfile)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={sectionHeaderStyle}>Trading Profile</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-muted)' }}>
              {data.experience || data.instruments ? "Filled" : "Set up your profile"}
            </span>
          </div>
          <Chevron open={showProfile} />
        </button>

        {showProfile && (
          <div style={{ padding: '0 20px 20px' }}>
            <div className="space-y-4">
              {PROFILE_SECTIONS.map((section) => (
                <div key={section.key}>
                  <label style={{
                    display: 'block',
                    fontSize: 13,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    marginBottom: 8,
                  }}>
                    {section.label}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {section.options.map((opt) => {
                      const isSelected = data[section.key as keyof JourneyData] === opt
                      return (
                        <button
                          key={opt}
                          onClick={() => setPill(section.key, opt)}
                          style={{
                            fontSize: 12,
                            fontFamily: 'var(--font-sans)',
                            fontWeight: isSelected ? 500 : 400,
                            padding: '5px 12px',
                            borderRadius: 20,
                            border: '0.5px solid',
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                            background: isSelected ? 'rgba(15,76,129,.06)' : 'transparent',
                            borderColor: isSelected ? 'var(--accent)' : 'var(--color-border)',
                            color: isSelected ? 'var(--accent)' : 'var(--color-muted)',
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Free-form fields */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 6 }}>
                  Describe your perfect trading day
                </label>
                <textarea
                  className="jny-textarea"
                  value={data.perfectDay}
                  onChange={(e) => setField("perfectDay", e.target.value)}
                  placeholder="e.g. Wake up early, review levels, take 3-5 trades, stop by 11am..."
                  rows={2}
                  style={{
                    width: '100%', height: 72, padding: '8px 12px',
                    fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 400,
                    color: 'var(--color-ink)', background: '#FFFFFF',
                    border: '0.5px solid var(--color-border)', borderRadius: 6,
                    resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 6 }}>
                  If you could change ONE thing about your trading?
                </label>
                <textarea
                  className="jny-textarea"
                  value={data.oneChange}
                  onChange={(e) => setField("oneChange", e.target.value)}
                  placeholder="e.g. Stop revenge trading after losses..."
                  rows={2}
                  style={{
                    width: '100%', height: 72, padding: '8px 12px',
                    fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 400,
                    color: 'var(--color-ink)', background: '#FFFFFF',
                    border: '0.5px solid var(--color-border)', borderRadius: 6,
                    resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ textAlign: 'center', paddingTop: 4 }}>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  style={{
                    height: 36, padding: '0 24px', borderRadius: 6, border: 'none',
                    background: saving ? 'var(--color-border)' : 'var(--accent)',
                    color: saving ? 'var(--color-muted)' : 'var(--color-canvas)',
                    fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Keep handleSaveNarrative in scope for the Save & Regenerate button
  async function handleSaveNarrative() {
    setSaving(true)
    try { await fetch("/api/user/journey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }) }
    catch { /* silent */ }
    setSaving(false)
  }
}
