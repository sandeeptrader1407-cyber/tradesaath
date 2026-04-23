"use client"

import { PlanGate } from "@/components/PlanGate"
import TradingJourney from "@/components/journal/TradingJourney"

function JourneyContent() {
  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Page header — no emoji, no icon */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 400,
            color: 'var(--color-ink)',
            lineHeight: 1.15,
            margin: 0,
          }}>
            Trading Journey
          </h1>
          <p style={{
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            color: 'var(--color-muted)',
            marginTop: 6,
          }}>
            Your trading profile, goals, and growth story
          </p>
        </div>
        <TradingJourney />
      </div>
    </main>
  )
}

export default function JourneyPage() {
  return (
    <PlanGate required="paid">
      <JourneyContent />
    </PlanGate>
  )
}
