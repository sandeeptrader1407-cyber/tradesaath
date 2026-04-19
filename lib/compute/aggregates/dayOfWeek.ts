/**
 * Module 2, Layer 6 — Aggregate: Day-of-Week Metrics.
 *
 * Groups by trade.dayOfWeek (0=Sun ... 6=Sat). Only days with trades
 * are returned. Sorted in natural order 0..6 (Sun, Mon, Tue, Wed, Thu,
 * Fri, Sat) — chosen for data-layer simplicity; UI can reorder to
 * Mon-first if desired.
 */

import type { EnrichedTrade, DayOfWeekMetrics } from '../types'

export function computeDayOfWeekMetrics(
  trades: EnrichedTrade[]
): DayOfWeekMetrics[] {
  if (trades.length === 0) return []
  const groups = new Map<number, EnrichedTrade[]>()
  for (const t of trades) {
    const dow = Number(t.dayOfWeek)
    if (!Number.isFinite(dow) || dow < 0 || dow > 6) continue
    const arr = groups.get(dow)
    if (arr) arr.push(t)
    else groups.set(dow, [t])
  }

  const out: DayOfWeekMetrics[] = []
  for (const [dow, group] of Array.from(groups.entries())) {
    const tradeCount = group.length
    let winCount = 0
    let totalPnl = 0
    let bestTrade = -Infinity
    let worstTrade = Infinity
    let dayName = group[0]?.dayOfWeekName || ''
    for (const t of group) {
      const pnl = Number(t.pnl) || 0
      if (t.isWin) winCount += 1
      totalPnl += pnl
      if (pnl > bestTrade) bestTrade = pnl
      if (pnl < worstTrade) worstTrade = pnl
      if (!dayName && t.dayOfWeekName) dayName = t.dayOfWeekName
    }
    out.push({
      dayOfWeek: dow,
      dayName,
      tradeCount,
      winCount,
      winRate: tradeCount > 0 ? winCount / tradeCount : 0,
      totalPnl,
      avgPnl: totalPnl / tradeCount,
      bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
      worstTrade: worstTrade === Infinity ? 0 : worstTrade,
    })
  }
  out.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  return out
}
