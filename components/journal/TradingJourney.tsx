"use client"

import { Fragment, useState, useEffect, useRef } from "react"
import { showToast } from "@/components/ui/Toast"

interface TradingJourneyProps {
  /** From parent /api/dashboard/stats. null = still loading; 0 = no
   *  sessions yet; >0 = auto-generate story on mount. */
  sessionCount?: number | null
}

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
    label: "What's your trading goal?",
    options: ["Consistent income", "Capital growth", "Stop losing money", "Go full-time"],
  },
]

// Updated chapter placeholders — contextual, language-neutral
const JOURNEY_STEPS = [
  {
    key: "step1Beginning",
    title: "The Beginning",
    placeholder: "How did you first discover trading? What drew you in?",
  },
  {
    key: "step2DarkDays",
    title: "The Dark Days",
    placeholder: "What was your hardest period? What did it teach you?",
  },
  {
    key: "step3Shift",
    title: "The Shift",
    placeholder: "When did something shift for you as a trader?",
  },
  {
    key: "step4Today",
    title: "Today",
    placeholder: "What defines your current trading style and edge?",
  },
  {
    key: "step5Truth",
    title: "Your Truth",
    placeholder: "Where are you going? What does success look like?",
  },
]

const EMPTY_DATA: JourneyData = {
  experience: "", instruments: "", challenge: "", goal: "",
  perfectDay: "", oneChange: "",
  step1Beginning: "", step2DarkDays: "", step3Shift: "", step4Today: "", step5Truth: "",
}

// Wrap financial figures in DM Mono spans
const MONEY_RE = /[$£€¥₹][\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%/g

function renderParagraph(text: string) {
  const parts = text.split(MONEY_RE)
  const matches = Array.from(text.matchAll(MONEY_RE))
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {matches[i] && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 500 }}>
          {matches[i][0]}
        </span>
      )}
    </Fragment>
  ))
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 0, height: 0, flexShrink: 0, marginLeft: 2,
      borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
      borderTop: open ? 'none' : '5px solid var(--color-muted)',
      borderBottom: open ? '5px solid var(--color-muted)' : 'none',
    }} />
  )
}

// Small ghost button for card header
const ghostSm: React.CSSProperties = {
  height: 32, padding: '0 14px',
  border: '1px solid var(--color-border-strong, #D3D1C7)',
  borderRadius: 6, background: 'transparent', color: 'var(--color-ink)',
  fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 400,
  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.1s',
}

// Full ghost button for nav
const ghostFull: React.CSSProperties = {
  height: 36, padding: '0 16px',
  border: '1px solid var(--color-border-strong, #D3D1C7)',
  borderRadius: 6, background: 'transparent', color: 'var(--color-ink)',
  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.1s',
}

// Chapter loading skeleton with shimmer
function ChapterSkeleton({ delay }: { delay: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {[100, 85, 70].map((w, i) => (
        <div key={i} style={{
          height: 18, width: `${w}%`, background: '#F1EFE8', borderRadius: 3,
          marginBottom: i < 2 ? 10 : 0,
          animation: 'shimmer 1.5s ease infinite',
          animationDelay: `${delay}s`,
        }} />
      ))}
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 16, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)',
}

