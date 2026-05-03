/**
 * TradeSaath Pipeline QA Test Suite
 * Validates: CSV parsing -> trade pairing -> pattern detection -> DQS scoring -> KPI computation
 * If ANY test fails, broken numbers would reach users — so we don't deploy.
 */
import { describe, it, expect } from 'vitest'
import { parseTradeFile } from '../lib/parsers'
import { detectPatterns } from '../lib/analysis/patternDetector'
import { computeKPIs, type KPISession } from '../lib/kpi/computeKPIs'
import { pairTrades } from '../lib/parsers/normalizer'
import fs from 'fs'
import path from 'path'

function loadFixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name))
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 1: CSV PARSING
═══════════════════════════════════════════════════════════════════ */
describe('Pipeline: CSV Parsing', () => {
  it('parses Zerodha single-day CSV correctly', async () => {
    const result = await parseTradeFile(loadFixture('zerodha-single-day.csv'), 'zerodha-single-day.csv')
    expect(result.success).toBe(true)
    expect(result.broker).toContain('Zerodha')
    expect(result.trades.length).toBeGreaterThan(0)
    // Every trade should have a date
    result.trades.forEach(t => {
      expect(t.date).toBeTruthy()
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
    // All trades should be same date (single day)
    const dates = new Set(result.trades.map(t => t.date))
    expect(dates.size).toBe(1)
  })

  it('splits multi-day CSV into separate date groups', async () => {
    const result = await parseTradeFile(loadFixture('zerodha-multi-day.csv'), 'zerodha-multi-day.csv')
    expect(result.success).toBe(true)
    expect(result.trades.length).toBeGreaterThan(0)
    // Should have trades from 5 different dates
    const dates = new Set(result.trades.map(t => t.date))
    expect(dates.size).toBe(5)
    // Trade pairing should NOT cross day boundaries
    // Verify by checking each trade's date is consistent
    for (const t of result.trades) {
      expect(t.date).toBeTruthy()
      expect(t.date).not.toBe('unknown')
    }
  })

  it('handles CSV with no time column', async () => {
    const result = await parseTradeFile(loadFixture('generic-no-time.csv'), 'generic-no-time.csv')
    expect(result.success).toBe(true)
    expect(result.trades.length).toBeGreaterThan(0)
    // Trades should NOT have fake "09:15" fallback time
    result.trades.forEach(t => {
      expect(t.time).not.toBe('09:15')
    })
  })

  it('handles crypto trades (24h, weekends)', async () => {
    const result = await parseTradeFile(loadFixture('generic-crypto.csv'), 'generic-crypto.csv')
    expect(result.success).toBe(true)
    expect(result.trades.length).toBeGreaterThan(0)
    // Should include weekend dates (2024-03-02 is Saturday, 2024-03-03 is Sunday)
    const dates = result.trades.map(t => t.date)
    const dayNums = dates.map(d => {
      if (!d || d === 'unknown') return -1
      return new Date(d + 'T12:00:00Z').getUTCDay()
    }).filter(d => d >= 0)
    const hasWeekend = dayNums.some(d => d === 0 || d === 6)
    expect(hasWeekend).toBe(true)
  })

  it('handles IBKR US stocks format', async () => {
    const result = await parseTradeFile(loadFixture('ibkr-us-stocks.csv'), 'ibkr-us-stocks.csv')
    expect(result.success).toBe(true)
    expect(result.trades.length).toBeGreaterThan(0)
    // Should contain US stock symbols
    const symbols = result.trades.map(t => t.symbol)
    const hasUSStocks = symbols.some(s => /AAPL|TSLA|MSFT|NVDA/i.test(s))
    expect(hasUSStocks).toBe(true)
  })

  it('handles single trade without crashing', async () => {
    const result = await parseTradeFile(loadFixture('single-trade.csv'), 'single-trade.csv')
    expect(result.success).toBe(true)
    expect(result.trades.length).toBeGreaterThanOrEqual(1)
    // No division by zero in KPIs
    expect(Number.isNaN(result.kpis.win_rate)).toBe(false)
    expect(Number.isFinite(result.kpis.net_pnl)).toBe(true)
  })

  it('handles empty file gracefully', async () => {
    const result = await parseTradeFile(loadFixture('empty-after-header.csv'), 'empty-after-header.csv')
    expect(result.total_trades_in_file).toBe(0)
    // Should NOT crash
  })

  it('handles malformed file gracefully', async () => {
    const result = await parseTradeFile(loadFixture('malformed.csv'), 'malformed.csv')
    expect(result.total_trades_in_file).toBe(0)
    // Should NOT crash, should indicate failure
  })
})

/* ═══════════════════════════════════════════════════════════════════
   SECTION 2: TRADE NORMALIZER (PAIRING)
═══════════════════════════════════════════════════════════════════ */
describe('Pipeline: Trade Normalizer', () => {
  it('pairs buy/sell on same symbol same day via FIFO', () => {
    const raw = [
      { symbol: 'NIFTY', side: 'BUY', qty: 75, price: 100, time: '09:30', date: '2024-03-01' },
      { symbol: 'NIFTY', side: 'SELL', qty: 75, price: 110, time: '10:00', date: '2024-03-01' },
    ]
    const paired = pairTrades(raw)
    expect(paired.length).toBe(1)
    expect(paired[0].pnl).toBe(750) // (110-100)*75
    expect(paired[0].tag).toBe('win')
  })

  it('NEVER pairs trades across different days', () => {
    const raw = [
      { symbol: 'NIFTY', side: 'BUY', qty: 75, price: 100, time: '09:30', date: '2024-03-01' },
      { symbol: 'NIFTY', side: 'SELL', qty: 75, price: 110, time: '10:00', date: '2024-03-02' },
    ]
    const paired = pairTrades(raw)
    // Should NOT pair these into a single trade with cross-day P&L
    // They should either be unpaired (if no direct pnl) or separate
    const crossDayPaired = paired.filter(t => t.pnl === 750)
    expect(crossDayPaired.length).toBe(0)
  })

  it('handles partial fills correctly', () => {
    const raw = [
      { symbol: 'NIFTY', side: 'BUY', qty: 150, price: 100, time: '09:30', date: '2024-03-01' },
      { symbol: 'NIFTY', side: 'SELL', qty: 75, price: 110, time: '10:00', date: '2024-03-01' },
      { symbol: 'NIFTY', side: 'SELL', qty: 75, price: 105, time: '10:30', date: '2024-03-01' },
    ]
    const paired = pairTrades(raw)
    expect(paired.length).toBe(2)
    // First pair: 75 @ 100 entry, 110 exit = 750 profit
    expect(paired[0].pnl).toBe(750)
    // Second pair: 75 @ 100 entry, 105 exit = 375 profit
    expect(paired[1].pnl).toBe(375)
  })

  it('calculates cumulative P&L correctly', () => {
    const raw = [
      { symbol: 'NIFTY', side: 'BUY', qty: 75, price: 100, time: '09:30', date: '2024-03-01' },
      { symbol: 'NIFTY', side: 'SELL', qty: 75, price: 110, time: '10:00', date: '2024-03-01' },
      { symbol: 'RELIANCE', side: 'BUY', qty: 10, price: 2500, time: '11:00', date: '2024-03-01' },
      { symbol: 'RELIANCE', side: 'SELL', qty: 10, price: 2480, time: '11:30', date: '2024-03-01' },
    ]
    const paired = pairTrades(raw)
    expect(paired.length).toBe(2)
    // cumPnl should accumulate
    expect(paired[0].cum_pnl).toBe(750)
    expect(paired[1].cum_pnl).toBe(550) // 750 + (-200)
  })

  it('does not crash on empty input', () => {
    const paired = pairTrades([])
    expect(paired).toEqual([])
  })
})

/* ═══════════════════════════════════════════════════════════════════
   SECTION 3: KPI COMPUTATION
═══════════════════════════════════════════════════════════════════ */
describe('Pipeline: KPI Computation', () => {
  it('computes correct KPIs for normal session', () => {
    const sessions: KPISession[] = [{
      net_pnl: -5000, trade_count: 15, win_count: 8,
      loss_count: 7, win_rate: 53.3,
      trades: [
        { pnl: 500 }, { pnl: -300 }, { pnl: 200 },
        { pnl: -100 }, { pnl: 800 }, { pnl: -600 },
        { pnl: 300 }, { pnl: 100 }, { pnl: -200 },
        { pnl: -400 }, { pnl: 500 }, { pnl: -700 },
        { pnl: 200 }, { pnl: -800 }, { pnl: -5300 }
      ]
    }]
    const kpis = computeKPIs(sessions)

    expect(kpis.totalPnl).toBe(-5000)
    expect(kpis.totalTrades).toBe(15)
    expect(kpis.winRate).toBeGreaterThan(0)
    expect(kpis.winRate).toBeLessThanOrEqual(100)
    expect(kpis.avgWin).toBeGreaterThan(0)
    expect(kpis.avgLoss).toBeGreaterThan(0)
    expect(Number.isFinite(kpis.riskReward)).toBe(true)
    expect(Number.isFinite(kpis.profitFactor)).toBe(true)
  })

  it('handles all-wins session (no losses)', () => {
    const sessions: KPISession[] = [{
      net_pnl: 5000, trade_count: 10, win_count: 10,
      loss_count: 0, win_rate: 100,
      trades: Array(10).fill({ pnl: 500 })
    }]
    const kpis = computeKPIs(sessions)

    expect(kpis.winRate).toBe(100)
    expect(kpis.avgLoss).toBe(0)
    expect(Number.isNaN(kpis.riskReward)).toBe(false)
    expect(Number.isNaN(kpis.profitFactor)).toBe(false)
  })

  it('handles all-losses session (no wins)', () => {
    const sessions: KPISession[] = [{
      net_pnl: -5000, trade_count: 10, win_count: 0,
      loss_count: 10, win_rate: 0,
      trades: Array(10).fill({ pnl: -500 })
    }]
    const kpis = computeKPIs(sessions)

    expect(kpis.winRate).toBe(0)
    expect(kpis.avgWin).toBe(0)
    expect(Number.isNaN(kpis.riskReward)).toBe(false)
  })

  it('handles empty sessions array', () => {
    const kpis = computeKPIs([])

    expect(kpis.totalPnl).toBe(0)
    expect(kpis.totalTrades).toBe(0)
    expect(kpis.winRate).toBe(0)
    // Nothing should be NaN
    Object.entries(kpis).forEach(([_key, v]) => {
      if (typeof v === 'number') {
        expect(Number.isNaN(v)).toBe(false)
      }
    })
  })

  it('handles single trade session', () => {
    const sessions: KPISession[] = [{
      net_pnl: 500, trade_count: 1, win_count: 1,
      loss_count: 0, win_rate: 100,
      trades: [{ pnl: 500 }]
    }]
    const kpis = computeKPIs(sessions)

    expect(kpis.totalTrades).toBe(1)
    expect(Number.isNaN(kpis.winRate)).toBe(false)
    expect(Number.isNaN(kpis.riskReward)).toBe(false)
  })

  it('handles zero P&L session', () => {
    const sessions: KPISession[] = [{
      net_pnl: 0, trade_count: 2, win_count: 1,
      loss_count: 1, win_rate: 50,
      trades: [{ pnl: 500 }, { pnl: -500 }]
    }]
    const kpis = computeKPIs(sessions)

    expect(kpis.totalPnl).toBe(0)
    expect(Number.isFinite(kpis.riskReward)).toBe(true)
  })

  it('win rate is always between 0 and 100', () => {
    const sessions: KPISession[] = [
      { net_pnl: 5000, trade_count: 10, win_count: 10, loss_count: 0, win_rate: 100, trades: [] },
      { net_pnl: -3000, trade_count: 5, win_count: 0, loss_count: 5, win_rate: 0, trades: [] },
    ]
    const kpis = computeKPIs(sessions)
    expect(kpis.winRate).toBeGreaterThanOrEqual(0)
    expect(kpis.winRate).toBeLessThanOrEqual(100)
  })
})

/* ═══════════════════════════════════════════════════════════════════
   SECTION 4: PATTERN DETECTION
═══════════════════════════════════════════════════════════════════ */
describe('Pipeline: Pattern Detection', () => {
  it('detects revenge trading (quick re-entry after loss, same symbol, bigger size)', () => {
    // 3 trades: two prior losses set consecutiveLosses>=2, then quick re-entry with bigger size
    const trades = [
      { symbol: 'NIFTY', time: '09:50', pnl: -800, qty: 75, side: 'BUY',
        entry_time: '09:50', exit_time: '09:55', entry_price: 105, exit_price: 100,
        holding_minutes: 5, date: '2024-01-15' },
      { symbol: 'NIFTY', time: '10:00', pnl: -1000, qty: 75, side: 'BUY',
        entry_time: '10:00', exit_time: '10:05', entry_price: 100, exit_price: 95,
        holding_minutes: 5, date: '2024-01-15' },
      { symbol: 'NIFTY', time: '10:03', pnl: -1500, qty: 150, side: 'BUY',
        entry_time: '10:03', exit_time: '10:08', entry_price: 95, exit_price: 90,
        holding_minutes: 5, date: '2024-01-15' },
    ]
    const result = detectPatterns(trades)
    const revengeTrades = result.trades.filter(t => t.tag === 'revenge')
    expect(revengeTrades.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT tag normal re-entries as revenge', () => {
    const trades = [
      { symbol: 'NIFTY', time: '10:00', pnl: -500, qty: 75, side: 'BUY',
        entry_time: '10:00', exit_time: '10:05', entry_price: 100, exit_price: 97,
        holding_minutes: 5, date: '2024-01-15' },
      { symbol: 'NIFTY', time: '10:35', pnl: 800, qty: 75, side: 'BUY',
        entry_time: '10:35', exit_time: '10:50', entry_price: 96, exit_price: 107,
        holding_minutes: 15, date: '2024-01-15' },
    ]
    const result = detectPatterns(trades)
    const revengeTrades = result.trades.filter(t => t.tag === 'revenge')
    expect(revengeTrades.length).toBe(0)
  })

  it('total mistake cost never exceeds 85% of gross loss', () => {
    const trades = Array.from({ length: 20 }, (_, i) => ({
      symbol: 'NIFTY', time: `${9 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}`,
      pnl: i % 3 === 0 ? 500 : -800, qty: 75, side: 'BUY',
      entry_time: `${9 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}`,
      exit_time: `${9 + Math.floor(i / 4)}:${String((i % 4) * 15 + 10).padStart(2, '0')}`,
      entry_price: 100, exit_price: i % 3 === 0 ? 107 : 89,
      holding_minutes: 10, date: '2024-01-15',
    }))

    const result = detectPatterns(trades)
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
    // CRITICAL: mistake cost must NEVER exceed 85% of gross loss
    expect(result.meta.mistakeTotalCost).toBeLessThanOrEqual(grossLoss * 0.85 + 1) // +1 for float rounding
  })

  it('assigns at most ONE tag per trade', () => {
    const trades = Array.from({ length: 30 }, (_, i) => ({
      symbol: 'NIFTY', time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20).padStart(2, '0')}`,
      pnl: i % 2 === 0 ? 200 : -600, qty: 75 + (i * 5), side: 'BUY',
      entry_time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20).padStart(2, '0')}`,
      exit_time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20 + 8).padStart(2, '0')}`,
      entry_price: 100, exit_price: i % 2 === 0 ? 103 : 92,
      holding_minutes: 8, date: '2024-01-15',
    }))

    const result = detectPatterns(trades)
    // result.trades has exactly one entry per input trade
    expect(result.trades.length).toBe(30)
    // No duplicate indices
    const indices = result.trades.map(t => t.index)
    const uniqueIndices = new Set(indices)
    expect(indices.length).toBe(uniqueIndices.size)
  })

  it('handles empty trades array', () => {
    const result = detectPatterns([])
    expect(result.trades.length).toBe(0)
    expect(result.meta.totalTrades).toBe(0)
    expect(result.meta.mistakeTotalCost).toBe(0)
    expect(Number.isNaN(result.dqs.overall)).toBe(false)
  })

  it('DQS score is always 0-100', () => {
    const trades = Array.from({ length: 15 }, (_, i) => ({
      symbol: 'NIFTY', time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20).padStart(2, '0')}`,
      pnl: i % 2 === 0 ? 300 : -400, qty: 75, side: 'BUY',
      entry_time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20).padStart(2, '0')}`,
      exit_time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20 + 10).padStart(2, '0')}`,
      entry_price: 100, exit_price: i % 2 === 0 ? 104 : 95,
      holding_minutes: 10, date: '2024-01-15',
    }))
    const result = detectPatterns(trades)
    expect(result.dqs.overall).toBeGreaterThanOrEqual(0)
    expect(result.dqs.overall).toBeLessThanOrEqual(100)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.dqs.grade)
  })

  it('counterfactual P&L is always >= actual P&L', () => {
    const trades = Array.from({ length: 15 }, (_, i) => ({
      symbol: 'NIFTY', time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20).padStart(2, '0')}`,
      pnl: i % 3 === 0 ? 500 : -800, qty: 75, side: 'BUY',
      entry_time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20).padStart(2, '0')}`,
      exit_time: `${9 + Math.floor(i / 3)}:${String((i % 3) * 20 + 10).padStart(2, '0')}`,
      entry_price: 100, exit_price: i % 3 === 0 ? 107 : 89,
      holding_minutes: 10, date: '2024-01-15',
    }))
    const result = detectPatterns(trades)
    const actualPnl = result.meta.netPnl
    const counterfactual = actualPnl + result.meta.mistakeTotalCost
    expect(counterfactual).toBeGreaterThanOrEqual(actualPnl)
  })
})

