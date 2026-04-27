"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { PlanGate } from "@/components/PlanGate"
import SessionList from "@/components/journal/SessionList"
import SessionDetail from "@/components/journal/SessionDetail"
import CalendarCard from "@/components/journal/CalendarCard"
import JournalStats from "@/components/journal/JournalStats"

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

interface PatternAlert {
  name: string
  tag: string
  count: number
  sessions: number
  cost: number
  trend: 'worsening' | 'improving' | 'stable'
}

function JournalContent() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [patterns, setPatterns] = useState<PatternAlert[]>([])
  const [patternsExpanded, setPatternsExpanded] = useState(false)

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

  useEffect(() => {
    if (sessions.length < 2) return
    const patternTotals: Record<
      string,
      { count: number; sessions: number; cost: number; recentCount: number; olderCount: number }
    > = {}
    const midpoint = Math.floor(sessions.length / 2)

    sessions.forEach((sess, idx) => {
      const analysis = sess.analysis as Record<string, unknown> | null
      if (!analysis) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp = analysis.mistake_patterns as any[] | undefined
      if (!Array.isArray(mp) || mp.length === 0) return

      for (const p of mp) {
        const name = String(p?.name || '').trim()
        const count = Number(p?.count || 0)
        const cost = Math.abs(Number(p?.cost || 0))
        if (!name || count <= 0) continue
        if (!patternTotals[name]) {
          patternTotals[name] = { count: 0, sessions: 0, cost: 0, recentCount: 0, olderCount: 0 }
        }
        patternTotals[name].count += count
        patternTotals[name].sessions += 1
        patternTotals[name].cost += cost
        if (idx < midpoint) patternTotals[name].recentCount += count
        else patternTotals[name].olderCount += count
      }
    })

    const NAME_TO_TAG: Record<string, string> = {
      'Revenge Trade': 'rvg', 'Averaging Down': 'avg', 'FOMO Entry': 'fomo',
      'Panic Exit': 'pnc', 'Overtrading': 'over', 'Oversized': 'size', 'Late Exit': 'late',
    }
    const NAME_DESCRIPTIONS: Record<string, string> = {
      'Revenge Trade': 'Revenge Trading after losses',
      'Averaging Down': 'Averaging down on losing trades',
      'FOMO Entry': 'FOMO entries chasing momentum',
      'Panic Exit': 'Panic exits at the worst moment',
      'Overtrading': 'Overtrading beyond your edge',
      'Oversized': 'Oversized position entries',
      'Late Exit': 'Holding losers too long',
    }

    const detected: PatternAlert[] = Object.entries(patternTotals)
      .filter(([, v]) => v.count >= 3 && v.sessions >= 2)
      .map(([name, v]) => {
        let trend: 'worsening' | 'improving' | 'stable' = 'stable'
        if (v.recentCount > v.olderCount * 1.3) trend = 'worsening'
        else if (v.olderCount > v.recentCount * 1.3) trend = 'improving'
        return {
          name: NAME_DESCRIPTIONS[name] || name,
          tag: NAME_TO_TAG[name] || name.toLowerCase().replace(/\s+/g, '_'),
          count: v.count,
          sessions: v.sessions,
          cost: Math.round(v.cost),
          trend,
        }
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3)

    setPatterns(detected)
  }, [sessions])

  const detailRef = useRef<HTMLDivElement>(null)
  const activeSession = sessions.find((s) => s.id === activeId) || null
  // Derive active date from active session for CalendarCard selected-day highlight
  const activeDate = activeSession?.trade_date ?? null

  useEffect(() => {
    if (!activeId || !detailRef.current) return
    if (window.innerWidth <= 768) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeId])

  const handleDateSelect = (date: string) => {
    const matches = sessions.filter((s) => s.trade_date === date)
    if (matches.length === 0) return
    const currentIdx = matches.findIndex((s) => s.id === activeId)
    const next = currentIdx >= 0 && currentIdx < matches.length - 1 ? matches[currentIdx + 1] : matches[0]
    setActiveId(next.id)
  }

  const trendLabel: Record<string, { label: string; color: string }> = {
    worsening: { label: 'Getting worse', color: 'var(--color-loss)' },
    improving:  { label: 'Improving',     color: 'var(--color-profit)' },
    stable:     { label: 'Stable',        color: 'var(--color-muted)' },
  }

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: 'var(--color-canvas)' }}>
      {/* Amber pattern banner colour tokens */}
      <style>{`:root{
        --pattern-banner-bg:#FAEEDA;
        --pattern-banner-border:#BA7517;
        --pattern-banner-text:#854F0B;
      }`}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Pattern detection banner — amber, no emoji */}
        {patterns.length > 0 && (
          <div style={{
            background: 'var(--pattern-banner-bg)',
            borderLeft: '3px solid var(--pattern-banner-border)',
            borderRadius: '0 6px 6px 0',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            color: 'var(--pattern-banner-text)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Patterns detected:
                </span>
                {patterns.slice(0, 3).map((p, i) => (
                  <span key={i} style={{ whiteSpace: 'nowrap' }}>
                    {p.name}&nbsp;<span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>({p.count}x)</span>
                    {i < Math.min(patterns.length, 3) - 1 && (
                      <span style={{ margin: '0 4px', opacity: 0.4 }}>&middot;</span>
                    )}
                  </span>
                ))}
                {patterns.length > 3 && (
                  <span style={{ opacity: 0.7, fontStyle: 'italic' }}>and {patterns.length - 3} more</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setPatternsExpanded(!patternsExpanded)}
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--pattern-banner-text)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {patternsExpanded ? 'Hide' : 'Details'}
                </button>
                <Link href="/coach?tab=patterns" style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--pattern-banner-text)',
                  padding: '3px 10px',
                  borderRadius: 5,
                  border: '0.5px solid var(--pattern-banner-border)',
                  background: 'rgba(186,119,23,.08)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)',
                }}>
                  Saathi &rarr;
                </Link>
              </div>
            </div>

            {patternsExpanded && (
              <div style={{ marginTop: 10, borderTop: '0.5px solid rgba(186,119,23,.3)', paddingTop: 10 }}>
                {patterns.map((p, i) => {
                  const t = trendLabel[p.trend]
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      padding: '5px 0',
                      borderBottom: i < patterns.length - 1 ? '0.5px solid rgba(186,119,23,.15)' : 'none',
                    }}>
                      <span style={{ fontWeight: 500, color: 'var(--pattern-banner-text)', minWidth: 160, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                        {p.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 400, color: 'var(--pattern-banner-text)', opacity: 0.8 }}>
                        {p.count}x in {p.sessions} sessions
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--color-loss)' }}>
                        &#8377;{p.cost.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: t.color, fontFamily: 'var(--font-sans)' }}>
                        {t.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* Empty state — no emoji */}
        {!loading && sessions.length === 0 && (
          <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', padding: '48px 24px', textAlign: 'center', background: '#FFFFFF' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 8 }}>
              No sessions yet
            </h2>
            <p style={{ fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Upload your first trading session to start building your journal.
            </p>
            <a
              href="/upload"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
                background: 'var(--accent)',
                color: 'var(--color-canvas)',
                textDecoration: 'none',
              }}
            >
              Upload First Session &rarr;
            </a>
          </div>
        )}

        {/* Main journal layout */}
        {!loading && sessions.length > 0 && (
          <>
            <JournalStats sessions={sessions} />

            <div className="flex flex-col md:flex-row gap-4">
              {/* Left panel */}
              <div className="w-full md:w-[280px] shrink-0">
                <CalendarCard
                  sessions={sessions}
                  onSelectDate={handleDateSelect}
                  activeDate={activeDate}
                />
                <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'hidden', background: '#FFFFFF' }}>
                  <SessionList sessions={sessions} activeId={activeId} onSelect={setActiveId} />
                </div>
              </div>

              {/* Right panel */}
              <div ref={detailRef} style={{ flex: 1, borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'hidden', background: '#FFFFFF' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <SessionDetail session={activeSession as any} />
              </div>
            </div>
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
