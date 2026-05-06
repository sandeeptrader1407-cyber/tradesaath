"use client"

import { useState, useEffect } from 'react'
import { PlanGate } from "@/components/PlanGate"
import TradingJourney from "@/components/journal/TradingJourney"

interface MiniStats {
  sessionCount: number
  totalTrades: number
  allTime: { winRate: number } | null
}

function JourneyContent() {
  const [stats, setStats] = useState<MiniStats | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(d => setStats({
        sessionCount: d.sessionCount || 0,
        totalTrades: d.totalTrades || 0,
        allTime: d.allTime || null,
      }))
      .catch(() => {})
  }, [])

  const pills = [
    { label: 'Sessions', value: (stats?.sessionCount || 0).toLocaleString() },
    { label: 'Trades',   value: (stats?.totalTrades || 0).toLocaleString() },
    { label: 'Win Rate', value: stats?.allTime ? `${stats.allTime.winRate}%` : '—' },
  ]

  return (
    <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: '#F8FAFC' }}>
      <style>{`
        @media(max-width:640px){
          .journey-stats-col{display:none!important}
          .journey-header{flex-direction:column!important}
        }
        @media(max-width:768px){
          .journey-title{font-size:28px!important}
          .journey-sub{font-size:13px!important}
        }
      `}</style>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Two-column page header */}
        <div className="journey-header" style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 40,
          marginBottom: 40,
        }}>
          {/* Left — title copy */}
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#94A3B8',
              margin: '0 0 12px',
            }}>
              Your Trading Story
            </p>
            <h1 className="journey-title" style={{
              fontFamily: 'var(--font-display)',
              fontSize: 44,
              fontWeight: 400,
              color: '#0F172A',
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              margin: '0 0 12px',
            }}>
              The story only your trades can tell.
            </h1>
            <p className="journey-sub" style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 400,
              color: '#64748B',
              lineHeight: 1.6,
              margin: 0,
            }}>
              Generated from your real trade data: every win, every loss, every pattern. Unique to you.
            </p>
          </div>

          {/* Right — stat pills */}
          <div className="journey-stats-col" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, paddingTop: 6 }}>
            {pills.map(pill => (
              <div key={pill.label} style={{
                background: '#FFFFFF',
                border: '0.5px solid #E2E8F0',
                borderRadius: 10,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                minWidth: 160,
              }}>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 10,
                  fontWeight: 400,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#94A3B8',
                  minWidth: 60,
                }}>
                  {pill.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 20,
                  fontWeight: 500,
                  color: '#0F172A',
                }}>
                  {pill.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* J1: pass sessionCount so TradingJourney can decide whether to
            auto-generate the story on mount (only fire when the user has
            data — empty-state path is a no-op API call otherwise). */}
        <TradingJourney sessionCount={stats?.sessionCount ?? null} />
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
