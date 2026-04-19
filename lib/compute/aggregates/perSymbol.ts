/**
 * Module 2, Layer 6 — Aggregate: Per-Symbol Metrics.
 *
 * Pure rollup. Groups EnrichedTrade[] by trade.symbol.
 * No detection, no scoring, no AI.
 *
 * Breakevens (isWin=false AND isLoss=false) do NOT count toward
 * winCount or lossCount, but they DO count toward tradeCount.
 */

import type { EnrichedTrade, PerSymbolMetrics } from '../types'

export function computePerSymbolMetrics(
  trades: EnrichedTrade[]
): PerSymbolMetrics[] {
  if (trades.length === 0) return []

  const groups = new Map<string, EnrichedTrade[]>()
  for (const t of trades) {
    const key = String(t.symbol ?? 'UNKNOWN')
    const arr = groups.get(key)
    if (arr) arr.push(t)
    else groups.set(key, [t])
  }

  const out: PerSymbolMetrics[] = []
  for (const [symbol, group] of Array.from(groups.entries())) {
    const tradeCount = group.length
    let winCount = 0
    let lossCount = 0
    let totalPnl = 0
    let bestTrade = -Infinity
    let worstTrade = Infinity
    let totalHolding = 0
    let totalCapitalDeployed = 0

    for (const t of group) {
      const pnl = Number(t.pnl) || 0
      if (t.isWin) winCount += 1
      if (t.isLoss) lossCount += 1
      totalPnl += pnl
      if (pnl > bestTrade) bestTrade = pnl
      if (pnl < worstTrade) worstTrade = pnl
      totalHolding += Number(t.durationMinutes) || 0
      totalCapitalDeployed += Number(t.capitalDeployed) || 0
    }

    out.push({
      symbol,
      tradeCount,
      winCount,
      lossCount,
      winRate: tradeCount > 0 ? winCount / tradeCount : 0,
      totalPnl,
      avgPnl: totalPnl / tradeCount,
      bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
      worstTrade: worstTrade === Infinity ? 0 : worstTrade,
      avgHoldingMinutes: totalHolding / tradeCount,
      totalCapitalDeployed,
    })
  }

  // Sort by tradeCount DESC (most-traded first). Tie-break: symbol ASC.
  out.sort((a, b) => {
    if (b.tradeCount !== a.tradeCount) return b.tradeCount - a.tradeCount
    return a.symbol.localeCompare(b.symbol)
  })
  return out
}
