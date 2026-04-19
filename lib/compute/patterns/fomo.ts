/**
 * FOMO detector — ported from legacy patternDetector.ts.
 *
 * 5 signals, threshold 0.55:
 *   S1 (w=0.25) — entry in first 3 minutes of session (sessionStart..sessionStart+3)
 *   S2 (w=0.25) — qty > sessionAvgQty × 1.8
 *   S3 (w=0.20) — previous trade was a big win (top 25% of session winners)
 *   S4 (w=0.15) — trade is a loser
 *   S5 (w=0.15) — loser AND |pnl| > sessionAvgLoss × 1.5
 */

import type { DetectedPattern, SignalResult } from '../types'
import {
  scoreSignals,
  scoreToConfidence,
  signal,
  timeToMinutes,
  type DetectionContext,
} from './signals'

export function detectFomo(ctx: DetectionContext): DetectedPattern | null {
  const { trade, index, session } = ctx

  const pnl = Number(trade.pnl) || 0
  const qty = Number(trade.qty) || 0
  const m = timeToMinutes(trade.entryTime)

  const earlyEntry =
    m !== null &&
    m >= session.sessionStartMinutes &&
    m <= session.sessionStartMinutes + 3

  const signals: SignalResult[] = [
    signal(
      'earlyEntry',
      0.25,
      earlyEntry ? 1 : 0,
      earlyEntry
        ? `entered at ${trade.entryTime} (≤3min into session)`
        : 'not early-open'
    ),
    signal(
      'largeOversize',
      0.25,
      session.sessionAvgQty > 0 && qty > session.sessionAvgQty * 1.8 ? 1 : 0,
      `qty ${qty} vs ${session.sessionAvgQty.toFixed(1)} × 1.8`
    ),
    signal(
      'prevWasBigWin',
      0.20,
      session.prevWasBigWinAt[index] ? 1 : 0,
      session.prevWasBigWinAt[index]
        ? 'chasing after a big win'
        : 'no big win prior'
    ),
    signal('isLoser', 0.15, pnl < 0 ? 1 : 0, `pnl=${pnl}`),
    signal(
      'biggerThanAvgLoss',
      0.15,
      pnl < 0 &&
        session.sessionAvgLoss > 0 &&
        Math.abs(pnl) > session.sessionAvgLoss * 1.5
        ? 1
        : 0,
      `|pnl|=${Math.abs(pnl)} vs 1.5× avg loss ${session.sessionAvgLoss.toFixed(1)}`
    ),
  ]

  const score = scoreSignals(signals)
  if (score < 0.55) return null

  return {
    tradeIndex: index,
    tag: 'fomo',
    confidence: scoreToConfidence(score),
    score,
    cost: 0,
    signals,
    description: `FOMO entry on ${trade.symbol} (score ${score.toFixed(2)})`,
  }
}
