/**
 * Module 2, Layer 7 — SessionInsights tests (15 cases, numbered 16-30).
 */

import { describe, it, expect } from 'vitest'
import type { StandardTrade } from '@/lib/intake/types'
import type {
  DQSResult,
  DetectedPattern,
  ViciousCycle,
  EnrichedTrade,
} from '@/lib/compute/types'
import { enrichTrades } from '@/lib/compute/enrichTrade'
import { computeSessionMetrics } from '@/lib/compute/sessionMetrics'
import { computeSessionInsights } from '@/lib/compute/insights'

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

function mkDQS(overall: number, grade: DQSResult['grade'], drag = 'emotionalControl', ps = 70): DQSResult {
  const mk = (score: number) => ({
    name: '', score, weight: 0, detail: '', suggestion: '',
  })
  return {
    overall,
    grade,
    subScores: {
      riskManagement: mk(overall),
      emotionalControl: mk(overall),
      positionSizing: mk(ps),
      exitDiscipline: mk(overall),
      entryQuality: mk(overall),
      exitTiming: mk(overall),
      ruleFollowing: mk(overall),
    },
    biggestDrag: { factorName: drag, currentScore: 50, potentialImprovement: 30 },
  }
}

function mkCycle(
  severity: ViciousCycle['severity'],
  description: string,
  indices: number[] = [0, 1]
): ViciousCycle {
  return {
    startIndex: indices[0],
    endIndex: indices[indices.length - 1],
    tradeIndices: indices,
    stages: [],
    totalCost: -1000,
    durationMinutes: 30,
    description,
    severity,
  }
}

