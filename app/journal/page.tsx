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

  // Detect recurring patterns from session analysis data
  useEffect(() => {
    if (sessions.length < 2) return
    const tagCounts: Record<string, { count: number; sessions: number; cost: number; recentCount: number; olderCount: number }> = {}
    const midpoint = Math.floor(sessions.length / 2)

    sessions.forEach((sess, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analysis = sess.analysis as any
      if (!analysis) return

      // Count from trade_analyses (new format)
      const tradeAnalyses = analysis.trade_analyses || []
      const seenTags = new Set<string>()
      for (const ta of tradeAnalyses) {
        if (ta.tag && ta.tag !== 'win') {
          const tag = ta.tag as string
          if (!tagCounts[tag]) tagCounts[tag] = { count: 0, sessions: 0, cost: 0, recentCount: 0, olderCount: 0 }
          tagCounts[tag].count++
          if (!seenTags.has(tag)) { tagCounts[tag].sessions++; seenTags.add(tag) }
          if (ta.pnl && ta.pnl < 0) tagCounts[tag].cost += Math.abs(ta.pnl)
          if (idx < midpoint) tagCounts[tag].recentCount++
          else tagCounts[tag].olderCount++
        }
      }

      // Count from mistake_patterns (legacy)
      if (analysis.mistake_patterns) {
        for (const mp of analysis.mistake_patterns) {
          const tag = (mp.name || '').toLowerCase().replace(/\s+/g, '_')
          if (!tag) continue
          if (!tagCounts[tag]) tagCounts[tag] = { count: 0, sessions: 0, cost: 0, recentCount: 0, olderCount: 0 }
          tagCounts[tag].count += (mp.count || 1)
          tagCounts[tag].cost += Math.abs(mp.cost || 0)
        }
      }
    })

    const TAG_LABELS: Record<string, string> = {
      rvg: 'Revenge Trading after losses',
      fomo: 'FOMO entries chasing momentum',
      pnc: 'Panic exits at the worst moment',
      avg: 'Averaging down on losing trades',
      vs: 'Vicious cycle cascade trades',
      revenge_trading: 'Revenge Trading after losses',
      fomo_entry: 'FOMO entries chasing momentum',
      overtrading: 'Overtrading beyond your edge',
    }

    const detected: PatternAlert[] = Object.entries(tagCounts)
      .filter(([, v]) => v.count >= 3 && v.sessions >= 2) // recurring = 3+ occurrences across 2+ sessions
      .map(([tag, v]) => {
        let trend: 'worsening' | 'improving' | 'stable' = 'stable'
        if (v.recentCount > v.olderCount * 1.3) trend = 'worsening'
        else if (v.olderCount > v.recentCount * 1.3) trend = 'improving'
        return {
          name: TAG_LABELS[tag] || tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          tag,
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
    const match = sessions.find((s) => s.trade_date === date)
    if (match) setActiveId(match.id)
  }

  const trendConfig: Record<string, { label: string; color: string; icon: string }> = {
    worsening: { label: 'Getting worse', color: 'var(--red)', icon: '\u2191' },
    improving: { label: 'Improving', color: 'var(--green)', icon: '\u2193' },
    stable: { label: 'Stable', color: 'var(--gold)', icon: '\u2192' },
  }

  return (
    <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto">
        {/* Pattern Alert Cards */}
        {patterns.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {patterns.map((p, i) => {
              const t = trendConfig[p.trend]
              return (
                <div key={i} style={{
                  borderLeft: '4px solid var(--purple)',
                  background: 'rgba(157,122,247,.04)',
                  border: '1px solid rgba(157,122,247,.15)',
                  borderLeftWidth: 4,
                  borderLeftColor: 'var(--purple)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  marginBottom: i < patterns.length - 1 ? 8 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {'\u26A0\uFE0F'} Recurring Behaviour Detected
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Cost: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--red)', fontWeight: 600 }}>
                        {'\u20B9'}{p.cost.toLocaleString('en-IN')}
                      </span>
                      {' across '}
                      <span style={{ fontWeight: 600 }}>{p.sessions}</span> sessions
                      {' \u00B7 '}
                      <span style={{ fontWeight: 600 }}>{p.count}</span> occurrences
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {t.icon} {t.label}
                    </span>
                    <Link href="/coach?tab=patterns" style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--purple)',
                      padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(157,122,247,.1)',
                      textDecoration: 'none', whiteSpace: 'nowrap',
                    }}>
                      View in Saathi {'\u2192'}
                    </Link>
                  </div>
                </div>
              )
            })}
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
