"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { PlanGate } from "@/components/PlanGate"
import SessionList from "@/components/journal/SessionList"
import SessionDetail from "@/components/journal/SessionDetail"
import CalendarCard from "@/components/journal/CalendarCard"
import TradingJourney from "@/components/journal/TradingJourney"
import JournalStats from "@/components/journal/JournalStats"

type TabType = "sessions" | "journey"

interface Session {
  id: string
  created_at: string
  trade_date: string
  detected_market: string
  trade_count: number
  net_pnl: number
  win_count: number
  loss_count: number
  win_rate: number
  trades: unknown
  analysis: unknown
}

function JournalContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "journey" ? "journey" : "sessions"
  const [tab, setTab] = useState<TabType>(initialTab as TabType)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/journal/sessions")
      .then((r) => r.json())
      .then((d) => {
        setSessions(d.sessions || [])
        if (d.sessions?.length > 0) setActiveId(d.sessions[0].id)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const activeSession = sessions.find((s) => s.id === activeId) || null

  const handleDateSelect = (date: string) => {
    const match = sessions.find((s) => s.trade_date === date)
    if (match) setActiveId(match.id)
  }

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "var(--s2)" }}>
          <button
            onClick={() => setTab("sessions")}
            className="text-sm px-5 py-2 rounded-lg font-semibold transition-all"
            style={{
              background: tab === "sessions" ? "var(--s1)" : "transparent",
              color: tab === "sessions" ? "var(--text)" : "var(--muted)",
            }}
          >
            Sessions
          </button>
          <button
            onClick={() => setTab("journey")}
            className="text-sm px-5 py-2 rounded-lg font-semibold transition-all"
            style={{
              background: tab === "journey" ? "var(--s1)" : "transparent",
              color: tab === "journey" ? "var(--text)" : "var(--muted)",
            }}
          >
            Trading Journey
          </button>
        </div>

        {tab === "journey" && <TradingJourney />}

        {tab === "sessions" && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="rounded-xl border p-12 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                <div className="text-4xl mb-4">📓</div>
                <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>No sessions yet</h2>
                <p className="text-sm mb-5" style={{ color: "var(--text2)" }}>Upload your first trading session to start building your journal.</p>
                <a href="/upload" className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--accent)", color: "#071a15" }}>
                  Upload First Session &rarr;
                </a>
              </div>
            )}

            {!loading && sessions.length > 0 && (
              <>
                <JournalStats sessions={sessions} />

                <div className="flex flex-col md:flex-row gap-4">
                  {/* Left panel */}
                  <div className="w-full md:w-[280px] shrink-0">
                    <CalendarCard sessions={sessions} onSelectDate={handleDateSelect} />
                    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                      <SessionList sessions={sessions} activeId={activeId} onSelect={setActiveId} />
                    </div>
                  </div>

                  {/* Right panel */}
                  <div className="flex-1 rounded-xl border overflow-hidden" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                    <SessionDetail session={activeSession as any} />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function JournalPage() {
  return (
    <PlanGate required="paid">
      <JournalContent />
    </PlanGate>
  )
}
