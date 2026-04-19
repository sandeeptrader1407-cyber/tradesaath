/**
 * OVERSIZE detector — ported from legacy patternDetector.ts.
 *
 * Requires: userTypicalQty > 0 AND qty > userTypicalQty × 1.5.
 *
 * 3 signals, threshold 0.55:
 *   S1 (w=0.40) — size > 2× typical → value=1 (contribution 0.40)
 *                 else if size > 1.5× → value=0.5 (contribution 0.20 partial)
 *   S2 (w=0.30) — trade is a loser
 *   S3 (w=0.30) — loser AND |pnl| > sessionAvgLoss × 1.5
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  type DetectionContext,
} from './signals'

export function detectOversize(ctx: DetectionContext): DetectedPattern | null {
  const { trade, index, session } = ctx
  const qty = Number(trade.qty) || 0
  const typical = session.userTypicalQty

  if (typical <= 0 || qty <= typical * 1.5) return null

  const pnl = Number(trade.pnl) || 0
  const sizeMultiple = qty / typical

  let sizeValue = 0
  if (sizeMultiple > 2) sizeValue = 1
  else if (sizeMultiple > 1.5) sizeValue = 0.5

  const signals: SignalResult[] = [
    signal(
      'sizeRatio',
      0.40,
      sizeValue,
      `qty ${qty} = ${sizeMultiple.toFixed(2)}× typical ${typical.toFixed(1)}`
    ),
    signal('isLoser', 0.30, pnl < 0 ? 1 : 0, `pnl=${pnl}`),
    signal(
      'lossExceedsAvg',
      0.30,
      pnl < 0 &&
        session.sessionAvgLoss > 0 &&
        Math.abs(pnl) > session.sessionAvgLoss * 1.5
        ? 1
        : 0,
      `|pnl|=${Math.abs(pnl)} vs 1.5× avg ${session.sessionAvgLoss.toFixed(1)}`
    ),
  ]

  const score = scoreSignals(signals)
  if (score < 0.55) return null

  return {
    tradeIndex: index,
    tag: 'oversize',
    confidence: scoreToConfidence(score),
    score,
    cost: 0,
    signals,
    description: `Oversized: qty ${qty} = ${sizeMultiple.toFixed(1)}× typical (score ${score.toFixed(2)})`,
  }
}
