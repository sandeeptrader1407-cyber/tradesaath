import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { filterByPeriod, type KPISession } from '../lib/kpi/computeKPIs'

function session(trade_date: string): KPISession {
  return { trade_date, net_pnl: 100, trade_count: 1, win_count: 1, loss_count: 0 }
}

// IST = UTC+5:30 → 330 min offset
// To simulate a given IST wall time, set system time to IST_time - 330min in UTC.
function istToUtcMs(y: number, mo: number, d: number, h: number, m: number): number {
  return Date.UTC(y, mo - 1, d, h, m) - 330 * 60 * 1000
}

describe('filterByPeriod — IST timezone correctness', () => {
  afterEach(() => vi.useRealTimers())

  // ── today ──────────────────────────────────────────────────────────

  it('today at 11:55 PM IST returns trades dated that IST day', () => {
    // 2024-04-15 23:55 IST = 2024-04-15 18:25 UTC
    vi.useFakeTimers()
    vi.setSystemTime(istToUtcMs(2024, 4, 15, 23, 55))

    const now = new Date()
    const sessions: KPISession[] = [
      session('2024-04-15'),
      session('2024-04-14'),
      session('2024-04-16'),
    ]
    const result = filterByPeriod(sessions, 'today', now)
    expect(result).toHaveLength(1)
    expect(result[0].trade_date).toBe('2024-04-15')
  })

  it('today at 1:00 AM IST returns today (IST), not yesterday', () => {
    // 2024-04-15 01:00 IST = 2024-04-14 19:30 UTC
    // Bug: UTC date at 19:30 UTC on 14th is still "2024-04-14" → old code would
    // return yesterday's trades instead of today's IST trades.
    vi.useFakeTimers()
    vi.setSystemTime(istToUtcMs(2024, 4, 15, 1, 0))

    const now = new Date()
    const sessions: KPISession[] = [
      session('2024-04-15'), // today in IST ← should be included
      session('2024-04-14'), // yesterday in IST
    ]
    const result = filterByPeriod(sessions, 'today', now)
    expect(result).toHaveLength(1)
    expect(result[0].trade_date).toBe('2024-04-15')
  })

  // ── thisMonth ──────────────────────────────────────────────────────

  it('thisMonth on April 30 11:55 PM IST returns April trades, not May', () => {
    // 2024-04-30 23:55 IST = 2024-04-30 18:25 UTC
    // Bug: UTC date is still 2024-04-30, but if server tz were UTC+5:30 it would
    // be "2024-05-01 05:25 local", and naive new Date(now.getFullYear(), now.getMonth(), 1)
    // in local tz would give May 1 — filtering out all April trades.
    // Our fix uses IST explicitly so April is always April.
    vi.useFakeTimers()
    vi.setSystemTime(istToUtcMs(2024, 4, 30, 23, 55))

    const now = new Date()
    const sessions: KPISession[] = [
      session('2024-04-01'),
      session('2024-04-30'),
      session('2024-05-01'),
    ]
    const result = filterByPeriod(sessions, 'thisMonth', now)
    expect(result.map(s => s.trade_date)).toEqual(
      expect.arrayContaining(['2024-04-01', '2024-04-30'])
    )
    expect(result.find(s => s.trade_date === '2024-05-01')).toBeUndefined()
  })

  // ── thisWeek ───────────────────────────────────────────────────────

  it('thisWeek on Monday 6 AM IST returns trades from that Monday onward', () => {
    // 2024-04-15 is a Monday. 06:00 IST = 00:30 UTC on 2024-04-15.
    vi.useFakeTimers()
    vi.setSystemTime(istToUtcMs(2024, 4, 15, 6, 0))

    const now = new Date()
    const sessions: KPISession[] = [
      session('2024-04-14'), // Sunday — previous week
      session('2024-04-15'), // Monday — start of this ISO week ← included
      session('2024-04-16'), // Tuesday ← included
      session('2024-04-17'), // Wednesday ← included
    ]
    const result = filterByPeriod(sessions, 'thisWeek', now)
    expect(result.map(s => s.trade_date)).toEqual(
      expect.arrayContaining(['2024-04-15', '2024-04-16', '2024-04-17'])
    )
    expect(result.find(s => s.trade_date === '2024-04-14')).toBeUndefined()
  })

  it('thisWeek on Sunday uses previous Monday as week start (ISO week)', () => {
    // 2024-04-21 is a Sunday. ISO week started on Monday 2024-04-15.
    vi.useFakeTimers()
    vi.setSystemTime(istToUtcMs(2024, 4, 21, 12, 0))

    const now = new Date()
    const sessions: KPISession[] = [
      session('2024-04-14'), // previous Sunday — outside this week
      session('2024-04-15'), // Monday ← in this ISO week
      session('2024-04-21'), // Sunday ← in this ISO week
    ]
    const result = filterByPeriod(sessions, 'thisWeek', now)
    expect(result.map(s => s.trade_date)).toEqual(
      expect.arrayContaining(['2024-04-15', '2024-04-21'])
    )
    expect(result.find(s => s.trade_date === '2024-04-14')).toBeUndefined()
  })
})
