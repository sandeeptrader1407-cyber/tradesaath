/**
 * Module 2, Layer 6 — Aggregate Metrics tests (25 cases).
 *
 * Layout:
 *   4 perSymbol, 4 timeSlots, 3 dayOfWeek, 3 holding,
 *   4 bestWorstTrades, 4 equityCurve, 3 orchestrator  = 25
 *
 * All aggregates are pure rollups — tests assert grouping, counting,
 * summing, sorting, and edge cases only.
 */

import { describe, it, expect } from 'vitest'
import type { StandardTrade } from '@/lib/intake/types'
import { enrichTrades } from '@/lib/compute/enrichTrade'
import {
  computePerSymbolMetrics,
  computeTimeSlots30min,
  computeTimeSlots60min,
  computeDayOfWeekMetrics,
  computeHoldingDistribution,
  computeBestWorstTrades,
  computeEquityCurve,
  computeAllAggregates,
} from '@/lib/compute/aggregates'

// ────────────────────────────────────────────────────────────
// Fixture helper — minimal StandardTrade then enriched.
// ────────────────────────────────────────────────────────────

function mkTrade(over: Partial<StandardTrade> = {}): StandardTrade {
  return {
    index: 0,
    symbol: 'RELIANCE',
    side: 'BUY',
    qty: 100,
    entryPrice: 100,
    exitPrice: 101,
    pnl: 100,
    date: '2026-04-15', // Wednesday → dow 3
    entryTime: '09:20',
    exitTime: '09:30',
    ...over,
  } as StandardTrade
}

