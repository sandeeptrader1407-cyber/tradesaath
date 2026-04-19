/**
 * Module 2, Layer 7 — SessionMetrics tests (15 cases).
 */

import { describe, it, expect } from 'vitest'
import type { StandardTrade } from '@/lib/intake/types'
import { enrichTrades } from '@/lib/compute/enrichTrade'
import { computeSessionMetrics } from '@/lib/compute/sessionMetrics'

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

describe('computeSessionMetrics', () => {
  it('1. empty trades → zero-valued metrics, tradingStyle intraday', () => {
    const m = computeSessionMetrics([])
    expect(m.totalTrades).toBe(0)
    expect(m.totalPnl).toBe(0)
    expect(m.winRate).toBe(0)
    expect(m.profitFactor).toBe(0)
    expect(m.turningPointIndex).toBeNull()
    expect(m.tradingStyle).toBe('intraday')
    expect(m.hasRealTimeData).toBe(false)
  })

  it('2. all winners → lossCount=0, profitFactor capped at 999', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: 300, entryTime: '09:35' }),
      mkTrade({ pnl: 200, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.winCount).toBe(3)
    expect(m.lossCount).toBe(0)
    expect(m.grossLoss).toBe(0)
    expect(m.profitFactor).toBe(999)
  })

  it('3. all losers → winCount=0, winRate=0, profitFactor=0', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: -500, exitPrice: 95 }),
      mkTrade({ pnl: -300, exitPrice: 97, entryTime: '09:35' }),
      mkTrade({ pnl: -200, exitPrice: 98, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.winCount).toBe(0)
    expect(m.winRate).toBe(0)
    expect(m.profitFactor).toBe(0)
  })

  it('4. 3W/2L → winRate=0.6, correct totals', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: 300, entryTime: '09:35' }),
      mkTrade({ pnl: 200, entryTime: '09:50' }),
      mkTrade({ pnl: -400, exitPrice: 96, entryTime: '10:05' }),
      mkTrade({ pnl: -100, exitPrice: 99, entryTime: '10:20' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.winCount).toBe(3)
    expect(m.lossCount).toBe(2)
    expect(m.winRate).toBeCloseTo(0.6, 5)
    expect(m.totalPnl).toBe(500)
    expect(m.grossProfit).toBe(1000)
    expect(m.grossLoss).toBe(-500)
  })

  it('5. morning/midday/afternoon split correct (4 trades)', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }), // idx 0 → morning
      mkTrade({ pnl: 200, entryTime: '09:35' }), // idx 1 → midday
      mkTrade({ pnl: 300, entryTime: '09:50' }), // idx 2 → midday
      mkTrade({ pnl: 400, entryTime: '10:05' }), // idx 3 → afternoon
    ])
    const m = computeSessionMetrics(trades)
    // n=4: morningEnd=floor(1)=1, afternoonStart=ceil(3)=3
    // morning=[0,1), midday=[1,3), afternoon=[3,4)
    expect(m.morningPnl).toBe(100)
    expect(m.middayPnl).toBe(500)
    expect(m.afternoonPnl).toBe(400)
  })

  it('6. bestTradePnl and worstTradePnl match max/min', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: -500, exitPrice: 95, entryTime: '09:35' }),
      mkTrade({ pnl: 800, entryTime: '09:50' }),
      mkTrade({ pnl: -200, exitPrice: 98, entryTime: '10:05' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.bestTradePnl).toBe(800)
    expect(m.bestTradeIndex).toBe(2)
    expect(m.worstTradePnl).toBe(-500)
    expect(m.worstTradeIndex).toBe(1)
  })

  it('7. turningPointIndex detected on session that peaked then fell', () => {
    // Up, up, then heavy loss → drawdown jumps at trade 2
    const trades = enrichTrades([
      mkTrade({ pnl: 500 }),
      mkTrade({ pnl: 500, entryTime: '09:35' }),
      mkTrade({ pnl: -800, exitPrice: 92, entryTime: '09:50' }),
      mkTrade({ pnl: -200, exitPrice: 98, entryTime: '10:05' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.turningPointIndex).toBe(2)
  })

  it('8. turningPointIndex null on monotonic win session', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 100 }),
      mkTrade({ pnl: 200, entryTime: '09:35' }),
      mkTrade({ pnl: 300, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.turningPointIndex).toBeNull()
  })

  it('9. medianHoldingMinutes correct for odd count', () => {
    // Durations: 1, 5, 30 (odd) → median 5
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '09:21' }), // 1m scalp
      mkTrade({ entryTime: '09:25', exitTime: '09:30' }), // 5m quick
      mkTrade({ entryTime: '09:35', exitTime: '10:05' }), // 30m normal
    ])
    const m = computeSessionMetrics(trades)
    expect(m.medianHoldingMinutes).toBeCloseTo(5, 5)
  })

  it('10. medianHoldingMinutes correct for even count (avg of middle two)', () => {
    // Durations: 1, 5, 15, 30 (even) → median (5+15)/2 = 10
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '09:21' }), // 1m
      mkTrade({ entryTime: '09:25', exitTime: '09:30' }), // 5m
      mkTrade({ entryTime: '09:35', exitTime: '09:50' }), // 15m
      mkTrade({ entryTime: '10:00', exitTime: '10:30' }), // 30m
    ])
    const m = computeSessionMetrics(trades)
    expect(m.medianHoldingMinutes).toBeCloseTo(10, 5)
  })

  it('11. tradingStyle scalper when >60% trades are scalp/quick', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '09:21' }),
      mkTrade({ entryTime: '09:25', exitTime: '09:26' }),
      mkTrade({ entryTime: '09:30', exitTime: '09:31' }),
      mkTrade({ entryTime: '09:35', exitTime: '09:38' }),
      mkTrade({ entryTime: '09:40', exitTime: '10:30' }), // normal
    ])
    const m = computeSessionMetrics(trades)
    expect(m.tradingStyle).toBe('scalper')
  })

  it('12. tradingStyle swing when >=30% extended/positional', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '13:30' }), // extended (4h10m)
      mkTrade({ entryTime: '09:25', exitTime: '09:30' }), // quick
      mkTrade({ entryTime: '09:35', exitTime: '10:05' }), // normal
    ])
    const m = computeSessionMetrics(trades)
    // 1/3 ≈ 33% extended → swing
    expect(m.tradingStyle).toBe('swing')
  })

  it('13. tradingStyle intraday for mixed normal trades', () => {
    const trades = enrichTrades([
      mkTrade({ entryTime: '09:20', exitTime: '09:50' }), // normal 30m
      mkTrade({ entryTime: '10:00', exitTime: '10:30' }), // normal
      mkTrade({ entryTime: '10:40', exitTime: '11:10' }), // normal
    ])
    const m = computeSessionMetrics(trades)
    expect(m.tradingStyle).toBe('intraday')
  })

  it('14. expectancy formula correct (winRate * avgWin + (1-winRate) * avgLoss)', () => {
    const trades = enrichTrades([
      mkTrade({ pnl: 200 }),
      mkTrade({ pnl: 200, entryTime: '09:35' }),
      mkTrade({ pnl: -100, exitPrice: 99, entryTime: '09:50' }),
      mkTrade({ pnl: -100, exitPrice: 99, entryTime: '10:05' }),
    ])
    const m = computeSessionMetrics(trades)
    // winRate = 0.5, avgWin = 200, avgLoss = -100
    // expectancy = 0.5*200 + 0.5*(-100) = 100 - 50 = 50
    expect(m.expectancy).toBeCloseTo(50, 5)
    expect(m.riskRewardRatio).toBeCloseTo(2, 5)
  })

  it('15. peakCapitalAtOneTime = max capitalDeployed', () => {
    const trades = enrichTrades([
      mkTrade({ qty: 100, entryPrice: 100 }),
      mkTrade({ qty: 500, entryPrice: 100, entryTime: '09:35' }), // cap 50,000
      mkTrade({ qty: 200, entryPrice: 100, entryTime: '09:50' }),
    ])
    const m = computeSessionMetrics(trades)
    expect(m.peakCapitalAtOneTime).toBe(50000)
  })
})
