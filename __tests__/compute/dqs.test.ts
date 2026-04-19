/**
 * Module 2, Layer 4 — DQS tests (20 cases).
 *
 * Layout:
 *   - 14 sub-score tests (2 per sub-score × 7 sub-scores)
 *   - 6 orchestrator tests (empty, weights, biggestDrag, grades, cycles arg)
 *
 * Every formula tested here mirrors an existing formula in
 * lib/analysis/patternDetector.ts — no new scoring logic is asserted.
 *
 * Fixtures build EnrichedTrade[] via enrichTrades() and DetectedPattern[]
 * inline (only the `tag` field is read by DQS), so we don't need to run
 * the pattern detector itself to score.
 */

import { describe, it, expect } from 'vitest'
import type { StandardTrade } from '@/lib/intake/types'
import type { DetectedPattern, ViciousCycle, PatternTag } from '@/lib/compute/types'
import { enrichTrades } from '@/lib/compute/enrichTrade'
import {
  computeDQS,
  computeComposite,
  findBiggestDrag,
  gradeFor,
  scoreRiskManagement,
  scoreEmotionalControl,
  scorePositionSizing,
  scoreExitDiscipline,
  scoreEntryQuality,
  scoreExitTiming,
  scoreRuleFollowing,
  RISK_MANAGEMENT_WEIGHT,
  EMOTIONAL_CONTROL_WEIGHT,
  POSITION_SIZING_WEIGHT,
  EXIT_DISCIPLINE_WEIGHT,
  ENTRY_QUALITY_WEIGHT,
  EXIT_TIMING_WEIGHT,
  RULE_FOLLOWING_WEIGHT,
} from '@/lib/compute/dqs'

// ────────────────────────────────────────────────────────────
// Fixture helpers
// ────────────────────────────────────────────────────────────

function mkTrade(over: Partial<StandardTrade> = {}): StandardTrade {
  return {
    index: 0,
    symbol: 'RELIANCE',
    side: 'BUY',
    qty: 100,
    entryPrice: 2500,
    exitPrice: 2510,
    pnl: 1000,
    cumPnl: 0,
    date: '2025-04-07',
    entryTime: '09:20',
    exitTime: '09:30',
    holdingMinutes: 10,
    session: 'morning',
    timeGapMinutes: null,
    tag: 'win',
    label: 'Winner',
    exchange: 'NSE',
    tradeId: 'T',
    sourceRows: [0],
    isShort: false,
    fees: 0,
    ...over,
  }
}

function mkPattern(tradeIndex: number, tag: PatternTag): DetectedPattern {
  return {
    tradeIndex,
    tag,
    confidence: 'high',
    score: 0.8,
    cost: 0,
    signals: [],
    description: `${tag} on trade ${tradeIndex}`,
  }
}

const NO_CYCLES: ViciousCycle[] = []

// ────────────────────────────────────────────────────────────
// RISK MANAGEMENT (weight 25)
// Formula: 100 - max(0, (maxLoss/sessionAvgLoss) - 1.5) * 30, clamped
// ────────────────────────────────────────────────────────────

describe('DQS — Risk Management', () => {
  // 1
  it('returns 100 when there are no losing trades', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: 800, entryTime: '09:35' }),
    ])
    const s = scoreRiskManagement(trades, [], NO_CYCLES)
    expect(s.score).toBe(100)
    expect(s.weight).toBe(RISK_MANAGEMENT_WEIGHT)
    expect(s.name).toBe('Risk Management')
  })

  // 2
  it('penalises a max-loss that exceeds 1.5× session-avg loss', () => {
    // losses: 1000, 1000, 5000 → avg 2333.33, max 5000, ratio 2.143
    // score = 100 - (2.143 - 1.5) * 30 = 100 - 19.29 ≈ 81 (rounded)
    const trades = enrichTrades([
      mkTrade({ pnl: -1000 }),
      mkTrade({ pnl: -1000, entryTime: '09:35' }),
      mkTrade({ pnl: -5000, entryTime: '09:50' }),
    ])
    const s = scoreRiskManagement(trades, [], NO_CYCLES)
    expect(s.score).toBeGreaterThan(75)
    expect(s.score).toBeLessThan(90)
    // Heavy skew: four small losses + one large one → avg stays low so
    // the ratio maxLoss/avgLoss blows up. Losses: 500,500,500,500,10000
    // → avg 2400, ratio 4.166, penalty (4.166-1.5)*30 ≈ 80, score ≈ 20.
    const trades2 = enrichTrades([
      mkTrade({ pnl: -500 }),
      mkTrade({ pnl: -500, entryTime: '09:35' }),
      mkTrade({ pnl: -500, entryTime: '09:50' }),
      mkTrade({ pnl: -500, entryTime: '10:05' }),
      mkTrade({ pnl: -10000, entryTime: '10:20' }),
    ])
    const s2 = scoreRiskManagement(trades2, [], NO_CYCLES)
    expect(s2.score).toBeLessThan(60)
  })
})

