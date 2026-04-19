/**
 * Module 2, Layer 7 — Key stats extraction.
 *
 * Pulls headline numbers from SessionMetrics + the enriched trades.
 * Output matches SessionInsights['keyStats'] shape.
 */

import type { EnrichedTrade, SessionInsights, SessionMetrics } from '../types'

type KeyStats = SessionInsights['keyStats']

export function buildKeyStats(
  trades: EnrichedTrade[],
  metrics: SessionMetrics
): KeyStats {
  if (trades.length === 0) {
    return {
      longestHold: { minutes: 0, tradeIndex: -1 },
      shortestHold: { minutes: 0, tradeIndex: -1 },
      biggestWin: { amount: 0, tradeIndex: -1 },
      biggestLoss: { amount: 0, tradeIndex: -1 },
      peakCapital: 0,
      turningPoint: null,
      tradingStyle: metrics.tradingStyle || 'intraday',
    }
  }

  let longestMin = -Infinity
  let longestIdx = -1
  let shortestMin = Infinity
  let shortestIdx = -1
  for (const t of trades) {
    const dur = Number(t.durationMinutes) || 0
    const idx = Number(t.tradeIndex) || 0
    if (dur > longestMin) {
      longestMin = dur
      longestIdx = idx
    }
    if (dur < shortestMin) {
      shortestMin = dur
      shortestIdx = idx
    }
  }
  if (longestMin === -Infinity) longestMin = 0
  if (shortestMin === Infinity) shortestMin = 0

  const turningPoint =
    metrics.turningPointIndex === null
      ? null
      : {
          tradeIndex: metrics.turningPointIndex,
          description: `Peak at trade #${metrics.turningPointIndex + 1}, then drawdown began`,
        }

  return {
    longestHold: { minutes: longestMin, tradeIndex: longestIdx },
    shortestHold: { minutes: shortestMin, tradeIndex: shortestIdx },
    biggestWin: {
      amount: metrics.bestTradePnl,
      tradeIndex: metrics.bestTradeIndex,
    },
    biggestLoss: {
      amount: metrics.worstTradePnl,
      tradeIndex: metrics.worstTradeIndex,
    },
    peakCapital: metrics.peakCapitalAtOneTime,
    turningPoint,
    tradingStyle: metrics.tradingStyle,
  }
}
