/**
 * Module 2, Layer 4 — DQS Sub-score: Exit Discipline (weight 15%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 677-678:
 *   badExits       = panicExits + lateExits + averagingDown
 *   exitDiscipline = clamp(((n - badExits) / n) * 100)
 *
 * Averaging-down is classified as a bad exit (not a bad entry) here
 * because it compounds a losing thesis instead of closing it — the
 * legacy decomposition is preserved verbatim.
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

export const EXIT_DISCIPLINE_WEIGHT = 15

const BAD_EXIT_TAGS: ReadonlySet<string> = new Set([
  'panic',
  'late_exit',
  'averaging',
])

export function scoreExitDiscipline(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  const n = trades.length
  if (n === 0) {
    return {
      name: 'Exit Discipline',
      score: 100,
      weight: EXIT_DISCIPLINE_WEIGHT,
      detail: 'No trades to score.',
      suggestion:
        'Honour your invalidation level — exit at the stop, not at the fear.',
    }
  }

  const badExits = patterns.filter((p) =>
    BAD_EXIT_TAGS.has(String(p.tag))
  ).length

  const raw = ((n - badExits) / n) * 100
  const score = Math.max(0, Math.min(100, raw))

  const detail =
    badExits === 0
      ? `All ${n} exit${n === 1 ? '' : 's'} were clean — no panic/late/averaging flags.`
      : `${badExits} of ${n} trade${n === 1 ? '' : 's'} had a panic exit, late exit, or averaging-down flag.`

  const suggestion =
    score < 60
      ? 'Pre-set stop AND target before every entry. Exits should be automatic, not emotional.'
      : score < 85
        ? 'Most exits were disciplined — focus on eliminating the last late-exit outliers.'
        : 'Exit execution is disciplined.'

  return {
    name: 'Exit Discipline',
    score: Math.round(score),
    weight: EXIT_DISCIPLINE_WEIGHT,
    detail,
    suggestion,
  }
}