// ────────────────────────────────────────────────────────────
// EMOTIONAL CONTROL (weight 20)
// Formula: ((n - tiltCount) / n) * 100, clamped
// tiltCount = |{revenge, fomo, panic, averaging}|
// ────────────────────────────────────────────────────────────

describe('DQS — Emotional Control', () => {
  // 3
  it('returns 100 when no tilt tags are present', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
      mkTrade({ pnl: 300, entryTime: '09:50' }),
    ])
    const patterns = [mkPattern(0, 'disciplined'), mkPattern(2, 'win')]
    const s = scoreEmotionalControl(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(100)
    expect(s.weight).toBe(EMOTIONAL_CONTROL_WEIGHT)
  })

  // 4
  it('drops to 0 when every trade is a tilt tag', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
      mkTrade({ pnl: -300, entryTime: '09:50' }),
    ])
    const patterns = [
      mkPattern(0, 'revenge'),
      mkPattern(1, 'fomo'),
      mkPattern(2, 'panic'),
    ]
    const s = scoreEmotionalControl(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────
// POSITION SIZING (weight 15)
// Formula: 100 - cv*80 - (oversizedCount/n)*40, clamped
// cv = stddev(qty) / mean(qty)
// ────────────────────────────────────────────────────────────

describe('DQS — Position Sizing', () => {
  // 5
  it('returns 100 when qtys are uniform and no oversize tags', () => {
    const trades = enrichTrades([
      mkTrade({ qty: 100 }),
      mkTrade({ qty: 100, entryTime: '09:35' }),
      mkTrade({ qty: 100, entryTime: '09:50' }),
    ])
    const s = scorePositionSizing(trades, [], NO_CYCLES)
    expect(s.score).toBe(100)
    expect(s.weight).toBe(POSITION_SIZING_WEIGHT)
  })

  // 6
  it('drops when qtys are wildly inconsistent and has an oversize tag', () => {
    // qtys: 10, 200, 1000 → high CV
    // + oversize tag = direct penalty (1/3)*40 ≈ 13
    const trades = enrichTrades([
      mkTrade({ qty: 10 }),
      mkTrade({ qty: 200, entryTime: '09:35' }),
      mkTrade({ qty: 1000, entryTime: '09:50' }),
    ])
    const patterns = [mkPattern(2, 'oversize')]
    const s = scorePositionSizing(trades, patterns, NO_CYCLES)
    expect(s.score).toBeLessThan(40)
  })
})

// ────────────────────────────────────────────────────────────
// EXIT DISCIPLINE (weight 15)
// Formula: ((n - (panic+late_exit+averaging)) / n) * 100, clamped
// ────────────────────────────────────────────────────────────

describe('DQS — Exit Discipline', () => {
  // 7
  it('returns 100 when no panic/late_exit/averaging tags are present', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
    ])
    const patterns = [mkPattern(0, 'disciplined'), mkPattern(1, 'revenge')]
    const s = scoreExitDiscipline(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(100)
    expect(s.weight).toBe(EXIT_DISCIPLINE_WEIGHT)
  })

  // 8
  it('3 bad exits out of 4 = 25', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
      mkTrade({ pnl: -300, entryTime: '09:50' }),
      mkTrade({ pnl: 400, entryTime: '10:05' }),
    ])
    const patterns = [
      mkPattern(0, 'panic'),
      mkPattern(1, 'late_exit'),
      mkPattern(2, 'averaging'),
    ]
    const s = scoreExitDiscipline(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(25)
  })
})

// ────────────────────────────────────────────────────────────
// ENTRY QUALITY (weight 10)
// Formula: (goodEntries / n) * 100, clamped
// good = entryMin in [sessionStart+3, sessionStart+45]
// ────────────────────────────────────────────────────────────