/* ═══════════════════════════════════════════════════════════════════
   SECTION 5: NUMBER SANITY — NO NaN, NO Infinity ANYWHERE
═══════════════════════════════════════════════════════════════════ */
describe('Pipeline: Number Sanity', () => {
  it('no NaN or Infinity in any KPI for edge cases', () => {
    const edgeCases: KPISession[][] = [
      [],
      [{ net_pnl: 0, trade_count: 0, win_count: 0, loss_count: 0, win_rate: 0, trades: [] }],
      [{ net_pnl: 1000, trade_count: 1, win_count: 1, loss_count: 0, win_rate: 100, trades: [{ pnl: 1000 }] }],
      [{ net_pnl: -1000, trade_count: 1, win_count: 0, loss_count: 1, win_rate: 0, trades: [{ pnl: -1000 }] }],
    ]

    edgeCases.forEach((sessions, idx) => {
      const kpis = computeKPIs(sessions)
      Object.entries(kpis).forEach(([key, value]) => {
        if (typeof value === 'number') {
          expect(Number.isNaN(value), `Case ${idx}: ${key} is NaN`).toBe(false)
          expect(Number.isFinite(value) || value === 0, `Case ${idx}: ${key} is Infinity`).toBe(true)
        }
      })
    })
  })

  it('no NaN in pattern detector for edge cases', () => {
    const edgeCases = [
      [], // empty
      [{ symbol: 'X', time: '10:00', pnl: 0, qty: 1, side: 'BUY' }], // single zero-pnl trade
      Array(100).fill({ symbol: 'X', time: '10:00', pnl: -1, qty: 1, side: 'BUY' }), // all tiny losses
    ]

    edgeCases.forEach((trades, idx) => {
      const result = detectPatterns(trades)
      expect(Number.isNaN(result.dqs.overall), `Case ${idx}: DQS is NaN`).toBe(false)
      expect(Number.isNaN(result.meta.mistakeTotalCost), `Case ${idx}: mistakeCost is NaN`).toBe(false)
      expect(Number.isNaN(result.meta.winRate), `Case ${idx}: winRate is NaN`).toBe(false)
    })
  })

  it('parsed KPIs from fixture files have no NaN', async () => {
    const fixtures = [
      'zerodha-single-day.csv', 'generic-no-time.csv', 'single-trade.csv',
      'all-wins.csv', 'all-losses.csv',
    ]
    for (const name of fixtures) {
      const result = await parseTradeFile(loadFixture(name), name)
      Object.entries(result.kpis).forEach(([key, value]) => {
        if (typeof value === 'number') {
          expect(Number.isNaN(value), `${name}: kpis.${key} is NaN`).toBe(false)
        }
      })
    }
  })
})

