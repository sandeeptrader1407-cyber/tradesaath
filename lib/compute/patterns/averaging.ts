/**
 * AVERAGING-DOWN detector — ported from legacy patternDetector.ts.
 *
 * Fires when the trade is part of a streak of consecutive BUYs on
 * the same symbol at strictly descending prices (streak length ≥ 2).
 * Streak detection happens upfront in computeSessionStats — this
 * detector only scores trades already flagged.
 *
 * Threshold 0.60. Base + 3 signals:
 *   Base (w=0.40) — always fires when the trade is in an averaging streak
 *   S1 (w=0.20) — streak length ≥ 3 at this point
 *   S2 (w=0.20) — this trade is a loser
 *   S3 (w=0.20) — qty > sessionAvgQty × 1.3
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  type DetectionContext,
} from './signals'

export function detectAveraging(
  ctx: DetectionContext
): DetectedPattern | null {
  const { trade, index, session } = ctx

  if (!session.averagingIndices.has(index)) return null

  const pnl = Number(trade.pnl) || 0
  const qty = Number(trade.qty) || 0
  const streakLen = session.avgStreakLengthAt.get(index) || 0

  const signals: SignalResult[] = [
    signal('inAveragingStreak', 0.40, 1, 'confirmed averaging streak'),
    signal(
      'streakLength3Plus',
      0.20,
      streakLen >= 3 ? 1 : 0,
      `streak length ${streakLen}`
    ),
    signal('isLosingTrade', 0.20, pnl < 0 ? 1 : 0, `pnl=${pnl}`),
    signal(
      'oversizedVsAvg',
      0.20,
      session.sessionAvgQty > 0 && qty > session.sessionAvgQty * 1.3 ? 1 : 0,
      `qty ${qty} vs avg ${session.sessionAvgQty.toFixed(1)}`
    ),
  ]

  const score = scoreSignals(signals)
  if (score < 0.60) return null

  return {
    tradeIndex: index,
    tag: 'averaging',
    confidence: scoreToConfidence(score),
    score,
    cost: 0,
    signals,
    description: `Averaging: consecutive buys on ${trade.symbol} at lower prices (score ${score.toFixed(2)})`,
  }
}