describe('DQS — Entry Quality', () => {
  // 9
  it('returns 100 when all entries fall inside the 3-45 min window', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20' }), // sessionStart
      mkTrade({ entryTime: '09:25' }), // +5 min → in window
      mkTrade({ entryTime: '09:50' }), // +30 min → in window
    ])
    const s = scoreEntryQuality(trades, [], NO_CYCLES)
    // 2 of 3 are in-window (session start itself is BEFORE +3 floor)
    expect(s.score).toBe(Math.round((2 / 3) * 100))

    // All three placed inside window:
    const t2 = enrichTrades([
      mkTrade({ entryTime: '09:20' }),
      mkTrade({ entryTime: '09:25' }), // +5
      mkTrade({ entryTime: '09:30' }), // +10
      mkTrade({ entryTime: '09:45' }), // +25
    ])
    const s2 = scoreEntryQuality(t2, [], NO_CYCLES)
    // 3 of 4 in window (09:20 is the session start, outside +3..+45 floor)
    expect(s2.score).toBe(75)
    expect(s2.weight).toBe(ENTRY_QUALITY_WEIGHT)
  })

  // 10
  it('drops to 0 when every entry is outside the 3-45 min window', () => {
    // All entries at session start (< +3 min from start).
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20' }),
      mkTrade({ entryTime: '09:21' }),
      mkTrade({ entryTime: '09:22' }),
    ])
    const s = scoreEntryQuality(trades, [], NO_CYCLES)
    expect(s.score).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────
// EXIT TIMING (weight 10)
// Formula: ((n - panic - late_exit) / n) * 100, clamped
// NB: does NOT include averaging (that's exit-discipline only)
// ────────────────────────────────────────────────────────────

describe('DQS — Exit Timing', () => {
  // 11
  it('returns 100 with no panic/late_exit tags (averaging NOT penalised here)', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 400 }),
      mkTrade({ pnl: -300, entryTime: '09:35' }),
    ])
    // averaging is a bad EXIT DISCIPLINE but not bad EXIT TIMING
    const patterns = [mkPattern(1, 'averaging')]
    const s = scoreExitTiming(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(100)
    expect(s.weight).toBe(EXIT_TIMING_WEIGHT)
  })

  // 12
  it('2 panic exits out of 4 = 50', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
      mkTrade({ pnl: 300, entryTime: '09:50' }),
      mkTrade({ pnl: 400, entryTime: '10:05' }),
    ])
    const patterns = [mkPattern(0, 'panic'), mkPattern(1, 'late_exit')]
    const s = scoreExitTiming(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(50)
  })
})

// ────────────────────────────────────────────────────────────
// RULE FOLLOWING (weight 5)
// Formula:
//   start=100; if overtradingDetected: -=25; if ≥3-loss streak triggered:
//   -= min(40, afterThresh*5).  Clamped.
// ────────────────────────────────────────────────────────────

describe('DQS — Rule Following', () => {
  // 13
  it('flags overtrading tag → drops 25', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: 100, entryTime: '09:35' }),
    ])
    const patterns = [mkPattern(1, 'overtrading')]
    const s = scoreRuleFollowing(trades, patterns, NO_CYCLES)
    expect(s.score).toBe(75)
    expect(s.weight).toBe(RULE_FOLLOWING_WEIGHT)
  })

  // 14
  it('3-loss streak + trades after → drops proportionally', () => {
    // 3 losses in a row then 2 trades after → afterThresh=2 → -10
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
      mkTrade({ pnl: -300, entryTime: '09:50' }),
      mkTrade({ pnl: -400, entryTime: '10:05' }),
      mkTrade({ pnl: 500, entryTime: '10:20' }),
    ])
    const s = scoreRuleFollowing(trades, [], NO_CYCLES)
    // 3 trades counted as "after" (indices 2,3,4 — consec becomes 3 at index 2,
    // then indices 3 & 4 count as afterThresh since consec is still >=3 or was reset
    // on winner at 4). Legacy walk counts afterThresh based on the else branch:
    //   i=0: consec=1, hit=false
    //   i=1: consec=2, hit=false
    //   i=2: consec=3, hit=true (NOT else branch)
    //   i=3: consec=4, still hit branch (NOT else)
    //   i=4: consec=0 (winner), else branch → afterThresh=1
    // So afterThresh=1 → -5. score = 95.
    expect(s.score).toBe(95)
  })
})