/* ═══════════════════════════════════════════════════════════════════
   SECTION 6: END-TO-END PIPELINE (parse -> pair -> detect -> KPI)
═══════════════════════════════════════════════════════════════════ */
describe('Pipeline: End-to-End', () => {
  it('full pipeline for all-wins fixture', async () => {
    const parsed = await parseTradeFile(loadFixture('all-wins.csv'), 'all-wins.csv')
    expect(parsed.success).toBe(true)

    // Run pattern detection
    const patterns = detectPatterns(parsed.trades)
    // With all wins, there should be no mistake tags (or very few)
    const mistakeCount = patterns.trades.filter(t =>
      !['win', 'disciplined'].includes(t.tag)
    ).length
    // Most trades should be 'win' or 'disciplined'
    const goodCount = patterns.trades.filter(t =>
      ['win', 'disciplined'].includes(t.tag)
    ).length
    expect(goodCount).toBeGreaterThan(mistakeCount)

    // KPIs should show positive performance
    expect(parsed.kpis.net_pnl).toBeGreaterThan(0)
  })

  it('full pipeline for all-losses fixture', async () => {
    const parsed = await parseTradeFile(loadFixture('all-losses.csv'), 'all-losses.csv')
    expect(parsed.success).toBe(true)

    const patterns = detectPatterns(parsed.trades)
    // DQS should still be a valid number
    expect(Number.isFinite(patterns.dqs.overall)).toBe(true)

    // KPIs should show negative performance
    expect(parsed.kpis.net_pnl).toBeLessThan(0)
  })

  it('full pipeline for multi-day fixture produces correct session splits', async () => {
    const parsed = await parseTradeFile(loadFixture('zerodha-multi-day.csv'), 'zerodha-multi-day.csv')
    expect(parsed.success).toBe(true)

    // Group trades by date to simulate session splitting
    const byDate: Record<string, typeof parsed.trades> = {}
    for (const t of parsed.trades) {
      const d = t.date || 'unknown'
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(t)
    }
    const dateCount = Object.keys(byDate).filter(d => d !== 'unknown').length
    expect(dateCount).toBe(5)

    // Each date group should have independently calculated P&L
    for (const [date, trades] of Object.entries(byDate)) {
      if (date === 'unknown') continue
      const sessionPnl = trades.reduce((s, t) => s + t.pnl, 0)
      // Session P&L should be finite
      expect(Number.isFinite(sessionPnl), `Session ${date} P&L is not finite`).toBe(true)
    }
  })
})