// ═════════════════════════════════════════════════════════════
// PER-SYMBOL
// ═════════════════════════════════════════════════════════════
describe('computePerSymbolMetrics', () => {
  it('1. two symbols, 3 trades each → 2 groups with correct counts', () => {
    const trades = enrichTrades([
      mkTrade({ symbol: 'RELIANCE', pnl: 500 }),
      mkTrade({ symbol: 'RELIANCE', pnl: -200, entryTime: '09:35' }),
      mkTrade({ symbol: 'RELIANCE', pnl: 300, entryTime: '09:50' }),
      mkTrade({ symbol: 'TCS', pnl: 800, entryTime: '10:05' }),
      mkTrade({ symbol: 'TCS', pnl: -400, entryTime: '10:20' }),
      mkTrade({ symbol: 'TCS', pnl: 100, entryTime: '10:35' }),
    ])
    const out = computePerSymbolMetrics(trades)
    expect(out).toHaveLength(2)
    const byName = Object.fromEntries(out.map((m) => [m.symbol, m]))
    expect(byName['RELIANCE'].tradeCount).toBe(3)
    expect(byName['TCS'].tradeCount).toBe(3)
    expect(byName['RELIANCE'].totalPnl).toBe(600)
    expect(byName['TCS'].totalPnl).toBe(500)
  })

  it('2. winRate calculated correctly with mixed wins/losses', () => {
    const trades = enrichTrades([
      mkTrade({ symbol: 'X', pnl: 500 }),
      mkTrade({ symbol: 'X', pnl: 500, entryTime: '09:35' }),
      mkTrade({ symbol: 'X', pnl: -500, entryTime: '09:50' }),
      mkTrade({ symbol: 'X', pnl: -500, entryTime: '10:05' }),
    ])
    const out = computePerSymbolMetrics(trades)
    expect(out).toHaveLength(1)
    expect(out[0].winCount).toBe(2)
    expect(out[0].lossCount).toBe(2)
    expect(out[0].winRate).toBeCloseTo(0.5, 5)
    expect(out[0].bestTrade).toBe(500)
    expect(out[0].worstTrade).toBe(-500)
  })

  it('3. sorted by tradeCount DESC', () => {
    const trades = enrichTrades([
      mkTrade({ symbol: 'A', pnl: 100 }),
      mkTrade({ symbol: 'B', pnl: 100, entryTime: '09:25' }),
      mkTrade({ symbol: 'B', pnl: 100, entryTime: '09:30' }),
      mkTrade({ symbol: 'C', pnl: 100, entryTime: '09:35' }),
      mkTrade({ symbol: 'C', pnl: 100, entryTime: '09:40' }),
      mkTrade({ symbol: 'C', pnl: 100, entryTime: '09:45' }),
    ])
    const out = computePerSymbolMetrics(trades)
    expect(out.map((m) => m.symbol)).toEqual(['C', 'B', 'A'])
  })

  it('4. empty trades → []', () => {
    expect(computePerSymbolMetrics([])).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════
// TIME SLOTS
// ═════════════════════════════════════════════════════════════
describe('computeTimeSlots30min / 60min', () => {
  it('5. 30-min slot: trade at 09:20 buckets into correct slot', () => {
    const trades = enrichTrades([mkTrade({ entryTime: '09:20' })])
    const out = computeTimeSlots30min(trades)
    expect(out).toHaveLength(1)
    expect(out[0].startHour).toBe(9)
    expect(out[0].tradeCount).toBe(1)
    // slot string is what enrichTrade assigned — we just assert start
    expect(out[0].slot).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
  })

  it('6. multiple trades in same slot → grouped correctly', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', pnl: 100 }),
      mkTrade({ entryTime: '09:25', pnl: -50 }),
      mkTrade({ entryTime: '09:28', pnl: 200 }),
    ])
    const out = computeTimeSlots30min(trades)
    // All three trades should be in the first 30-min bucket
    expect(out).toHaveLength(1)
    expect(out[0].tradeCount).toBe(3)
    expect(out[0].totalPnl).toBe(250)
  })

  it('7. trades without time data (empty entryTime, hour 0) are excluded', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', pnl: 100 }),
      mkTrade({ entryTime: '', pnl: -50 }),
    ])
    const out = computeTimeSlots30min(trades)
    expect(out).toHaveLength(1)
    expect(out[0].tradeCount).toBe(1)
  })

  it('8. 60-min buckets span 60 minutes not 30', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20' }),
      mkTrade({ entryTime: '09:55' }),
    ])
    const out30 = computeTimeSlots30min(trades)
    const out60 = computeTimeSlots60min(trades)
    // In 30-min slicing, 09:20 and 09:55 fall into different halves.
    // In 60-min slicing, they share the 09:XX hour bucket.
    expect(out60.length).toBeLessThanOrEqual(out30.length)
    expect(out60.reduce((s, r) => s + r.tradeCount, 0)).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════
// DAY OF WEEK
// ═════════════════════════════════════════════════════════════
describe('computeDayOfWeekMetrics', () => {
  it('9. trades on Mon and Wed → 2 groups at indices 1 and 3', () => {
    const trades = enrichTrades([
      mkTrade({ date: '2026-04-13', pnl: 100 }), // Monday
      mkTrade({ date: '2026-04-15', pnl: -50, entryTime: '09:25' }), // Wednesday
      mkTrade({ date: '2026-04-15', pnl: 200, entryTime: '09:30' }),
    ])
    const out = computeDayOfWeekMetrics(trades)
    expect(out).toHaveLength(2)
    expect(out.map((d) => d.dayOfWeek)).toEqual([1, 3])
  })

  it('10. empty trades → []', () => {
    expect(computeDayOfWeekMetrics([])).toEqual([])
  })

  it('11. natural order sorting (ASC by dayOfWeek)', () => {
    const trades = enrichTrades([
      mkTrade({ date: '2026-04-17', pnl: 100 }), // Fri (5)
      mkTrade({ date: '2026-04-13', pnl: 100, entryTime: '09:25' }), // Mon (1)
      mkTrade({ date: '2026-04-15', pnl: 100, entryTime: '09:30' }), // Wed (3)
    ])
    const out = computeDayOfWeekMetrics(trades)
    expect(out.map((d) => d.dayOfWeek)).toEqual([1, 3, 5])
  })
})