export default function TradingJourney({ sessionCount = null }: TradingJourneyProps) {
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
  // J1: track whether the journey GET has resolved + whether we've
  // already auto-generated, so the auto-gen effect fires exactly once.
  const [journeyLoaded, setJourneyLoaded] = useState(false)
  const didAutoGen = useRef(false)

  useEffect(() => {
    fetch("/api/user/journey")
      .then(r => r.json())
      .then(d => {
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
        setJourneyLoaded(true)
      })
      .catch(() => setJourneyLoaded(true))
  }, [])

  const generateStory = async (currentData: JourneyData) => {
    setStoryLoading(true); setStoryError(""); setStoryEmpty(false)
    try {
      const res = await fetch("/api/user/journey/story", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step1Beginning: currentData.step1Beginning,
          step2DarkDays:  currentData.step2DarkDays,
          step3Shift:     currentData.step3Shift,
          step4Today:     currentData.step4Today,
          step5Truth:     currentData.step5Truth,
        }),
      })
      const result = await res.json()
      if (result.story) {
        setGeneratedStory(result.story)
        showToast.success("Story updated.")
      } else if (result.empty) {
        setStoryEmpty(true)
        setStoryError(result.error || "Upload your first session to generate your story")
        // No toast for empty — the inline empty-state UI is the message.
      } else {
        const msg = result.error || "Story generation failed"
        setStoryError(msg)
        showToast.error(msg)
      }
    } catch {
      const msg = "Could not generate story. Try again."
      setStoryError(msg)
      showToast.error(msg)
    }
    setStoryLoading(false)
  }

  // J1: auto-generate the story on mount when the user has trade data
  // and no existing story yet. Fires exactly once per mount via ref.
  // Skipped when sessionCount === 0 (would just hit the empty-state
  // path with a wasted API call) or when sessionCount is still null
  // (parent /api/dashboard/stats hasn't resolved yet).
  useEffect(() => {
    if (didAutoGen.current) return
    if (!journeyLoaded) return
    if (sessionCount == null) return
    if (generatedStory) return
    if (sessionCount === 0) return
    didAutoGen.current = true
    generateStory(data)
    // generateStory is a stable reference and `data` is the closure
    // value at the moment journeyLoaded flips true — exactly what we
    // want. Intentionally omitting from deps to fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyLoaded, sessionCount, generatedStory])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/user/journey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (res.ok) showToast.success("Profile saved.")
      else        showToast.error("Could not save profile. Try again.")
    } catch {
      showToast.error("Could not save profile. Try again.")
    }
    setSaving(false)
  }

  const handleShare = async () => {
    if (!generatedStory) return
    try {
      await navigator.clipboard.writeText(`My trading journey:\n\n${generatedStory}\n\nGenerated on TradeSaath`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* silent */ }
  }

  const setPill  = (key: string, value: string) =>
    setData(p => ({ ...p, [key]: p[key as keyof JourneyData] === value ? "" : value }))
  const setField = (key: string, value: string) =>
    setData(p => ({ ...p, [key]: value }))

  const filledSteps = JOURNEY_STEPS.filter(s => data[s.key as keyof JourneyData]).length
  const hasStory    = !!generatedStory
  const storyParas  = generatedStory.split(/\n+/).filter(p => p.trim())

  return (
    <div style={{ maxWidth: 768 }}>
      {/* Global keyframes */}
      <style>{`
        @keyframes shimmer{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}
        .jny-ghost:hover{background:var(--s2,#F5F2EC)!important}
        .jny-ghostsm:hover{background:var(--s2,#F5F2EC)!important}
        .jny-textarea:focus{outline:1.5px solid var(--accent);outline-offset:-1px}
      `}</style>

      {/* ── SECTION 1: Story Card — premium document feel ── */}
      <div style={{
        background: '#FFFFFF',
        border: '0.5px solid var(--color-border)',
        borderRadius: 16,
        padding: '48px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
        marginBottom: 24,
      }} className="story-card-pad">
        <style>{`
          @media(max-width:640px){.story-card-pad{padding:24px!important}}
          @media(max-width:768px){.story-drop-cap{font-size:48px!important}}
        `}</style>

        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--color-ink)', margin: 0 }}>
            Your Trading Story
          </h2>
          {/* Copy + Regenerate only when story exists */}
          {hasStory && !storyLoading && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={handleShare} className="jny-ghostsm" style={ghostSm}>
                {copied ? "Copied!" : "Copy to share"}
              </button>
              <button onClick={() => generateStory(data)} disabled={storyLoading} className="jny-ghostsm"
                style={{ ...ghostSm, opacity: storyLoading ? 0.5 : 1, cursor: storyLoading ? 'not-allowed' : 'pointer' }}>
                Regenerate
              </button>
            </div>
          )}
        </div>

        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, fontStyle: 'italic', color: 'var(--color-muted)', marginTop: 4, marginBottom: 0 }}>
          {hasStory
            ? "Generated from your real trading data · Regenerate anytime"
            : "Auto-generated from your trade history. No typing required."}
        </p>

        <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: '20px 0' }} />

        {/* Generate CTA (first-time) */}
        {!hasStory && !storyLoading && !storyEmpty && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <button onClick={() => generateStory(data)} style={{
              height: 40, padding: '0 24px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'var(--color-canvas)',
              fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 400, cursor: 'pointer',
            }}>
              Generate My Story
            </button>
          </div>
        )}

        {/* Chapter loading skeleton — shimmer animation */}
        {storyLoading && (
          <div style={{ maxWidth: 680 }}>
            {[0, 1, 2].map(i => <ChapterSkeleton key={i} delay={i * 0.2} />)}
            <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', textAlign: 'center', marginTop: 4 }}>
              Crafting your trading story...
            </p>
          </div>
        )}

        {/* Empty state */}
        {storyEmpty && !storyLoading && (
          <div style={{ textAlign: 'center', padding: '24px 16px', borderRadius: 8, background: 'var(--color-canvas)' }}>
            <p style={{ fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 4 }}>
              No trading data yet
            </p>
            <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginBottom: 16 }}>
              Upload your first session to generate your story
            </p>
            <a href="/upload" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 6, background: 'var(--accent)', color: 'var(--color-canvas)', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, textDecoration: 'none' }}>
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

        {/* Story body — editorial, with drop cap + chapter separators */}
        {hasStory && !storyLoading && (
          <div style={{ maxWidth: 680 }}>
            {storyParas.map((para, i) => (
              <Fragment key={i}>
                {/* Thin chapter separator before paragraphs 2+ */}
                {i > 0 && (
                  <div style={{ width: 32, height: 1, background: 'var(--color-border)', margin: '0 0 20px' }} />
                )}
                <p style={{
                  fontSize: 16,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  color: 'var(--color-ink)',
                  lineHeight: 1.9,
                  marginBottom: 24,
                  marginTop: 0,
                }}>
                  {/* Drop cap on first paragraph first letter */}
                  {i === 0 && para.length > 0 ? (
                    <>
                      <span className="story-drop-cap" style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 64,
                        fontWeight: 400,
                        lineHeight: 0.8,
                        float: 'left',
                        marginRight: 8,
                        marginTop: 4,
                        color: 'var(--color-ink)',
                      }}>
                        {para[0]}
                      </span>
                      {renderParagraph(para.slice(1))}
                    </>
                  ) : renderParagraph(para)}
                </p>
                {/* Clear float after first paragraph */}
                {i === 0 && <div style={{ clear: 'both' }} />}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {/* J2: Personalisation sections only render once a story exists, so
          they don't compete with the primary "Generate" CTA on first load.
          Once the story is rendered above, these become "improve this" tools. */}
      {hasStory && (
      <>
      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: '0 0 24px' }} />

      {/* ── J2: Section header explaining what's below ── */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 400,
          color: 'var(--color-ink)',
          margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          Want to make this more personal?
        </h3>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--color-muted)',
          lineHeight: 1.6,
          margin: 0,
        }}>
          Add your voice and trading profile, then regenerate to weave them into your story.
        </p>
      </div>

      {/* ── SECTION 2: Add Your Voice ── */}
      <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', overflow: 'hidden', marginBottom: 16 }}>
        <button
          onClick={() => setShowNarrative(!showNarrative)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={sectionHeaderStyle}>Add Your Voice</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-muted)' }}>
              {filledSteps > 0 ? `${filledSteps}/5 chapters` : "optional. Add your personal narrative."}
            </span>
          </div>
          <Chevron open={showNarrative} />
        </button>

        {showNarrative && (
          <div style={{ padding: '0 20px 20px' }}>
            <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              These are optional. The story above works without them — but if you fill any in, your next regenerate will weave them with your data.
            </p>

            {/* Chapter tab pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {JOURNEY_STEPS.map((s, i) => {
                const filled   = !!data[s.key as keyof JourneyData]
                const isActive = i === activeStep
                return (
                  <button key={s.key} onClick={() => setActiveStep(i)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12,
                    fontFamily: 'var(--font-sans)', fontWeight: isActive ? 500 : 400,
                    cursor: 'pointer', border: '0.5px solid',
                    background: isActive ? 'rgba(15,76,129,.06)' : filled ? 'rgba(15,76,129,.03)' : 'transparent',
                    borderColor: isActive ? 'var(--accent)' : 'var(--color-border)',
                    color: isActive ? 'var(--accent)' : filled ? 'var(--color-ink)' : 'var(--color-muted)',
                    transition: 'all 0.1s',
                  }}>
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                )
              })}
            </div>

            {/* Active chapter textarea */}
            {(() => {
              const step = JOURNEY_STEPS[activeStep]
              return (
                <div key={step.key}>
                  {/* Chapter label */}
                  <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 8px' }}>
                    Chapter {activeStep + 1}: {step.title}
                  </p>
                  <textarea
                    className="jny-textarea"
                    value={data[step.key as keyof JourneyData] || ""}
                    onChange={e => setField(step.key, e.target.value)}
                    placeholder={step.placeholder}
                    rows={4}
                    style={{
                      width: '100%', minHeight: 100, padding: '12px',
                      fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 400,
                      fontStyle: 'italic', color: 'var(--color-ink)',
                      background: '#FFFFFF', border: '0.5px solid var(--color-border)',
                      borderRadius: 6, resize: 'vertical', lineHeight: 1.6,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )
            })()}

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0}
                className="jny-ghost" style={{ ...ghostFull, opacity: activeStep === 0 ? 0.4 : 1, cursor: activeStep === 0 ? 'not-allowed' : 'pointer' }}>
                &larr; Previous
              </button>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                {filledSteps}/5 written
              </span>
              {activeStep < JOURNEY_STEPS.length - 1 ? (
                <button onClick={() => setActiveStep(activeStep + 1)} style={{
                  height: 36, padding: '0 16px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: 'var(--color-canvas)',
                  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, cursor: 'pointer',
                }}>Next &rarr;</button>
              ) : (
                <button onClick={async () => { await handleSaveNarrative(); if (filledSteps > 0) await generateStory(data) }}
                  disabled={saving || storyLoading}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 6, border: 'none',
                    background: (saving || storyLoading) ? 'var(--color-border)' : 'var(--accent)',
                    color: (saving || storyLoading) ? 'var(--color-muted)' : 'var(--color-canvas)',
                    fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
                    cursor: (saving || storyLoading) ? 'not-allowed' : 'pointer',
                  }}>
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
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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
            {/* Description */}
            <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Your profile helps Saathi understand you better and makes the coaching more personalised.
            </p>

            <div className="space-y-4">
              {PROFILE_SECTIONS.map(section => (
                <div key={section.key}>
                  <label style={{ display: 'block', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 8 }}>
                    {section.label}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {section.options.map(opt => {
                      const isSelected = data[section.key as keyof JourneyData] === opt
                      return (
                        <button key={opt} onClick={() => setPill(section.key, opt)} style={{
                          fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: isSelected ? 500 : 400,
                          padding: '5px 12px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', transition: 'all 0.1s',
                          background: isSelected ? 'rgba(15,76,129,.06)' : 'transparent',
                          borderColor: isSelected ? 'var(--accent)' : 'var(--color-border)',
                          color: isSelected ? 'var(--accent)' : 'var(--color-muted)',
                        }}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 6 }}>
                  Describe your perfect trading day
                </label>
                <textarea className="jny-textarea" value={data.perfectDay} onChange={e => setField("perfectDay", e.target.value)}
                  placeholder="e.g. Wake up early, review levels, take 3-5 trades, stop by 11am..." rows={2}
                  style={{ width: '100%', height: 72, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)', background: '#FFFFFF', border: '0.5px solid var(--color-border)', borderRadius: 6, resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 6 }}>
                  If you could change ONE thing about your trading?
                </label>
                <textarea className="jny-textarea" value={data.oneChange} onChange={e => setField("oneChange", e.target.value)}
                  placeholder="e.g. Stop revenge trading after losses..." rows={2}
                  style={{ width: '100%', height: 72, padding: '8px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)', background: '#FFFFFF', border: '0.5px solid var(--color-border)', borderRadius: 6, resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ textAlign: 'center', paddingTop: 4 }}>
                <button onClick={saveProfile} disabled={saving} style={{
                  height: 36, padding: '0 24px', borderRadius: 6, border: 'none',
                  background: saving ? 'var(--color-border)' : 'var(--accent)',
                  color: saving ? 'var(--color-muted)' : 'var(--color-canvas)',
                  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )

  async function handleSaveNarrative() {
    setSaving(true)
    try {
      const res = await fetch("/api/user/journey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (!res.ok) showToast.error("Could not save chapters. Try again.")
      // Success toast is suppressed here — the caller chains generateStory()
      // immediately, and that fires its own "Story updated." toast.
    } catch {
      showToast.error("Could not save chapters. Try again.")
    }
    setSaving(false)
  }
}
