"use client"

import { useState, useEffect } from "react"
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

  // Detect recurring patterns from session analysis data.
  //
  // Reads the already-computed `mistake_patterns` array from each session's
  // `analysis` JSONB — these are the canonical per-session counts/costs
  // produced server-side by the analyser (both legacy and Module 2 paths
  // emit the same shape via `buildAnalysisJSON`). No re-detection here.
  //
  // Trend: sessions are ordered newest-first, so index < midpoint is the
  // recent half. Compare recent vs older count per pattern name.
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic analysis JSON
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

    // Map canonical `mistake_patterns.name` values to display strings +
    // stable tag slugs consumed by the link targets below.
    const NAME_TO_TAG: Record<string, string> = {
      'Revenge Trade': 'rvg',
      'Averaging Down': 'avg',
      'FOMO Entry': 'fomo',
      'Panic Exit': 'pnc',
      'Overtrading': 'over',
      'Oversized': 'size',
      'Late Exit': 'late',
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
      .filter(([, v]) => v.count >= 3 && v.sessions >= 2) // recurring = 3+ occurrences across 2+ sessions
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
      .slice(0, 3) // top 3 patterns

    setPatterns(detected)
  }, [sessions])

  const activeSession = sessions.find((s) => s.id === activeId) || null

  const handleDateSelect = (date: string) => {
    // If already viewing a session from this date, cycle to next one
    const matches = sessions.filter((s) => s.trade_date === date)
    if (matches.length === 0) return
    const currentIdx = matches.findIndex((s) => s.id === activeId)
    const next = currentIdx >= 0 && currentIdx < matches.length - 1 ? matches[currentIdx + 1] : matches[0]
    setActiveId(next.id)
  }

  const trendConfig: Record<string, { label: string; color: string; icon: string }> = {
    worsening: { label: 'Getting worse', color: 'var(--red)', icon: '\u2191' },
    improving: { label: 'Improving', color: 'var(--green)', icon: '\u2193' },
    stable: { label: 'Stable', color: 'var(--gold)', icon: '\u2192' },
  }

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Compact Pattern Banner */}
        {patterns.length > 0 && (
          <div style={{
            borderLeft: '3px solid var(--purple)',
            background: 'rgba(157,122,247,.04)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--purple)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {"\u26A0\uFE0F"} Patterns:
                </span>
                {patterns.slice(0, 3).map((p, i) => (
                  <span key={i} style={{ color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {p.name} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--muted)' }}>({p.count}x)</span>
                    {i < Math.min(patterns.length, 3) - 1 ? <span style={{ color: 'var(--border)', margin: '0 2px' }}>{" \u00B7 "}</span> : null}
                  </span>
                ))}
                {patterns.length > 3 && (
                  <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>and {patterns.length - 3} more</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setPatternsExpanded(!patternsExpanded)}
                  style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 6px', whiteSpace: 'nowrap',
                  }}
                >
                  {patternsExpanded ? 'Hide \u25B2' : 'Details \u25BC'}
                </button>
                <Link href="/coach?tab=patterns" style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--purple)',
                  padding: '3px 8px', borderRadius: 5,
                  background: 'rgba(157,122,247,.1)',
                  textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                  Saathi {"\u2192"}
                </Link>
              </div>
            </div>
            {patternsExpanded && (
              <div style={{ marginTop: 10, borderTop: '1px solid rgba(157,122,247,.12)', paddingTop: 10 }}>
                {patterns.map((p, i) => {
                  const t = trendConfig[p.trend]
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      padding: '6px 0',
                      borderBottom: i < patterns.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 160, fontSize: 12 }}>{p.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted)' }}>{p.count}x in {p.sessions} sessions</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--red)' }}>
                        {"\u20B9"}{p.cost.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: t.color }}>{t.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="rounded-xl border p-12 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
            <div className="text-4xl mb-4">{'\uD83D\uDCD3'}</div>
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
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- session type varies */}
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