// ═════════════════════════════════════════════════════════════
// HOLDING DISTRIBUTION
// ═════════════════════════════════════════════════════════════
describe('computeHoldingDistribution', () => {
  it('12. trades across multiple buckets → one entry per bucket (present ones only)', () => {
    const trades = enrichTrades([
      // scalp: < 2m
      mkTrade({ entryTime: '09:20', exitTime: '09:21', pnl: 100 }),
      // quick: 2-10m
      mkTrade({ entryTime: '09:25', exitTime: '09:30', pnl: 200 }),
      // normal: 10-60m
      mkTrade({ entryTime: '09:35', exitTime: '10:05', pnl: -50 }),
    ])
    const out = computeHoldingDistribution(trades)
    expect(out).toHaveLength(3)
    expect(out.map((b) => b.bucket)).toEqual(['scalp', 'quick', 'normal'])
  })

  it('13. all trades in same bucket → 1 entry with full count', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '09:21', pnl: 100 }),
      mkTrade({ entryTime: '09:25', exitTime: '09:26', pnl: 200 }),
      mkTrade({ entryTime: '09:30', exitTime: '09:30', pnl: -50 }),
    ])
    const out = computeHoldingDistribution(trades)
    expect(out).toHaveLength(1)
    expect(out[0].bucket).toBe('scalp')
    expect(out[0].tradeCount).toBe(3)
  })

  it('14. labels include minute ranges', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '09:21', pnl: 100 }),
    ])
    const out = computeHoldingDistribution(trades)
    expect(out[0].label).toMatch(/</)
    expect(out[0].label).toMatch(/m|h/)
  })
})

// ═════════════════════════════════════════════════════════════
// BEST/WORST TRADES
// ═════════════════════════════════════════════════════════════
describe('computeBestWorstTrades', () => {
  it('15. 10 winners → top5Wins has 5 entries sorted DESC', () => {
    const trades = enrichTrades(
      Array.from({ length: 10 }, (_, i) =>
        mkTrade({
          pnl: (i + 1) * 100,
          entryTime: `09:${String(20 + i).padStart(2, '0')}`,
        })
      )
    )
    const out = computeBestWorstTrades(trades)
    expect(out.top5Wins).toHaveLength(5)
    const pnls = out.top5Wins.map((w) => w.pnl)
    expect(pnls).toEqual([...pnls].sort((a, b) => b - a))
    expect(pnls[0]).toBe(1000)
  })

  it('16. 3 losers → worst5Losses has exactly 3 entries', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: -500, entryTime: '09:25' }),
      mkTrade({ pnl: -200, entryTime: '09:30' }),
      mkTrade({ pnl: -1000, entryTime: '09:35' }),
    ])
    const out = computeBestWorstTrades(trades)
    expect(out.worst5Losses).toHaveLength(3)
    expect(out.worst5Losses[0].pnl).toBe(-1000)
    expect(out.worst5Losses[2].pnl).toBe(-200)
  })

  it('17. no wins → top5Wins = []', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -100 }),
      mkTrade({ pnl: -200, entryTime: '09:25' }),
    ])
    const out = computeBestWorstTrades(trades)
    expect(out.top5Wins).toEqual([])
    expect(out.worst5Losses.length).toBe(2)
  })

  it('18. worst5Losses entries include tag field (may be null)', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -1000 }),
      mkTrade({ pnl: -500, entryTime: '09:25' }),
    ])
    const out = computeBestWorstTrades(trades)
    for (const loss of out.worst5Losses) {
      expect('tag' in loss).toBe(true)
    }
  })
})

