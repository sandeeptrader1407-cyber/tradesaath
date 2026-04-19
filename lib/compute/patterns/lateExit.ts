/**
 * LATE_EXIT detector — ported from legacy patternDetector.ts.
 *
 * Requires: pnl < 0 AND avgHoldingTime > 0 AND sessionAvgLoss > 0
 * AND durationMinutes > avgHoldingTime × 1.5.
 *
 * 3 signals, threshold 0.60:
 *   S1 (w=0.35) — holdMultiple > 2 → value=1 (contribution 0.35)
 *                 else if holdMultiple > 1.5 → value≈0.514 (contribution 0.18 partial)
 *   S2 (w=0.35) — |pnl| > sessionAvgLoss × 2 → value=1 (contribution 0.35)
 *                 else if |pnl| > sessionAvgLoss × 1.5 → value≈0.514 (contribution 0.18 partial)
 *   S3 (w=0.30) — this is one of top-3 largest losses in session
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  type DetectionContext,
} from './signals'

export function detectLateExit(
  ctx: DetectionContext
): DetectedPattern | null {
  const { trade, index, session } = ctx
  const pnl = Number(trade.pnl) || 0
  if (pnl >= 0) return null
  if (session.avgHoldingTime <= 0 || session.sessionAvgLoss <= 0) return null

  const dur = Number(trade.durationMinutes)
  if (!Number.isFinite(dur)) return null
  const holdMultiple = dur / Math.max(1, session.avgHoldingTime)
  if (holdMultiple <= 1.5) return null

  let holdValue = 0
  if (holdMultiple > 2) holdValue = 1
  else if (holdMultiple > 1.5) holdValue = 0.18 / 0.35 // partial port

  let lossValue = 0
  if (Math.abs(pnl) > session.sessionAvgLoss * 2) lossValue = 1
  else if (Math.abs(pnl) > session.sessionAvgLoss * 1.5) lossValue = 0.18 / 0.35

  // S3: "this is one of the largest losses" — legacy: |pnl| >= 3rd-largest
  // loss (min(2, len-1) index in desc-sorted losingAbs). Requires ≥3 losses.
  const top3Threshold =
    session.sortedLosingAbsDesc.length >= 3
      ? session.sortedLosingAbsDesc[
          Math.min(2, session.sortedLosingAbsDesc.length - 1)
        ]
      : Infinity
  const isTop3 =
    session.losingAbs.length >= 3 && Math.abs(pnl) >= top3Threshold

  const signals: SignalResult[] = [
    signal(
      'holdMultiple',
      0.35,
      holdValue,
      `held ${dur.toFixed(1)}min = ${holdMultiple.toFixed(2)}× avg`
    ),
    signal(
      'lossSize',
      0.35,
      lossValue,
      `|pnl|=${Math.abs(pnl)} vs avg ${session.sessionAvgLoss.toFixed(1)}`
    ),
    signal(
      'topLossInSession',
      0.30,
      isTop3 ? 1 : 0,
      `|pnl| vs top-3 cutoff ${top3Threshold}`
    ),
  ]

  const score = scoreSignals(signals)
  if (score < 0.60) return null

  return {
    tradeIndex: index,
    tag: 'late_exit',
    confidence: scoreToConfidence(score),
    score,
    cost: 0,
    signals,
    description: `Late exit on ${trade.symbol}: held ${dur.toFixed(1)}min, lost ${pnl.toFixed(0)} (score ${score.toFixed(2)})`,
  }
}