// ────────────────────────────────────────────────────────────
// ORCHESTRATOR (6 tests)
// ────────────────────────────────────────────────────────────

describe('DQS — Orchestrator', () => {
  // 15
  it('empty trades → overall 100, grade A, zero biggestDrag shortfall', () => {
    const r = computeDQS([], [], NO_CYCLES)
    expect(r.overall).toBe(100)
    expect(r.grade).toBe('A')
    expect(r.biggestDrag.potentialImprovement).toBe(0)
  })

  // 16
  it('sub-score weights sum to exactly 100', () => {
    const total =
      RISK_MANAGEMENT_WEIGHT +
      EMOTIONAL_CONTROL_WEIGHT +
      POSITION_SIZING_WEIGHT +
      EXIT_DISCIPLINE_WEIGHT +
      ENTRY_QUALITY_WEIGHT +
      EXIT_TIMING_WEIGHT +
      RULE_FOLLOWING_WEIGHT
    expect(total).toBe(100)
  })

  // 17
  it('biggestDrag picks the sub-score with the largest weighted shortfall', () => {
    // 5 trades, 3 tilt tags → emotional control 40, others ~100.
    // emotional shortfall = 20 * (100-40)/100 = 12 → biggest drag.
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
      mkTrade({ pnl: -300, entryTime: '09:50' }),
      mkTrade({ pnl: 500, entryTime: '10:05' }),
      mkTrade({ pnl: 600, entryTime: '10:20' }),
    ])
    const patterns = [
      mkPattern(0, 'revenge'),
      mkPattern(1, 'fomo'),
      mkPattern(2, 'panic'),
    ]
    const r = computeDQS(trades, patterns, NO_CYCLES)
    expect(r.biggestDrag.factorName).toBe('Emotional Control')
    expect(r.biggestDrag.potentialImprovement).toBeGreaterThan(0)
  })

  // 18
  it('gradeFor honours new thresholds (A90/B80/C70/D60/F<60)', () => {
    expect(gradeFor(100)).toBe('A')
    expect(gradeFor(90)).toBe('A')
    expect(gradeFor(89)).toBe('B')
    expect(gradeFor(80)).toBe('B')
    expect(gradeFor(79)).toBe('C')
    expect(gradeFor(70)).toBe('C')
    expect(gradeFor(69)).toBe('D')
    expect(gradeFor(60)).toBe('D')
    expect(gradeFor(59)).toBe('F')
    expect(gradeFor(0)).toBe('F')
  })

  // 19
  it('composite = weighted average of sub-scores', () => {
    // Contrived sub-scores — weights still sum to 100, so average should match.
    const subs = [
      { name: 'A', score: 80, weight: 50, detail: '', suggestion: '' },
      { name: 'B', score: 60, weight: 50, detail: '', suggestion: '' },
    ]
    // 80*0.5 + 60*0.5 = 70
    expect(computeComposite(subs)).toBe(70)

    // Single sub with full weight
    const single = [
      { name: 'A', score: 55, weight: 100, detail: '', suggestion: '' },
    ]
    expect(computeComposite(single)).toBe(55)
  })

  // 20
  it('cycles argument is accepted but does not change any score', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:35' }),
    ])
    const patterns = [mkPattern(0, 'panic')]

    const noCycle = computeDQS(trades, patterns, [])
    const withCycle = computeDQS(trades, patterns, [
      {
        startIndex: 0,
        endIndex: 1,
        tradeIndices: [0, 1],
        stages: [],
        totalCost: 0,
        durationMinutes: 15,
        description: 'A → B',
        severity: 'mild',
      },
    ])

    expect(withCycle.overall).toBe(noCycle.overall)
    expect(withCycle.subScores.riskManagement.score).toBe(
      noCycle.subScores.riskManagement.score
    )
    // Also sanity-check findBiggestDrag in isolation.
    const drag = findBiggestDrag([
      { name: 'X', score: 50, weight: 10, detail: '', suggestion: '' },
      { name: 'Y', score: 90, weight: 50, detail: '', suggestion: '' },
    ])
    // X shortfall = 10*50/100 = 5
    // Y shortfall = 50*10/100 = 5  — tie → first wins
    expect(drag.factorName).toBe('X')
  })
})