// ═════════════════════════════════════════════════════════════
// EQUITY CURVE
// ═════════════════════════════════════════════════════════════
describe('computeEquityCurve', () => {
  it('19. cumulative pnl compounds correctly', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: -50, entryTime: '09:25' }),
      mkTrade({ pnl: 30, entryTime: '09:30' }),
      mkTrade({ pnl: -20, entryTime: '09:35' }),
      mkTrade({ pnl: 10, entryTime: '09:40' }),
    ])
    const curve = computeEquityCurve(trades)
    expect(curve.map((p) => p.cumulativePnl)).toEqual([100, 50, 80, 60, 70])
  })

  it('20. isNewPeak: true on trade 0 and on 3rd if 3rd exceeds prior peak', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }), // peak 100
      mkTrade({ pnl: -50, entryTime: '09:25' }), // 50, not a peak
      mkTrade({ pnl: 30, entryTime: '09:30' }), // 80, not a peak
      mkTrade({ pnl: 200, entryTime: '09:35' }), // 280, NEW PEAK
    ])
    const curve = computeEquityCurve(trades)
    expect(curve[0].isNewPeak).toBe(true)
    expect(curve[1].isNewPeak).toBe(false)
    expect(curve[2].isNewPeak).toBe(false)
    expect(curve[3].isNewPeak).toBe(true)
  })

  it('21. drawdownFromPeak mirrors trade.drawdownFromPeak', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: -40, entryTime: '09:25' }), // drawdown 40
      mkTrade({ pnl: -20, entryTime: '09:30' }), // drawdown 60
    ])
    const curve = computeEquityCurve(trades)
    for (let i = 0; i < curve.length; i++) {
      expect(curve[i].drawdownFromPeak).toBe(trades[i].drawdownFromPeak)
    }
  })

  it('22. empty trades → []', () => {
    expect(computeEquityCurve([])).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═════════════════════════════════════════════════════════════
describe('computeAllAggregates', () => {
  it('23. returns all 7 fields', () => {
    const all = computeAllAggregates(enrichTrades([mkTrade({ pnl: 100 })]))
    expect(Object.keys(all).sort()).toEqual(
      [
        'bestWorstTrades',
        'dayOfWeek',
        'equityCurve',
        'holdingDistribution',
        'perSymbol',
        'timeSlots30min',
        'timeSlots60min',
      ].sort()
    )
  })

  it('24. all list fields are arrays; bestWorstTrades is an object with 2 arrays', () => {
    const all = computeAllAggregates([])
    expect(Array.isArray(all.perSymbol)).toBe(true)
    expect(Array.isArray(all.timeSlots30min)).toBe(true)
    expect(Array.isArray(all.timeSlots60min)).toBe(true)
    expect(Array.isArray(all.dayOfWeek)).toBe(true)
    expect(Array.isArray(all.holdingDistribution)).toBe(true)
    expect(Array.isArray(all.equityCurve)).toBe(true)
    expect(Array.isArray(all.bestWorstTrades.top5Wins)).toBe(true)
    expect(Array.isArray(all.bestWorstTrades.worst5Losses)).toBe(true)
  })

  it('25. realistic 20-trade session → all aggregates populated and consistent', () => {
    const trades = enrichTrades(
      Array.from({ length: 20 }, (_, i) => {
        const mins = 20 + i * 3
        const hh = Math.floor(mins / 60) + 9
        const mm = mins % 60
        return mkTrade({
          index: i,
          symbol: i % 2 === 0 ? 'RELIANCE' : 'TCS',
          pnl: (i % 3 === 0 ? -1 : 1) * (100 + i * 10),
          entryTime: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
          exitTime: `${String(hh).padStart(2, '0')}:${String(Math.min(59, mm + 5)).padStart(2, '0')}`,
        })
      })
    )
    const all = computeAllAggregates(trades)
    expect(all.perSymbol.length).toBe(2)
    expect(all.equityCurve.length).toBe(20)
    const cumTotal = all.perSymbol.reduce((s, r) => s + r.totalPnl, 0)
    expect(all.equityCurve[19].cumulativePnl).toBeCloseTo(cumTotal, 5)
    expect(all.bestWorstTrades.top5Wins.length).toBeGreaterThan(0)
    expect(all.bestWorstTrades.worst5Losses.length).toBeGreaterThan(0)
  })
})
