/**
 * Module 2, Layer 1 — Unit tests for enrichTrades().
 *
 * These tests exercise the pure StandardTrade[] → EnrichedTrade[] mapping.
 * No network, no DB, no AI.
 */

import { describe, it, expect } from 'vitest'
import { enrichTrades } from '@/lib/compute/enrichTrade'
import type { StandardTrade } from '@/lib/intake/types'

// ────────────────────────────────────────────────────────────
// Test fixture helper
// ────────────────────────────────────────────────────────────

function makeTrade(overrides: Partial<StandardTrade> = {}): StandardTrade {
  return {
    index: 0,
    symbol: 'RELIANCE',
    side: 'BUY',
    qty: 10,
    entryPrice: 100,
    exitPrice: 110,
    pnl: 100,
    cumPnl: 0,
    date: '2026-04-13', // Monday
    entryTime: '09:15',
    exitTime: '09:20',
    holdingMinutes: 5,
    session: 'morning',
    timeGapMinutes: null,
    tag: 'win',
    label: 'Winner',
    exchange: 'NSE',
    tradeId: 'T0',
    sourceRows: [0],
    isShort: false,
    fees: 0,
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('enrichTrades', () => {
  // 1
  it('returns empty array for empty input', () => {
    expect(enrichTrades([])).toEqual([])
  })

  // 2
  it('single trade: first=last, sessionProgress=0, timeSincePrev=0', () => {
    const out = enrichTrades([makeTrade({ tradeId: 'S1' })])
    expect(out).toHaveLength(1)
    expect(out[0].tradeIndex).toBe(0)
    expect(out[0].tradeNumberInSession).toBe(1)
    expect(out[0].isFirstTrade).toBe(true)
    expect(out[0].isLastTrade).toBe(true)
    expect(out[0].sessionProgress).toBe(0)
    expect(out[0].timeSincePreviousTrade).toBe(0)
  })

  // 3
  it('three in-order trades → indices 0,1,2 and sessionProgress 0, 0.5, 1.0', () => {
    const trades = [
      makeTrade({ tradeId: 'A', entryTime: '09:15', exitTime: '09:20' }),
      makeTrade({ tradeId: 'B', entryTime: '10:00', exitTime: '10:05' }),
      makeTrade({ tradeId: 'C', entryTime: '11:00', exitTime: '11:05' }),
    ]
    const out = enrichTrades(trades)
    expect(out.map((t) => t.tradeId)).toEqual(['A', 'B', 'C'])
    expect(out[0].sessionProgress).toBe(0)
    expect(out[1].sessionProgress).toBe(0.5)
    expect(out[2].sessionProgress).toBe(1.0)
  })

  // 4
  it('out-of-order input gets sorted by date+entryTime', () => {
    const trades = [
      makeTrade({ tradeId: 'T3', entryTime: '11:00', exitTime: '11:05' }),
      makeTrade({ tradeId: 'T1', entryTime: '09:15', exitTime: '09:20' }),
      makeTrade({ tradeId: 'T2', entryTime: '10:00', exitTime: '10:05' }),
    ]
    const out = enrichTrades(trades)
    expect(out.map((t) => t.tradeId)).toEqual(['T1', 'T2', 'T3'])
    expect(out[0].tradeIndex).toBe(0)
    expect(out[1].tradeIndex).toBe(1)
    expect(out[2].tradeIndex).toBe(2)
  })

  // 5
  it('NIFTY symbol → lotSize=75, numberOfLots = floor(qty / 75)', () => {
    const out = enrichTrades([makeTrade({ symbol: 'NIFTY25APR24500CE', qty: 225 })])
    expect(out[0].lotSize).toBe(75)
    expect(out[0].numberOfLots).toBe(3)
  })

  // 6
  it('BANKNIFTY symbol → lotSize=30', () => {
    const out = enrichTrades([makeTrade({ symbol: 'BANKNIFTY25APR52000CE', qty: 60 })])
    expect(out[0].lotSize).toBe(30)
    expect(out[0].numberOfLots).toBe(2)
  })

  // 7
  it('stock symbol (RELIANCE) → lotSize=1', () => {
    const out = enrichTrades([makeTrade({ symbol: 'RELIANCE', qty: 10 })])
    expect(out[0].lotSize).toBe(1)
    expect(out[0].numberOfLots).toBe(10)
  })

  // 8
  it('capital deployed: qty=10, entryPrice=2450.5 → 24505', () => {
    const out = enrichTrades([makeTrade({ qty: 10, entryPrice: 2450.5 })])
    expect(out[0].capitalDeployed).toBeCloseTo(24505, 4)
  })

  // 9
  it('oversized detection: trade with 3x session avg → isOversized=true', () => {
    // capitals: [100, 100, 600] → avg 266.67; trade 3 = 600/266.67 ≈ 2.25x
    const trades = [
      makeTrade({ tradeId: 'A', qty: 1, entryPrice: 100, entryTime: '09:15', exitTime: '09:20' }),
      makeTrade({ tradeId: 'B', qty: 1, entryPrice: 100, entryTime: '10:00', exitTime: '10:05' }),
      makeTrade({ tradeId: 'C', qty: 6, entryPrice: 100, entryTime: '11:00', exitTime: '11:05' }),
    ]
    const out = enrichTrades(trades)
    expect(out[0].isOversized).toBe(false)
    expect(out[1].isOversized).toBe(false)
    expect(out[2].isOversized).toBe(true)
    expect(out[2].sizeVsSessionAvg).toBeGreaterThan(2.0)
  })

  // 10
  it('win streak: [win, win, win] → consecutiveWins 1, 2, 3', () => {
    const trades = [
      makeTrade({ tradeId: 'W1', entryTime: '09:15', exitTime: '09:20', qty: 1, entryPrice: 100, pnl: 50 }),
      makeTrade({ tradeId: 'W2', entryTime: '10:00', exitTime: '10:05', qty: 1, entryPrice: 100, pnl: 50 }),
      makeTrade({ tradeId: 'W3', entryTime: '11:00', exitTime: '11:05', qty: 1, entryPrice: 100, pnl: 50 }),
    ]
    const out = enrichTrades(trades)
    expect(out.map((t) => t.isWin)).toEqual([true, true, true])
    expect(out.map((t) => t.consecutiveWins)).toEqual([1, 2, 3])
    expect(out.map((t) => t.consecutiveLosses)).toEqual([0, 0, 0])
  })

  // 11
  it('loss streak: [loss, loss] → consecutiveLosses 1, 2; lossStreakExtended on 2nd', () => {
    const trades = [
      makeTrade({ tradeId: 'L1', entryTime: '09:15', exitTime: '09:20', qty: 1, entryPrice: 100, pnl: -50 }),
      makeTrade({ tradeId: 'L2', entryTime: '10:00', exitTime: '10:05', qty: 1, entryPrice: 100, pnl: -50 }),
    ]
    const out = enrichTrades(trades)
    expect(out.map((t) => t.isLoss)).toEqual([true, true])
    expect(out.map((t) => t.consecutiveLosses)).toEqual([1, 2])
    expect(out[0].lossStreakExtended).toBe(false)
    expect(out[1].lossStreakExtended).toBe(true)
  })

  // 12
  it('win streak broken: [win, win, loss] → winStreakBroken=true on the loss', () => {
    const trades = [
      makeTrade({ tradeId: 'W1', entryTime: '09:15', exitTime: '09:20', qty: 1, entryPrice: 100, pnl: 50 }),
      makeTrade({ tradeId: 'W2', entryTime: '10:00', exitTime: '10:05', qty: 1, entryPrice: 100, pnl: 50 }),
      makeTrade({ tradeId: 'L1', entryTime: '11:00', exitTime: '11:05', qty: 1, entryPrice: 100, pnl: -50 }),
    ]
    const out = enrichTrades(trades)
    expect(out[0].winStreakBroken).toBe(false)
    expect(out[1].winStreakBroken).toBe(false)
    expect(out[2].winStreakBroken).toBe(true)
    expect(out[2].consecutiveLosses).toBe(1)
    expect(out[2].consecutiveWins).toBe(0)
  })

  // 13
  it('holding categories: scalp / quick / normal / extended / positional', () => {
    const cases: Array<{ entry: string; exit: string; expected: string }> = [
      { entry: '09:15', exit: '09:16', expected: 'scalp' }, // 1 min
      { entry: '09:15', exit: '09:20', expected: 'quick' }, // 5 min
      { entry: '09:15', exit: '09:45', expected: 'normal' }, // 30 min
      { entry: '09:15', exit: '11:15', expected: 'extended' }, // 120 min
      { entry: '09:15', exit: '14:15', expected: 'positional' }, // 300 min
    ]
    for (const c of cases) {
      const out = enrichTrades([makeTrade({ entryTime: c.entry, exitTime: c.exit })])
      expect(out[0].holdingCategory).toBe(c.expected)
    }
  })

  // 14
  it('drawdown from peak: [+100, -50, -30] → drawdowns [0, 50, 80]', () => {
    // Use capital large enough that isWin/isLoss fires correctly (pnl >= 0.5% of capital).
    const trades = [
      makeTrade({ tradeId: 'A', entryTime: '09:15', exitTime: '09:20', qty: 1, entryPrice: 100, pnl: 100 }),
      makeTrade({ tradeId: 'B', entryTime: '10:00', exitTime: '10:05', qty: 1, entryPrice: 100, pnl: -50 }),
      makeTrade({ tradeId: 'C', entryTime: '11:00', exitTime: '11:05', qty: 1, entryPrice: 100, pnl: -30 }),
    ]
    const out = enrichTrades(trades)
    expect(out.map((t) => t.cumulativePnlAfter)).toEqual([100, 50, 20])
    expect(out.map((t) => t.drawdownFromPeak)).toEqual([0, 50, 80])
  })

  // 15
  it('breakeven: pnl=1, capital=10000 → isBreakeven=true, isWin/isLoss=false', () => {
    const out = enrichTrades([makeTrade({ qty: 100, entryPrice: 100, pnl: 1 })])
    expect(out[0].capitalDeployed).toBe(10000)
    expect(out[0].pnlAsPercentOfCapital).toBeCloseTo(0.01, 4)
    expect(out[0].isBreakeven).toBe(true)
    expect(out[0].isWin).toBe(false)
    expect(out[0].isLoss).toBe(false)
  })

  // 16
  it('pattern and cycle fields are null/0 — not filled in this layer', () => {
    const out = enrichTrades([
      makeTrade({ tradeId: 'A', entryTime: '09:15', exitTime: '09:20' }),
      makeTrade({ tradeId: 'B', entryTime: '10:00', exitTime: '10:05', pnl: -50 }),
    ])
    for (const t of out) {
      expect(t.detectedTag).toBeNull()
      expect(t.tagConfidence).toBeNull()
      expect(t.tagCost).toBe(0)
      expect(t.cycleStageName).toBeNull()
      expect(t.cycleStageNumber).toBeNull()
    }
  })

  // 17
  it('time slot 30min: entryTime="09:20" → "09:00-09:30"', () => {
    const out = enrichTrades([makeTrade({ entryTime: '09:20', exitTime: '09:25' })])
    expect(out[0].timeSlot30min).toBe('09:00-09:30')
  })

  // 18
  it('time slot 30min: entryTime="09:45" → "09:30-10:00"', () => {
    const out = enrichTrades([makeTrade({ entryTime: '09:45', exitTime: '09:50' })])
    expect(out[0].timeSlot30min).toBe('09:30-10:00')
  })

  // 19
  it('day of week: date="2026-04-19" (Sunday) → dayOfWeek=0, name="Sunday"', () => {
    const out = enrichTrades([makeTrade({ date: '2026-04-19' })])
    expect(out[0].dayOfWeek).toBe(0)
    expect(out[0].dayOfWeekName).toBe('Sunday')
  })

  // 20
  it('missing entryTime → hourOfDay=0, graceful handling', () => {
    const out = enrichTrades([
      makeTrade({ entryTime: '', exitTime: '', holdingMinutes: 0 }),
    ])
    expect(out[0].hourOfDay).toBe(0)
    expect(out[0].timeSlot30min).toBe('00:00-00:30')
    expect(out[0].durationMinutes).toBe(0)
  })
})