// ═════════════════════════════════════════════════════════════
describe('computeSessionInsights', () => {
  it('16. empty trades → empty narrative, no trade insights, empty highlights', () => {
    const ins = computeSessionInsights(
      [],
      [],
      [],
      computeSessionMetrics([]),
      mkDQS(0, 'F')
    )
    expect(ins.narrative).toBe('No trades in this session.')
    expect(ins.tradeInsights).toEqual([])
    expect(ins.behavioralHighlights).toEqual([])
    expect(ins.keyStats.turningPoint).toBeNull()
  })

  it('17. narrative: profitable + disciplined → includes "Strong" and grade', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: 300, entryTime: '09:35' }),
      mkTrade({ pnl: 200, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    const ins = computeSessionInsights(trades, [], [], m, mkDQS(85, 'A'))
    expect(ins.narrative).toMatch(/Strong/i)
    expect(ins.narrative).toMatch(/Grade A/)
  })

  it('18. narrative: loss + cycle → includes cycle description', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: -400, exitPrice: 96, entryTime: '09:35' }),
      mkTrade({ pnl: -600, exitPrice: 94, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    const cyc = mkCycle('severe', 'Overconfidence → Oversized → Panic')
    const ins = computeSessionInsights(trades, [], [cyc], m, mkDQS(50, 'D'))
    expect(ins.narrative).toContain('Overconfidence → Oversized → Panic')
    expect(ins.narrative).toMatch(/severe/i)
  })

  it('19. narrative: flat session → "roughly breakeven"', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 0, exitPrice: 100 }),
      mkTrade({ pnl: 0, exitPrice: 100, entryTime: '09:35' }),
    ])
    const m = computeSessionMetrics(trades)
    const ins = computeSessionInsights(trades, [], [], m, mkDQS(75, 'B'))
    expect(ins.narrative).toMatch(/breakeven|Flat/i)
  })

  it('20. narrative under 500 chars', () => {
    // Big loss session with long cycle description
    const trades = enrichTrades(
      Array.from({ length: 10 }, (_, i) =>
        mkTrade({
          index: i,
          pnl: -200,
          exitPrice: 98,
          entryTime: `09:${String(20 + i).padStart(2, '0')}`,
        })
      )
    )
    const m = computeSessionMetrics(trades)
    const longDesc =
      'Overconfidence → Oversized → Market reversal → Hope → Averaging down → Panic exit → Revenge → Tilt → FOMO re-entry'
    const ins = computeSessionInsights(
      trades,
      [],
      [mkCycle('severe', longDesc)],
      m,
      mkDQS(40, 'F')
    )
    expect(ins.narrative.length).toBeLessThanOrEqual(500)
  })

  it('21. TradeInsight for mistake trade uses pattern description, severity warning/critical', () => {
    const trades = enrichTrades([mkTrade({ pnl: -500, exitPrice: 95 })])
    // Spike detectedTag + tagCost directly so we don't need the real detector
    ;(trades[0] as EnrichedTrade).detectedTag = 'revenge'
    ;(trades[0] as EnrichedTrade).tagCost = 3000
    const patterns: DetectedPattern[] = [
      {
        tradeIndex: 0,
        tag: 'revenge',
        confidence: 'high',
        score: 0.9,
        cost: 3000,
        signals: [],
        description: 'Revenge entry seconds after prior loss.',
      },
    ]
    const ins = computeSessionInsights(
      trades,
      patterns,
      [],
      computeSessionMetrics(trades),
      mkDQS(50, 'D')
    )
    expect(ins.tradeInsights[0].insight).toBe('Revenge entry seconds after prior loss.')
    expect(['warning', 'critical']).toContain(ins.tradeInsights[0].severity)
    // cost 3000 >= 2000 → critical
    expect(ins.tradeInsights[0].severity).toBe('critical')
  })

  it('22. TradeInsight for winning disciplined trade → severity positive', () => {
    const trades = enrichTrades([mkTrade({ pnl: 500 })])
    ;(trades[0] as EnrichedTrade).detectedTag = 'disciplined'
    const ins = computeSessionInsights(
      trades,
      [],
      [],
      computeSessionMetrics(trades),
      mkDQS(90, 'A')
    )
    expect(ins.tradeInsights[0].severity).toBe('positive')
    expect(ins.tradeInsights[0].insight).toMatch(/Clean execution/)
  })

  it('23. TradeInsight for breakeven → severity info', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 0, exitPrice: 100, qty: 1 }), // forces isBreakeven
    ])
    ;(trades[0] as EnrichedTrade).detectedTag = null
    ;(trades[0] as EnrichedTrade).isBreakeven = true
    ;(trades[0] as EnrichedTrade).isWin = false
    ;(trades[0] as EnrichedTrade).isLoss = false
    const ins = computeSessionInsights(
      trades,
      [],
      [],
      computeSessionMetrics(trades),
      mkDQS(75, 'B')
    )
    expect(ins.tradeInsights[0].severity).toBe('info')
    expect(ins.tradeInsights[0].insight).toMatch(/Breakeven/)
  })

  it('24. keyStats.biggestWin matches SessionMetrics.bestTradePnl', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: 900, entryTime: '09:35' }),
      mkTrade({ pnl: -50, exitPrice: 99.5, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    const ins = computeSessionInsights(trades, [], [], m, mkDQS(80, 'B'))
    expect(ins.keyStats.biggestWin.amount).toBe(m.bestTradePnl)
    expect(ins.keyStats.biggestWin.tradeIndex).toBe(m.bestTradeIndex)
    expect(ins.keyStats.biggestLoss.amount).toBe(m.worstTradePnl)
  })

  it('25. keyStats.turningPoint null when no turning point', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: 200, entryTime: '09:35' }),
    ])
    const m = computeSessionMetrics(trades)
    const ins = computeSessionInsights(trades, [], [], m, mkDQS(80, 'B'))
    expect(ins.keyStats.turningPoint).toBeNull()
  })

  it('26. highlight: cycle detected → critical severity (severe cycle)', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -500, exitPrice: 95 }),
      mkTrade({ pnl: -500, exitPrice: 95, entryTime: '09:35' }),
    ])
    const m = computeSessionMetrics(trades)
    const cyc = mkCycle('severe', 'Overconfidence → Oversized → Panic')
    const ins = computeSessionInsights(trades, [], [cyc], m, mkDQS(40, 'F'))
    const cycHl = ins.behavioralHighlights.find(h => h.title === 'Emotional Cycle Detected')
    expect(cycHl).toBeDefined()
    expect(cycHl!.severity).toBe('critical')
  })

  it('27. highlight: clean session → info severity', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: 300, entryTime: '09:35' }),
    ])
    const m = computeSessionMetrics(trades)
    const ins = computeSessionInsights(trades, [], [], m, mkDQS(90, 'A'))
    const cleanHl = ins.behavioralHighlights.find(h => h.title === 'Clean Session')
    expect(cleanHl).toBeDefined()
    expect(cleanHl!.severity).toBe('info')
  })

  it('28. highlights sorted critical-first', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -500, exitPrice: 95 }),
      mkTrade({ pnl: 500, entryTime: '09:35' }),
    ])
    // Mix of critical + info highlights: high DQS (clean), severe cycle, consistent sizing
    const m = computeSessionMetrics(trades)
    const cyc = mkCycle('severe', 'severe cycle')
    const ins = computeSessionInsights(
      trades,
      [],
      [cyc],
      m,
      mkDQS(86, 'A', 'emotionalControl', 90)
    )
    const rankMap = { critical: 0, warning: 1, info: 2 }
    const ranks = ins.behavioralHighlights.map(h => rankMap[h.severity])
    const sortedRanks = [...ranks].sort((a, b) => a - b)
    expect(ranks).toEqual(sortedRanks)
  })

  it('29. highlights limited to 6', () => {
    // Force many triggers: cycle + overtrading + revenge + consistent sizing
    // + clean session + high win rate + outsized loss
    const trades = enrichTrades(
      Array.from({ length: 10 }, (_, i) =>
        mkTrade({
          index: i,
          pnl: i < 7 ? 100 : -200, // 7 wins 3 losses → winRate 0.7
          exitPrice: i < 7 ? 101 : 98,
          entryTime: `09:${String(20 + i).padStart(2, '0')}`,
        })
      )
    )
    const m = computeSessionMetrics(trades)
    const patterns: DetectedPattern[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        tradeIndex: i, tag: 'overtrading' as const, confidence: 'high' as const,
        score: 0.9, cost: 100, signals: [], description: 'overtrading',
      })),
      { tradeIndex: 7, tag: 'revenge' as const, confidence: 'high' as const,
        score: 0.9, cost: 1000, signals: [], description: 'rv' },
      { tradeIndex: 8, tag: 'revenge' as const, confidence: 'high' as const,
        score: 0.9, cost: 1000, signals: [], description: 'rv' },
    ]
    const cyc = mkCycle('severe', 'severe cycle')
    const ins = computeSessionInsights(
      trades,
      patterns,
      [cyc],
      m,
      mkDQS(86, 'A', 'emotionalControl', 90)
    )
    expect(ins.behavioralHighlights.length).toBeLessThanOrEqual(6)
  })

  it('30. aiCoaching field is empty string (wiring in Step 8)', () => {
    const trades = enrichTrades([mkTrade({ pnl: 100 })])
    const m = computeSessionMetrics(trades)
    const ins = computeSessionInsights(trades, [], [], m, mkDQS(80, 'B'))
    expect(ins.aiCoaching).toBe('')
  })
})
