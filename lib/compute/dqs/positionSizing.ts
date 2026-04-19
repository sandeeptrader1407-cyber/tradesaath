/**
 * Module 2, Layer 4 — DQS Sub-score: Position Sizing (weight 15%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 668-670:
 *   sessionAvgQty    = mean(qtys where qty > 0)
 *   sessionQtyStd    = stddev(qtys where qty > 0)
 *   cv               = sessionAvgQty > 0 ? sessionQtyStd / sessionAvgQty : 0
 *   oversizePenalty  = (patterns.oversizedTrades / n) * 40
 *   positionSizing   = clamp(100 - cv * 80 - oversizePenalty)
 *
 * Low qty coefficient-of-variation (CV) = consistent sizing.
 * 'oversize' pattern tags contribute an additional direct penalty.
 *
 * Inputs used:  trades[].qty, patterns[].tag
 * Inputs unused: cycles[]
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  DQSSubScore,
} from '../types'
import { mean, stddev } from '../patterns/signals'

export const POSITION_SIZING_WEIGHT = 15

export function scorePositionSizing(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  const n = trades.length
  if (n === 0) {
    return {
      name: 'Position Sizing',
      score: 100,
      weight: POSITION_SIZING_WEIGHT,
      detail: 'No trades to score.',
      suggestion:
        'Keep size within ±30% of your baseline across the session.',
    }
  }

  const qtys = trades.map((t) => Number(t.qty) || 0).filter((q) => q > 0)
  const avgQty = mean(qtys)
  const sdQty = stddev(qtys)
  const cv = avgQty > 0 ? sdQty / avgQty : 0

  const oversizedCount = patterns.filter((p) => p.tag === 'oversize').length
  const oversizePenalty = (oversizedCount / n) * 40

  const raw = 100 - cv * 80 - oversizePenalty
  const score = Math.max(0, Math.min(100, raw))

  const pct = oversizedCount > 0 ? Math.round((oversizedCount / n) * 100) : 0
  const detail =
    oversizedCount > 0
      ? `${oversizedCount} oversized trade${oversizedCount > 1 ? 's' : ''} (${pct}% of session). Qty coefficient-of-variation: ${(cv * 100).toFixed(1)}%.`
      : `Qty coefficient-of-variation: ${(cv * 100).toFixed(1)}%. No oversized trades flagged.`

  const suggestion =
    score < 60
      ? 'Pick one size-per-setup rule and stick to it — sizing variance is draining your composite.'
      : score < 85
        ? 'Sizing is mostly tight; trim the outlier positions that earned the oversize tag.'
        : 'Sizing is consistent — this is a strength.'

  return {
    name: 'Position Sizing',
    score: Math.round(score),
    weight: POSITION_SIZING_WEIGHT,
    detail,
    suggestion,
  }
}
