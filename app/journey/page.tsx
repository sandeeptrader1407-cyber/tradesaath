"use client"

import { PlanGate } from "@/components/PlanGate"
import TradingJourney from "@/components/journal/TradingJourney"

function JourneyContent() {
  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, color: 'var(--text)' }}>
            {'\uD83D\uDDFA\uFE0F'} Trading Journey
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
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
