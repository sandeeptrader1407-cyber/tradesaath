/**
 * Module 2, Layer 4 — DQS Sub-score: Emotional Control (weight 20%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 673-674:
 *   tiltCount        = revengeTrades + fomoEntries + panicExits + averagingDown
 *   emotionalControl = clamp(((n - tiltCount) / n) * 100)
 *
 * Measures the share of trades free of any tilt behaviour
 * (revenge / FOMO / panic / averaging-down).
 *
 * Inputs used:  trades.length (n), patterns[] (tag counts)
 * Inputs unused: cycles[]
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  DQSSubScore,
} from '../types'

export const EMOTIONAL_CONTROL_WEIGHT = 20

const TILT_TAGS: ReadonlySet<string> = new Set([
  'revenge',
  'fomo',
  'panic',
  'averaging',
])

export function scoreEmotionalControl(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  const n = trades.length
  if (n === 0) {
    return {
      name: 'Emotional Control',
      score: 100,
      weight: EMOTIONAL_CONTROL_WEIGHT,
      detail: 'No trades to score.',
      suggestion:
        'Walk away for 15 min after any loss exceeding your session average.',
    }
  }

  const tiltCount = patterns.filter((p) =>
    TILT_TAGS.has(String(p.tag))
  ).length

  const raw = ((n - tiltCount) / n) * 100
  const score = Math.max(0, Math.min(100, raw))

  const detail =
    tiltCount === 0
      ? `All ${n} trade${n === 1 ? '' : 's'} were free of revenge/FOMO/panic/averaging tags — emotionally clean.`
      : `${tiltCount} of ${n} trade${n === 1 ? '' : 's'} carried a tilt-behaviour tag (revenge/FOMO/panic/averaging).`

  const suggestion =
    score < 60
      ? 'Install a 15-min cooldown after every losing trade — tilt is your single biggest P&L leak.'
      : score < 85
        ? 'One or two emotional entries crept in. Pre-commit to the cooldown rule.'
        : 'Emotional discipline is solid — protect it.'

  return {
    name: 'Emotional Control',
    score: Math.round(score),
    weight: EMOTIONAL_CONTROL_WEIGHT,
    detail,
    suggestion,
  }
}
