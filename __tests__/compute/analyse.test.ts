/**
 * Module 2, Step 8A — analyseSession orchestrator tests (25 cases).
 *
 * Coverage map:
 *   Basic orchestration            (1–10)
 *   Layer integration invariants   (11–17)
 *   AI coaching                    (18–22)
 *   Sync sibling                   (23–25)
 */

import { describe, it, expect } from 'vitest'
import type { StandardTrade } from '@/lib/intake/types'
import {
  analyseSession,
  analyseSessionSync,
  COMPUTE_VERSION,
} from '@/lib/compute/analyse'
import {
  mockCoachingProvider,
  slowCoachingProvider,
  failingCoachingProvider,
  nonStringCoachingProvider,
  capturingCoachingProvider,
} from './mockCoaching'

// ────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────

function mkTrade(over: Partial<StandardTrade> = {}): StandardTrade {
  return {
    index: 0,
    symbol: 'RELIANCE',
    side: 'BUY',
    qty: 100,
    entryPrice: 100,
    exitPrice: 101,
    pnl: 100,
    date: '2026-04-15',
    entryTime: '09:20',
    exitTime: '09:30',
    ...over,
  } as StandardTrade
}

/** Small realistic session: 5 trades, mix of wins/losses. */
function smallSession(): StandardTrade[] {
  return [
    mkTrade({ pnl: 500, entryTime: '09:20', exitTime: '09:30' }),
    mkTrade({
      pnl: -300,
      exitPrice: 97,
      entryTime: '09:35',
      exitTime: '09:45',
    }),
    mkTrade({ pnl: 200, entryTime: '09:50', exitTime: '10:00' }),
    mkTrade({
      pnl: -100,
      exitPrice: 99,
      entryTime: '10:05',
      exitTime: '10:15',
    }),
    mkTrade({ pnl: 400, entryTime: '10:20', exitTime: '10:30' }),
  ]
}

// ────────────────────────────────────────────────────────────────────
// Section 1 — Basic orchestration (10 tests)
// ────────────────────────────────────────────────────────────────────