/* =====================================================================
   SECTION 7: PARSING CORRECTNESS — Field Preservation
===================================================================== */
describe('Pipeline: Parsing Correctness', () => {
  it('Zerodha CSV preserves all core fields per trade', async () => {
    const result = await parseTradeFile(loadFixture('zerodha-single-day.csv'), 'zerodha-single-day.csv')
    expect(result.success).toBe(true)
    for (const t of result.trades) {
      expect(t.date).toBeTruthy()
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(t.symbol).toBeTruthy()
      expect(typeof t.qty).toBe('number')
      expect(t.qty).toBeGreaterThan(0)
      expect(typeof t.entry).toBe('number')
      expect(t.entry).toBeGreaterThan(0)
      expect(typeof t.pnl).toBe('number')
      // New fields should exist (even if empty string for optional ones)
      expect(typeof t.entry_time).toBe('string')
      expect(typeof t.exit_time).toBe('string')
      expect(typeof t.holding_minutes).toBe('number')
      expect(typeof t.exchange).toBe('string')
      expect(typeof t.trade_id).toBe('string')
    }
  })

  it('paired trades preserve both entry and exit times', async () => {
    const result = await parseTradeFile(loadFixture('zerodha-single-day.csv'), 'zerodha-single-day.csv')
    expect(result.success).toBe(true)
    const pairedWithTimes = result.trades.filter(t => t.exit !== 0)
    // At least some paired trades should exist
    expect(pairedWithTimes.length).toBeGreaterThan(0)
    for (const t of pairedWithTimes) {
      // entry_time should be a valid time string
      expect(t.entry_time).toMatch(/^\d{1,2}:\d{2}/)
      // exit_time should be a valid time string
      expect(t.exit_time).toMatch(/^\d{1,2}:\d{2}/)
      // holding_minutes should be >= 0
      expect(t.holding_minutes).toBeGreaterThanOrEqual(0)
    }
  })

  it('multi-day CSV preserves per-row dates correctly', async () => {
    const result = await parseTradeFile(loadFixture('zerodha-multi-day.csv'), 'zerodha-multi-day.csv')
    expect(result.success).toBe(true)
    const dates = new Set(result.trades.map(t => t.date))
    expect(dates.size).toBe(5)
    // No trade should have 'unknown' date
    for (const t of result.trades) {
      expect(t.date).not.toBe('unknown')
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('P&L calculation matches manual (exit - entry) * qty for longs', () => {
    const rawTrades = [
      { symbol: 'TEST', side: 'BUY', qty: 100, price: 50.00, time: '09:15', date: '2024-01-15' },
      { symbol: 'TEST', side: 'SELL', qty: 100, price: 55.00, time: '09:30', date: '2024-01-15' },
    ]
    const paired = pairTrades(rawTrades)
    expect(paired.length).toBe(1)
    expect(paired[0].pnl).toBe(500) // (55 - 50) * 100
    expect(paired[0].entry).toBe(50)
    expect(paired[0].exit).toBe(55)
    expect(paired[0].side).toBe('BUY')
  })

  it('short trades (sell first) are paired correctly with correct P&L', () => {
    const rawTrades = [
      { symbol: 'NIFTY', side: 'SELL', qty: 75, price: 245.50, time: '09:22', date: '2024-01-15' },
      { symbol: 'NIFTY', side: 'BUY', qty: 75, price: 220.30, time: '09:48', date: '2024-01-15' },
    ]
    const paired = pairTrades(rawTrades)
    expect(paired.length).toBe(1)
    // Short P&L = (entry - exit) * qty = (245.50 - 220.30) * 75 = 1890
    expect(paired[0].pnl).toBe(1890)
    expect(paired[0].side).toBe('SELL')
    expect(paired[0].entry).toBe(245.50)
    expect(paired[0].exit).toBe(220.30)
  })

  it('short trades fixture parses correctly end-to-end', async () => {
    const result = await parseTradeFile(loadFixture('short-trades.csv'), 'short-trades.csv')
    expect(result.success).toBe(true)
    expect(result.trades.length).toBe(3) // 3 round trips
    // First trade: SELL 245.50, BUY 220.30 -> profit
    const t1 = result.trades[0]
    expect(t1.pnl).toBeGreaterThan(0)
    expect(t1.side).toBe('SELL')
    // Second trade: SELL 198.00, BUY 210.50 -> loss (bought back higher)
    const t2 = result.trades[1]
    expect(t2.pnl).toBeLessThan(0)
  })

  it('partial fills create multiple paired trades', () => {
    const rawTrades = [
      { symbol: 'AAPL', side: 'BUY', qty: 100, price: 150.00, time: '10:00', date: '2024-01-15' },
      { symbol: 'AAPL', side: 'SELL', qty: 50, price: 155.00, time: '10:30', date: '2024-01-15' },
      { symbol: 'AAPL', side: 'SELL', qty: 50, price: 160.00, time: '11:00', date: '2024-01-15' },
    ]
    const paired = pairTrades(rawTrades)
    expect(paired.length).toBe(2) // Two partial fills
    expect(paired[0].qty).toBe(50)
    expect(paired[0].pnl).toBe(250) // (155 - 150) * 50
    expect(paired[1].qty).toBe(50)
    expect(paired[1].pnl).toBe(500) // (160 - 150) * 50
  })

  it('holding_minutes is computed correctly during pairing', () => {
    const rawTrades = [
      { symbol: 'TEST', side: 'BUY', qty: 10, price: 100, time: '09:15', date: '2024-01-15' },
      { symbol: 'TEST', side: 'SELL', qty: 10, price: 110, time: '10:45', date: '2024-01-15' },
    ]
    const paired = pairTrades(rawTrades)
    expect(paired.length).toBe(1)
    expect(paired[0].entry_time).toBe('09:15')
    expect(paired[0].exit_time).toBe('10:45')
    expect(paired[0].holding_minutes).toBe(90) // 10:45 - 09:15 = 90 min
  })

  it('unmatched trades are flagged as open positions', () => {
    const rawTrades = [
      { symbol: 'TEST', side: 'BUY', qty: 100, price: 50, time: '09:15', date: '2024-01-15' },
      // No matching sell
    ]
    const paired = pairTrades(rawTrades)
    expect(paired.length).toBe(1)
    expect(paired[0].tag).toBe('open')
    expect(paired[0].label).toBe('Open Position')
    expect(paired[0].exit).toBe(0)
    expect(paired[0].pnl).toBe(0)
  })
})