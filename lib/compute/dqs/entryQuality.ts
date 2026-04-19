/**
 * Module 2, Layer 4 — DQS Sub-score: Entry Quality (weight 10%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 681-682:
 *   goodEntries  = count of trades where entryMin is in
 *                  [sessionStartMinutes + 3, sessionStartMinutes + 45]
 *   entryQuality = clamp((goodEntries / n) * 100)
 *
 * Session start = earliest entryTime in the session (fallback 09:15).
 * "High-probability window" = 3-45 min after the session opens —
 * avoids the noisy first-3-min auction phase and the stale
 * post-45-min drift.
 *
 * Inputs used:  trades[].entryTime (HH:MM)
 * Inputs unused: patterns[], cycles[]
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  DQSSubScore,
} from '../types'
import { timeToMinutes } from '../patterns/signals'

export const ENTRY_QUALITY_WEIGHT = 10

export function scoreEntryQuality(
  trades: EnrichedTrade[],
  _patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  const n = trades.length
  if (n === 0) {
    return {
      name: 'Entry Quality',
      score: 100,
      weight: ENTRY_QUALITY_WEIGHT,
      detail: 'No trades to score.',
      suggestion:
        "Enter in the 3-45 min post-open window — that's where your edge lives.",
    }
  }

  const mins = trades.map((t) => timeToMinutes(t.entryTime))
  const validMins = mins.filter((m): m is number => m !== null)
  const sessionStart =
    validMins.length > 0 ? Math.min(...validMins) : 9 * 60 + 15

  const windowLo = sessionStart + 3
  const windowHi = sessionStart + 45

  let goodEntries = 0
  for (const m of mins) {
    if (m !== null && m >= windowLo && m <= windowHi) goodEntries += 1
  }

  const raw = (goodEntries / n) * 100
  const score = Math.max(0, Math.min(100, raw))

  const detail = `${goodEntries} of ${n} entr${n === 1 ? 'y' : 'ies'} fell inside your 3-45 min post-open window.`

  const suggestion =
    score < 60
      ? 'Over half your entries happened outside the high-probability window. Anchor entries to the first 45 min after open.'
      : score < 85
        ? 'A handful of entries missed the 3-45 min window — tighten your clock discipline.'
        : "Entry timing is sharp — you're trading inside your edge."

  return {
    name: 'Entry Quality',
    score: Math.round(score),
    weight: ENTRY_QUALITY_WEIGHT,
    detail,
    suggestion,
  }
}
