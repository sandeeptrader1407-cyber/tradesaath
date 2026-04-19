/**
 * Module 2, Layer 4 — Decision Quality Score orchestrator.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║ PORT NOTES                                                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * • Every sub-score formula is ported EXACTLY from the existing
 *   `lib/analysis/patternDetector.ts` DQS block (lines 656-720 of
 *   that file). No scoring formula was invented in this file or in
 *   the seven sub-score modules.
 *
 * • Sub-score weights match the legacy composite precisely:
 *     Risk Management      25 %    ← scoreRiskManagement
 *     Emotional Control    20 %    ← scoreEmotionalControl
 *     Position Sizing      15 %    ← scorePositionSizing
 *     Exit Discipline      15 %    ← scoreExitDiscipline
 *     Entry Quality        10 %    ← scoreEntryQuality
 *     Exit Timing          10 %    ← scoreExitTiming
 *     Rule Following        5 %    ← scoreRuleFollowing
 *                          ────
 *                          100 %
 *
 * • Composite  overall = Σ (score × weight) / 100,  clamped 0..100,
 *   rounded to nearest integer. Matches legacy formula exactly.
 *
 * • Grade thresholds — INTENTIONALLY DIFFER from legacy.
 *   This port uses the stricter spec thresholds:
 *       A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60
 *   Legacy used A ≥ 80, B ≥ 65, C ≥ 45, D ≥ 25, F < 25.
 *   The ±5-point sanity check is done against the numeric `overall`,
 *   not the letter grade — grades are a downstream presentation
 *   concern and are allowed to differ by policy.
 *
 * • NEW fields on DQSSubScore vs. legacy DQS<number>:
 *     `detail`      – human-readable summary of the underlying data
 *                     (no new computation; same stats rendered as text)
 *     `suggestion`  – a pre-canned coaching line tiered by score band
 *                     (<60, 60-84, ≥85). No new scoring.
 *
 * • NEW field on DQSResult vs. legacy DQS:
 *     `biggestDrag` – the sub-score with the largest weighted shortfall.
 *                     shortfall = weight × (100 − score) / 100.
 *                     `potentialImprovement` = the same value = how
 *                     many composite points this sub-score would add
 *                     if it went to 100.
 *
 * Sources read during port (none were modified):
 *   - lib/analysis/patternDetector.ts    (existing DQS implementation)
 *   - lib/analysis/sessionSummarizer.ts  (color + suggestion templates)
 *   - lib/kpi/computeKPIs.ts             (multi-session disciplineScore,
 *                                         NOT the per-session DQS)
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  DQSResult,
  DQSSubScore,
} from '../types'
import {
  scoreRiskManagement,
  RISK_MANAGEMENT_WEIGHT,
} from './riskManagement'
import {
  scoreEmotionalControl,
  EMOTIONAL_CONTROL_WEIGHT,
} from './emotionalControl'
import {
  scorePositionSizing,
  POSITION_SIZING_WEIGHT,
} from './positionSizing'
import {
  scoreExitDiscipline,
  EXIT_DISCIPLINE_WEIGHT,
} from './exitDiscipline'
import {
  scoreEntryQuality,
  ENTRY_QUALITY_WEIGHT,
} from './entryQuality'
import { scoreExitTiming, EXIT_TIMING_WEIGHT } from './exitTiming'
import {
  scoreRuleFollowing,
  RULE_FOLLOWING_WEIGHT,
} from './ruleFollowing'

export {
  scoreRiskManagement,
  RISK_MANAGEMENT_WEIGHT,
} from './riskManagement'
export {
  scoreEmotionalControl,
  EMOTIONAL_CONTROL_WEIGHT,
} from './emotionalControl'
export {
  scorePositionSizing,
  POSITION_SIZING_WEIGHT,
} from './positionSizing'
export {
  scoreExitDiscipline,
  EXIT_DISCIPLINE_WEIGHT,
} from './exitDiscipline'
export {
  scoreEntryQuality,
  ENTRY_QUALITY_WEIGHT,
} from './entryQuality'
export { scoreExitTiming, EXIT_TIMING_WEIGHT } from './exitTiming'
export {
  scoreRuleFollowing,
  RULE_FOLLOWING_WEIGHT,
} from './ruleFollowing'

/**
 * Grade thresholds per the Step 5 spec (stricter than legacy).
 * Legacy thresholds for reference: A 80 / B 65 / C 45 / D 25 / F <25.
 */
