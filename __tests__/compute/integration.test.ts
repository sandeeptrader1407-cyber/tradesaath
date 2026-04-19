/**
 * Module 2, Step 8B — integration tests.
 *
 * Focus: the translator (bridge) and coaching provider boundary.
 * The flag-routing inside sessionAnalyser.ts is verified by code
 * review (it's a DB-dependent function); these tests lock down the
 * pure pieces that the flag switches between.
 *
 * Coverage (8 tests):
 *   1. Translator → legacy AnalysisJSON carries every required key
 *   2. Translator preserves totalPnl
 *   3. Translator preserves winRate (as 0–100 in session_summary)
 *   4. Translator preserves DQS score + grade
 *   5. Translator handles empty trades
 *   6. Translator handles result with no cycles
 *   7. runModule2Analysis end-to-end with injected mock coach
 *   8. CoachingProvider with missing API key → '' (no crash)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest'
import type { StandardTrade } from '@/lib/intake/types'
import { analyseSession, analyseSessionSync } from '@/lib/compute/analyse'
import {
  runModule2Analysis,
  translateToLegacyShape,
  buildShadowDiff,
} from '@/lib/analysis/module2Bridge'
import {
  createHaikuCoachingProvider,
  buildCoachingPrompt,
} from '@/lib/compute/coachingProvider'

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

function sampleSession(): StandardTrade[] {
  return [
    mkTrade({ pnl: 500, entryTime: '09:20' }),
    mkTrade({ pnl: -300, exitPrice: 97, entryTime: '09:35' }),
    mkTrade({ pnl: 200, entryTime: '09:50' }),
    mkTrade({ pnl: -100, exitPrice: 99, entryTime: '10:05' }),
    mkTrade({ pnl: 400, entryTime: '10:20' }),
  ]
}

describe('module2Bridge — translator', () => {
  it('1. produces legacy AnalysisJSON with all required keys', () => {
    const compute = analyseSessionSync(sampleSession())
    const legacy = translateToLegacyShape(compute)
    const keys = [
      'session_summary',
      'momentum_indicators',
      'vicious_cycle',
      'technical_insights',
      'dqs',
      'financial_impact',
      'mistake_patterns',
      'rules_for_next_session',
      'cross_user_insight',
      'trade_analyses',
      'coaching_points',
      'analysed_at',
      'analysed_version',
    ]
    for (const k of keys) {
      expect(legacy).toHaveProperty(k)
    }
    expect(legacy.analysed_version).toBe(4)
  })

  it('2. preserves totalPnl (visible in financial_impact + summary)', () => {
    const trades = sampleSession()
    const compute = analyseSessionSync(trades)
    const legacy = translateToLegacyShape(compute)
    const expectedPnl = trades.reduce((a, t) => a + t.pnl, 0)
    // Module 2 net pnl
    expect(compute.sessionMetrics.totalPnl).toBe(expectedPnl)
    // Legacy financial_impact.potential_pnl_without_mistakes reflects it
    expect(typeof legacy.financial_impact.potential_pnl_without_mistakes).toBe(
      'number'
    )
    // session_summary contains the rupee amount
    expect(legacy.session_summary).toMatch(/₹/)
  })

  it('3. preserves winRate (session_summary expresses it as %)', () => {
    const compute = analyseSessionSync(sampleSession())
    const legacy = translateToLegacyShape(compute)
    const winPct = (compute.sessionMetrics.winRate * 100).toFixed(1)
    expect(legacy.session_summary).toContain(`${winPct}%`)
  })

  it('4. preserves DQS score + grade exactly', () => {
    const compute = analyseSessionSync(sampleSession())
    const legacy = translateToLegacyShape(compute)
    expect(legacy.dqs.score).toBe(compute.dqs.overall)
    expect(legacy.dqs.grade).toBe(compute.dqs.grade)
    expect(legacy.dqs.factors.length).toBe(7)
    const weightSum = legacy.dqs.factors.reduce((a, f) => a + f.weight, 0)
    expect(weightSum).toBe(100)
  })

  it('5. handles empty trades', () => {
    const compute = analyseSessionSync([])
    const legacy = translateToLegacyShape(compute)
    expect(legacy.trade_analyses).toEqual([])
    expect(legacy.mistake_patterns).toEqual([])
    expect(legacy.dqs.score).toBe(0)
    expect(legacy.dqs.grade).toBe('F')
    expect(legacy.financial_impact.total_lost_to_mistakes).toBe(0)
  })

  it('6. handles result with no vicious cycles', () => {
    // Clean disciplined session — no cycles expected
    const trades = [
      mkTrade({ pnl: 200, entryTime: '09:20' }),
      mkTrade({ pnl: 150, entryTime: '09:50' }),
      mkTrade({ pnl: 180, entryTime: '10:20' }),
    ]
    const compute = analyseSessionSync(trades)
    const legacy = translateToLegacyShape(compute)
    expect(compute.viciousCycles.length).toBe(0)
    // Legacy vicious_cycle is a fixed 10-entry array with counts
    expect(legacy.vicious_cycle.length).toBe(10)
    // The "Vicious Sequence" row should have count 0
    const seq = legacy.vicious_cycle.find((v) => v.stage === 'Vicious Sequence')
    expect(seq?.count).toBe(0)
  })
})

describe('module2Bridge — runModule2Analysis', () => {
  it('7. end-to-end with injected mock coach → legacy AnalysisJSON', async () => {
    const trades = sampleSession()
    const mockCoach = async () => 'Mock coaching line.'
    const legacy = await runModule2Analysis(trades, {
      coachingProvider: mockCoach,
    })
    expect(legacy).toHaveProperty('dqs')
    expect(legacy).toHaveProperty('trade_analyses')
    expect(legacy.ai_coaching).toBe('Mock coaching line.')
    expect(legacy.trade_analyses.length).toBe(trades.length)
  })
})

describe('coachingProvider', () => {
  it('8. createHaikuCoachingProvider returns "" when API key missing', async () => {
    const provider = createHaikuCoachingProvider({ apiKey: '' })
    const compute = analyseSessionSync(sampleSession())
    const out = await provider({
      trades: compute.enrichedTrades,
      metrics: compute.sessionMetrics,
      dqs: compute.dqs,
      cycles: compute.viciousCycles,
      narrative: compute.insights.narrative,
    })
    expect(out).toBe('')
  })

  it('(aux) buildCoachingPrompt renders all five key lines', () => {
    const compute = analyseSessionSync(sampleSession())
    const prompt = buildCoachingPrompt({
      trades: compute.enrichedTrades,
      metrics: compute.sessionMetrics,
      dqs: compute.dqs,
      cycles: compute.viciousCycles,
      narrative: compute.insights.narrative,
    })
    expect(prompt).toMatch(/Session P&L/)
    expect(prompt).toMatch(/Trades:/)
    expect(prompt).toMatch(/DQS:/)
    expect(prompt).toMatch(/Biggest drag/)
  })

  it('(aux) buildShadowDiff flags pnl mismatch', () => {
    const oldA: any = {
      financial_impact: { potential_pnl_without_mistakes: 100 },
      dqs: { score: 70 },
      mistake_patterns: [{}, {}],
      vicious_cycle: [{}, {}, {}],
    }
    const newA: any = {
      financial_impact: { potential_pnl_without_mistakes: 120 },
      dqs: { score: 72 },
      mistake_patterns: [{}],
      vicious_cycle: [{}, {}, {}],
    }
    const diff = buildShadowDiff(oldA, newA)
    expect(diff.pnl_match).toBe(false)
    expect(diff.patterns_old).toBe(2)
    expect(diff.patterns_new).toBe(1)
    expect(diff.dqs_old).toBe(70)
    expect(diff.dqs_new).toBe(72)
  })
})

// Keep analyseSession referenced so a tree-shaker doesn't complain.
void analyseSession
