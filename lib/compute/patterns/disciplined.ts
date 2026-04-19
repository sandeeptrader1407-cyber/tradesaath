/**
 * DISCIPLINED detector — ported from legacy patternDetector.ts.
 *
 * Flags trades with a clean setup:
 *   - Entered in the high-probability window: 3..45 minutes after
 *     sessionStartMinutes (session-relative — works for any market)
 *   - Reasonable size: qty > 0 AND qty ≤ max(1, sessionAvgQty × 1.2)
 *
 * Note: in legacy, disciplined candidates are always added when
 * both gates hold, but orchestrator priority causes mistake tags
 * to win over 'disciplined' in the priority contest. This detector
 * mirrors that: returns a DetectedPattern with score=0 (low conf);
 * the orchestrator resolves conflicts.
 */

import type { DetectedPattern, SignalResult } from '../types'
import { signal, timeToMinutes, type DetectionContext } from './signals'

export function detectDisciplined(
  ctx: DetectionContext
): DetectedPattern | null {
  const { trade, index, session } = ctx
  const qty = Number(trade.qty) || 0
  const m = timeToMinutes(trade.entryTime)

  const goodEntryWindow =
    m !== null &&
    m >= session.sessionStartMinutes + 3 &&
    m <= session.sessionStartMinutes + 45

  const reasonableSize =
    qty > 0 && qty <= Math.max(1, session.sessionAvgQty * 1.2)

  if (!goodEntryWindow || !reasonableSize) return null

  const signals: SignalResult[] = [
    signal(
      'goodEntryWindow',
      0.5,
      1,
      `entered at ${trade.entryTime} (${m! - session.sessionStartMinutes}min into session)`
    ),
    signal(
      'reasonableSize',
      0.5,
      1,
      `qty ${qty} ≤ 1.2× session avg ${session.sessionAvgQty.toFixed(1)}`
    ),
  ]

  // Score intentionally zero — mirrors legacy candidate (score: 0, confidence: 'low')
  return {
    tradeIndex: index,
    tag: 'disciplined',
    confidence: 'low',
    score: 0,
    cost: 0,
    signals,
    description: `Disciplined: entered in high-probability window (${trade.entryTime}) with normal size`,
  }
}