export function gradeFor(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Weighted-sum composite, rounded and clamped to 0..100.
 * Reproduces the legacy formula:
 *   overall = 0.25*RM + 0.20*EC + 0.15*PS + 0.15*ED
 *           + 0.10*EQ + 0.10*ET + 0.05*RF
 */
export function computeComposite(subScores: DQSSubScore[]): number {
  const raw = subScores.reduce(
    (acc, s) => acc + (s.score * s.weight) / 100,
    0
  )
  return Math.max(0, Math.min(100, Math.round(raw)))
}

/**
 * Pick the single sub-score with the largest weighted shortfall from 100.
 * shortfall(s) = s.weight * (100 - s.score) / 100
 *
 * Ties are broken by iteration order — which is the stable display
 * order (risk → emotional → sizing → exit-disc → entry → exit-time → rules).
 */
export function findBiggestDrag(subScores: DQSSubScore[]): {
  factorName: string
  currentScore: number
  potentialImprovement: number
} {
  if (subScores.length === 0) {
    return { factorName: '', currentScore: 100, potentialImprovement: 0 }
  }
  let drag = subScores[0]
  let dragShortfall = (drag.weight * (100 - drag.score)) / 100
  for (let i = 1; i < subScores.length; i++) {
    const s = subScores[i]
    const shortfall = (s.weight * (100 - s.score)) / 100
    if (shortfall > dragShortfall) {
      drag = s
      dragShortfall = shortfall
    }
  }
  return {
    factorName: drag.name,
    currentScore: drag.score,
    potentialImprovement: Math.round(dragShortfall * 10) / 10,
  }
}

/**
 * Main entrypoint — compute the DQSResult for a session.
 *
 * INPUTS  (all read-only; no mutation anywhere in this layer)
 *   trades    — the enriched trades (Layer 1 output)
 *   patterns  — the chosen patterns  (Layer 2 output)
 *   cycles    — the detected cycles  (Layer 3 output; currently unused
 *                                     by any sub-score — reserved for
 *                                     future scoring lifts)
 *
 * OUTPUT
 *   DQSResult with 7 sub-scores, weighted composite, letter grade,
 *   and biggestDrag attribution.
 */
export function computeDQS(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  cycles: ViciousCycle[]
): DQSResult {
  const riskManagement = scoreRiskManagement(trades, patterns, cycles)
  const emotionalControl = scoreEmotionalControl(trades, patterns, cycles)
  const positionSizing = scorePositionSizing(trades, patterns, cycles)
  const exitDiscipline = scoreExitDiscipline(trades, patterns, cycles)
  const entryQuality = scoreEntryQuality(trades, patterns, cycles)
  const exitTiming = scoreExitTiming(trades, patterns, cycles)
  const ruleFollowing = scoreRuleFollowing(trades, patterns, cycles)

  const all: DQSSubScore[] = [
    riskManagement,
    emotionalControl,
    positionSizing,
    exitDiscipline,
    entryQuality,
    exitTiming,
    ruleFollowing,
  ]

  const overall = computeComposite(all)
  const grade = gradeFor(overall)
  const biggestDrag = findBiggestDrag(all)

  return {
    overall,
    grade,
    subScores: {
      riskManagement,
      emotionalControl,
      positionSizing,
      exitDiscipline,
      entryQuality,
      exitTiming,
      ruleFollowing,
    },
    biggestDrag,
  }
}
