/**
 * PANIC detector — ported from legacy patternDetector.ts.
 *
 * Requires: pnl < 0 AND a finite duration (durationMinutes).
 *
 * 5 signals, threshold 0.55:
 *   S1 (w=0.30) — held < 2 minutes
 *   S2 (w=0.10) — held < 1 minute (extra, on top of S1)
 *   S3 (w=0.20) — consecutiveLosses (before this trade) ≥ 2
 *   S4 (w=0.20) — premature exit: |pnl| < sessionAvgLoss × 0.6
 *   S5 (w=0.20) — session has been net negative so far (cumulativePnl < 0)
 *
 * Note: legacy detector uses `durApprox` as a proxy for duration via
 * `time_gap_minutes` or next-trade entry delta. We use
 * EnrichedTrade.durationMinutes which is exit-minus-entry — the cleaner
 * value this proxy was trying to approximate.
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  type DetectionContext,
} from './signals'

export function detectPanic(ctx: DetectionContext): DetectedPattern | null {
  const { trade, index, previous, session } = ctx

  const pnl = Number(trade.pnl) || 0
  if (pnl >= 0) return null

  const dur = Number(trade.durationMinutes)
  if (!Number.isFinite(dur)) return null

  const prevConsecLosses = previous ? previous.consecutiveLosses : 0

  const signals: SignalResult[] = [
    signal(
      'heldUnder2Min',
      0.30,
      dur < 2 ? 1 : 0,
      `held ${dur.toFixed(1)}min`
    ),
    signal(
      'heldUnder1Min',
      0.10,
      dur < 1 ? 1 : 0,
      `held ${dur.toFixed(1)}min`
    ),
    signal(
      'consecutiveLossesBefore',
      0.20,
      prevConsecLosses >= 2 ? 1 : 0,
      `${prevConsecLosses} losses before`
    ),
    signal(
      'prematureExit',
      0.20,
      session.sessionAvgLoss > 0 &&
        Math.abs(pnl) < session.sessionAvgLoss * 0.6
        ? 1
        : 0,
      `|pnl|=${Math.abs(pnl)} vs 0.6× avg loss ${session.sessionAvgLoss.toFixed(1)}`
    ),
    signal(
      'sessionNetNegative',
      0.20,
      trade.cumulativePnl < 0 ? 1 : 0,
      `cumulativePnl before=${trade.cumulativePnl}`
    ),
  ]

  const score = scoreSignals(signals)
  if (score < 0.55) return null

  return {
    tradeIndex: index,
    tag: 'panic',
    confidence: scoreToConfidence(score),
    score,
    cost: 0,
    signals,
    description: `Panic exit on ${trade.symbol} after ${dur.toFixed(1)}min (score ${score.toFixed(2)})`,
  }
}