describe('analyseSession — basic orchestration', () => {
  it('1. empty trades → valid zero-valued ComputeResult', async () => {
    const r = await analyseSession([])
    expect(r.version).toBe(COMPUTE_VERSION)
    expect(r.enrichedTrades).toEqual([])
    expect(r.sessionMetrics.totalTrades).toBe(0)
    expect(r.patterns).toEqual([])
    expect(r.viciousCycles).toEqual([])
    expect(r.dqs.overall).toBe(0)
    expect(r.dqs.grade).toBe('F')
    expect(r.insights.aiCoaching).toBe('')
  })

  it('2. non-empty → enrichedTrades length matches input', async () => {
    const trades = smallSession()
    const r = await analyseSession(trades)
    expect(r.enrichedTrades.length).toBe(trades.length)
  })

  it('3. version equals COMPUTE_VERSION', async () => {
    const r = await analyseSession(smallSession())
    expect(r.version).toBe(COMPUTE_VERSION)
    expect(typeof COMPUTE_VERSION).toBe('number')
  })

  it('4. analysedAt is a valid ISO timestamp', async () => {
    const r = await analyseSession(smallSession())
    expect(typeof r.analysedAt).toBe('string')
    expect(() => new Date(r.analysedAt).toISOString()).not.toThrow()
    expect(new Date(r.analysedAt).toISOString()).toBe(r.analysedAt)
  })

  it('5. processingTimeMs is a non-negative number', async () => {
    const r = await analyseSession(smallSession())
    expect(typeof r.processingTimeMs).toBe('number')
    expect(r.processingTimeMs).toBeGreaterThanOrEqual(0)
  })

  it('6. warnings is an array (empty when nothing went wrong)', async () => {
    const r = await analyseSession(smallSession())
    expect(Array.isArray(r.warnings)).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('7. null/undefined trades treated as empty', async () => {
    // @ts-expect-error — deliberately passing null to assert safe fallback
    const r = await analyseSession(null)
    expect(r.enrichedTrades).toEqual([])
    expect(r.sessionMetrics.totalTrades).toBe(0)
  })

  it('8. aiCoaching defaults to empty string (no provider)', async () => {
    const r = await analyseSession(smallSession())
    expect(r.insights.aiCoaching).toBe('')
  })

  it('9. ComputeResult shape contains every Module 2 field', async () => {
    const r = await analyseSession(smallSession())
    const keys = [
      'version',
      'analysedAt',
      'enrichedTrades',
      'sessionMetrics',
      'patterns',
      'patternSummary',
      'viciousCycles',
      'dqs',
      'insights',
      'perSymbol',
      'timeSlots30min',
      'timeSlots60min',
      'dayOfWeek',
      'holdingDistribution',
      'bestWorstTrades',
      'equityCurve',
      'warnings',
      'processingTimeMs',
    ] as const
    for (const k of keys) {
      expect(r).toHaveProperty(k)
    }
  })

  it('10. enrichedTrades carry tradeIndex/tradeNumberInSession', async () => {
    const r = await analyseSession(smallSession())
    r.enrichedTrades.forEach((t, i) => {
      expect(t.tradeIndex).toBe(i)
      expect(t.tradeNumberInSession).toBe(i + 1)
    })
  })
})

// ────────────────────────────────────────────────────────────────────
// Section 2 — Layer integration invariants (7 tests)
// ────────────────────────────────────────────────────────────────────

describe('analyseSession — layer integration', () => {
  it('11. sessionMetrics.totalTrades matches enrichedTrades.length', async () => {
    const r = await analyseSession(smallSession())
    expect(r.sessionMetrics.totalTrades).toBe(r.enrichedTrades.length)
  })

  it('12. dqs.overall is bounded [0,100] and grade is valid', async () => {
    const r = await analyseSession(smallSession())
    expect(r.dqs.overall).toBeGreaterThanOrEqual(0)
    expect(r.dqs.overall).toBeLessThanOrEqual(100)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(r.dqs.grade)
  })

  it('13. insights.narrative is a non-empty string', async () => {
    const r = await analyseSession(smallSession())
    expect(typeof r.insights.narrative).toBe('string')
    expect(r.insights.narrative.length).toBeGreaterThan(0)
  })

  it('14. bestTradePnl matches top5Wins[0].pnl when wins exist', async () => {
    const r = await analyseSession(smallSession())
    if (r.bestWorstTrades.top5Wins.length > 0) {
      expect(r.sessionMetrics.bestTradePnl).toBe(
        r.bestWorstTrades.top5Wins[0].pnl
      )
    }
  })

  it('15. equityCurve length equals enrichedTrades length', async () => {
    const trades = smallSession()
    const r = await analyseSession(trades)
    expect(r.equityCurve.length).toBe(trades.length)
  })

  it('16. perSymbol covers every distinct symbol exactly once', async () => {
    const trades = [
      mkTrade({ symbol: 'RELIANCE', pnl: 100 }),
      mkTrade({ symbol: 'INFY', pnl: -50, entryTime: '09:35' }),
      mkTrade({ symbol: 'RELIANCE', pnl: 200, entryTime: '09:50' }),
    ]
    const r = await analyseSession(trades)
    const symbols = r.perSymbol.map((p) => p.symbol).sort()
    expect(symbols).toEqual(['INFY', 'RELIANCE'])
  })

  it('17. patterns only reference valid tradeIndex values', async () => {
    const r = await analyseSession(smallSession())
    const maxIdx = r.enrichedTrades.length - 1
    for (const p of r.patterns) {
      expect(p.tradeIndex).toBeGreaterThanOrEqual(0)
      expect(p.tradeIndex).toBeLessThanOrEqual(maxIdx)
    }
  })
})

// ────────────────────────────────────────────────────────────────────
// Section 3 — AI coaching (5 tests)
// ────────────────────────────────────────────────────────────────────

describe('analyseSession — AI coaching', () => {
  it('18. mock provider result lands on insights.aiCoaching', async () => {
    const r = await analyseSession(smallSession(), {
      coachingProvider: mockCoachingProvider,
    })
    expect(r.insights.aiCoaching).toContain('Coach:')
    expect(r.warnings).toEqual([])
  })

  it('19. failing provider → warning pushed, aiCoaching stays empty', async () => {
    const r = await analyseSession(smallSession(), {
      coachingProvider: failingCoachingProvider,
    })
    expect(r.insights.aiCoaching).toBe('')
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings[0]).toMatch(/AI coaching failed/i)
    expect(r.warnings[0]).toMatch(/boom/)
  })

  it('20. non-string return is coerced to empty string', async () => {
    const r = await analyseSession(smallSession(), {
      coachingProvider: nonStringCoachingProvider,
    })
    expect(r.insights.aiCoaching).toBe('')
    expect(r.warnings).toEqual([])
  })

  it('21. slow provider aborted by coachingTimeoutMs → warning', async () => {
    const r = await analyseSession(smallSession(), {
      coachingProvider: slowCoachingProvider(500),
      coachingTimeoutMs: 50,
    })
    expect(r.insights.aiCoaching).toBe('')
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings[0]).toMatch(/timed out/i)
  })

  it('22. provider receives ctx with trades/metrics/dqs/cycles/narrative', async () => {
    const cap = capturingCoachingProvider()
    const r = await analyseSession(smallSession(), {
      coachingProvider: cap.provider,
    })
    const ctx = cap.getCapturedCtx()
    expect(ctx).not.toBeNull()
    expect(ctx!.trades.length).toBe(r.enrichedTrades.length)
    expect(ctx!.metrics.totalTrades).toBe(r.sessionMetrics.totalTrades)
    expect(ctx!.dqs.overall).toBe(r.dqs.overall)
    expect(Array.isArray(ctx!.cycles)).toBe(true)
    expect(typeof ctx!.narrative).toBe('string')
  })
})

// ────────────────────────────────────────────────────────────────────
// Section 4 — Sync sibling (3 tests)
// ────────────────────────────────────────────────────────────────────

describe('analyseSessionSync', () => {
  it('23. empty input → valid zero-valued result, aiCoaching empty', () => {
    const r = analyseSessionSync([])
    expect(r.version).toBe(COMPUTE_VERSION)
    expect(r.enrichedTrades).toEqual([])
    expect(r.insights.aiCoaching).toBe('')
  })

  it('24. sync output matches async output (minus timing + aiCoaching)', async () => {
    const trades = smallSession()
    const asyncR = await analyseSession(trades)
    const syncR = analyseSessionSync(trades)
    expect(syncR.enrichedTrades.length).toBe(asyncR.enrichedTrades.length)
    expect(syncR.sessionMetrics.totalPnl).toBe(asyncR.sessionMetrics.totalPnl)
    expect(syncR.dqs.overall).toBe(asyncR.dqs.overall)
    expect(syncR.patterns.length).toBe(asyncR.patterns.length)
    expect(syncR.insights.narrative).toBe(asyncR.insights.narrative)
  })

  it('25. sync always returns aiCoaching=""', () => {
    const r = analyseSessionSync(smallSession())
    expect(r.insights.aiCoaching).toBe('')
  })
})
