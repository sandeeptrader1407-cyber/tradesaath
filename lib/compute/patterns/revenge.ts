/**
 * REVENGE detector — ported from legacy patternDetector.ts.
 *
 * Fires when:
 *   - Current trade is a loss (pnl ≤ 0), AND
 *   - There was a prior losing trade on the SAME symbol
 *
 * 5 signals, threshold 0.55:
 *   S1 (w=0.30) — re-entry within 5 min of same-symbol loss
 *   S2 (w=0.25) — qty > 1.15× losing trade's qty
 *   S3 (w=0.20) — consecutiveLosses (before this trade) ≥ 2
 *   S4 (w=0.15) — |pnl| > sessionAvgLoss × 1.2
 *   S5 (w=0.10) — always fires when there's a prior same-symbol loss
 *                 (same-symbol re-entry is implicit)
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  timeProximityAfterLoss,
  type DetectionContext,
} from './signals'

export function detectRevenge(ctx: DetectionContext): DetectedPattern | null {
  const { trade, index, previous, session } = ctx
  const pnl = Number(trade.pnl) || 0
  const qty = Number(trade.qty) || 0
  const lastLoss = session.lastLossBySymbolAt[index]
  if (!lastLoss || pnl > 0) return null

  const prevConsecLosses = previous ? previous.consecutiveLosses : 0

  const signals: SignalResult[] = [
    // S1: time-proximity after loss
    timeProximityAfterLoss(trade, lastLoss, 0.30),
    // S2: size increase over the losing trade
    signal(
      'sizeIncreaseOverLoser',
      0.25,
      qty > lastLoss.qty * 1.15 && qty > 0 ? 1 : 0,
      `qty ${qty} vs losing qty ${lastLoss.qty}`
    ),
    // S3: losing streak ≥ 2 leading into this trade
    signal(
      'consecutiveLossesBefore',
      0.20,
      prevConsecLosses >= 2 ? 1 : 0,
      `${prevConsecLosses} losses streak before`
    ),
    // S4: loss exceeds session avg loss × 1.2
    signal(
      'lossExceedsAvg',
      0.15,
      Math.abs(pnl) > session.sessionAvgLoss * 1.2 && session.sessionAvgLoss > 0
        ? 1
        : 0,
      `|pnl|=${Math.abs(pnl)} vs avg loss ${session.sessionAvgLoss.toFixed(1)}`
    ),
    // S5: same-symbol re-entry (always 1 when lastLoss exists)
    signal('sameSymbolReentry', 0.10, 1, `re-entering ${trade.symbol}`),
  ]

  const score = scoreSignals(signals)
  if (score < 0.55) return null

  const confidence = scoreToConfidence(score)
  return {
    tradeIndex: index,
    tag: 'revenge',
    confidence,
    score,
    cost: 0, // filled by cost attribution step
    signals,
    description: `Revenge: re-entered ${trade.symbol} after a loss (score ${score.toFixed(2)})`,
  }
}
