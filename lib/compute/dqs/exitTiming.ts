/**
 * Module 2, Layer 4 — DQS Sub-score: Exit Timing (weight 10%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 685-686:
 *   cleanExits = n - panicExits - lateExits
 *   exitTiming = clamp((cleanExits / n) * 100)
 *
 * NOTE: exitTiming and exitDiscipline overlap — exitDiscipline ALSO
 * penalises averagingDown, exitTiming does NOT. Keeping them distinct
 * mirrors the legacy decomposition verbatim.
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

export const EXIT_TIMING_WEIGHT = 10

const BAD_TIMING_TAGS: ReadonlySet<string> = new Set(['panic', 'late_exit'])

export function scoreExitTiming(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  const n = trades.length
  if (n === 0) {
    return {
      name: 'Exit Timing',
      score: 100,
      weight: EXIT_TIMING_WEIGHT,
      detail: 'No trades to score.',
      suggestion:
        'Hold every trade at least 2 min unless structure invalidates.',
    }
  }

  const badTiming = patterns.filter((p) =>
    BAD_TIMING_TAGS.has(String(p.tag))
  ).length
  const cleanExits = n - badTiming

  const raw = (cleanExits / n) * 100
  const score = Math.max(0, Math.min(100, raw))

  const detail = `${cleanExits} of ${n} exit${n === 1 ? '' : 's'} were neither panic nor late.`

  const suggestion =
    score < 60
      ? 'Panic or late exits cost more than the trades themselves. Define exit triggers BEFORE entry.'
      : score < 85
        ? 'Mostly well-timed exits — one more pre-committed exit plan per trade should close the gap.'
        : 'Exit timing is accurate.'

  return {
    name: 'Exit Timing',
    score: Math.round(score),
    weight: EXIT_TIMING_WEIGHT,
    detail,
    suggestion,
  }
}
