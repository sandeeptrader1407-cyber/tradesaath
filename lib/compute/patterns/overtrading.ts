/**
 * OVERTRADING detector — ported from legacy patternDetector.ts.
 *
 * Requires: session volume > avgDailyTrades × 1.5 AND this trade
 * is at index ≥ overtradingThreshold (ceil(avgDailyTrades × 1.5)).
 *
 * 4 signals, threshold 0.50:
 *   S1 (w=0.30) — always fires in the overtrade zone
 *   S2 (w=0.20) — index ≥ ceil(avgDailyTrades × 2)
 *   S3 (w=0.25) — trade is a loser
 *   S4 (w=0.25) — declining P&L: previous 2 trades were also losers
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  type DetectionContext,
} from './signals'

export function detectOvertrading(
  ctx: DetectionContext
): DetectedPattern | null {
  const { trade, index, session, allTrades } = ctx

  if (!session.overtradingDetected) return null
  if (index < session.overtradingThreshold) return null

  const pnl = Number(trade.pnl) || 0
  const doubleThreshold = Math.ceil(session.avgDailyTrades * 2)
  const prev1 = index >= 1 ? Number(allTrades[index - 1].pnl) || 0 : 0
  const prev2 = index >= 2 ? Number(allTrades[index - 2].pnl) || 0 : 0
  const prevsLosing = index >= 2 && prev1 < 0 && prev2 < 0

  const signals: SignalResult[] = [
    signal('beyond1p5xDailyNorm', 0.30, 1, `index ${index} ≥ threshold ${session.overtradingThreshold}`),
    signal(
      'beyond2xDailyNorm',
      0.20,
      index >= doubleThreshold ? 1 : 0,
      `index ${index} vs 2× threshold ${doubleThreshold}`
    ),
    signal('isLoser', 0.25, pnl < 0 ? 1 : 0, `pnl=${pnl}`),
    signal(
      'decliningPnl',
      0.25,
      prevsLosing ? 1 : 0,
      `prev2 losses: ${prev2}, ${prev1}`
    ),
  ]

  const score = scoreSignals(signals)
  if (score < 0.50) return null

  return {
    tradeIndex: index,
    tag: 'overtrading',
    confidence: scoreToConfidence(score),
    score,
    cost: 0,
    signals,
    description: `Overtrading: trade #${index + 1} beyond ${Math.round(session.avgDailyTrades)}/day norm (score ${score.toFixed(2)})`,
  }
}
