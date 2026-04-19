/**
 * Module 2, Layer 2 — Pattern detection orchestrator.
 *
 * Mirrors legacy lib/analysis/patternDetector.ts behavior exactly:
 *   1. Pre-compute SessionStats (single pass over enriched trades).
 *   2. For each trade, run ALL 9 candidate detectors.
 *   3. Resolve to ONE tag per trade using TAG_PRIORITY (strict order).
 *      Losers with no mistake/disciplined candidate fall back to 'win'
 *      (sentinel — matches legacy behavior).
 *   4. Apply per-trade cost attribution (via costAttribution.ts):
 *        baseCost = max(0, |pnl| - sessionAvgLoss) × confidenceMultiplier
 *      with 85% gross-loss cap (proportional scale-down).
 *   5. Apply 20% tag-rate cap: keep highest-scored mistake trades,
 *      convert excess to 'win' (matches legacy).
 *   6. Mutate EnrichedTrade.detectedTag / tagConfidence / tagCost.
 *   7. Build PatternSummary with byTag rollups + validation issues.
 */

import type {
  DetectedPattern,
  EnrichedTrade,
  PatternSummary,
  PatternTag,
  UserBaseline,
} from '../types'
import {
  computeSessionStats,
  labelFor,
  MISTAKE_TAGS,
  pickHigherPriority,
  TAG_PRIORITY,
  type DetectionContext,
} from './signals'
import { attributeCosts } from './costAttribution'
import { detectRevenge } from './revenge'
import { detectAveraging } from './averaging'
import { detectFomo } from './fomo'
import { detectPanic } from './panic'
import { detectOvertrading } from './overtrading'
import { detectOversize } from './oversize'
import { detectLateExit } from './lateExit'
import { detectDisciplined } from './disciplined'

export * from './signals'
export { detectRevenge } from './revenge'
export { detectAveraging } from './averaging'
export { detectFomo } from './fomo'
export { detectPanic } from './panic'
export { detectOvertrading } from './overtrading'
export { detectOversize } from './oversize'
export { detectLateExit } from './lateExit'
export { detectDisciplined } from './disciplined'
export { attributeCosts } from './costAttribution'

export interface DetectPatternsResult {
  patterns: DetectedPattern[]
  summary: PatternSummary
}

/**
 * Run all pattern detectors over an enriched session. Returns the
 * chosen patterns + a summary. Also MUTATES each enriched trade's
 * detectedTag / tagConfidence / tagCost fields.
 */
export function detectPatterns(
  trades: EnrichedTrade[],
  baseline?: UserBaseline
): DetectPatternsResult {
  const n = trades.length
  const session = computeSessionStats(trades, baseline)

  // Zero-out pattern fields on inputs so this is deterministic across reruns.
  for (const t of trades) {
    t.detectedTag = null
    t.tagConfidence = null
    t.tagCost = 0
  }

  // ── Pass 1: collect all candidate patterns per trade ──
  const candidatesByTrade: DetectedPattern[][] = Array.from(
    { length: n },
    () => []
  )
  for (let i = 0; i < n; i++) {
    const ctx: DetectionContext = {
      trade: trades[i],
      index: i,
      previous: i > 0 ? trades[i - 1] : null,
      recentTrades: trades.slice(Math.max(0, i - 5), i),
      allTrades: trades,
      session,
      baseline,
    }
    const results = [
      detectRevenge(ctx),
      detectAveraging(ctx),
      detectFomo(ctx),
      detectPanic(ctx),
      detectOvertrading(ctx),
      detectOversize(ctx),
      detectLateExit(ctx),
      detectDisciplined(ctx),
    ].filter((p): p is DetectedPattern => p !== null)
    candidatesByTrade[i] = results
  }

  // ── Pass 2: resolve ONE tag per trade via TAG_PRIORITY ──
  const chosenPatterns: DetectedPattern[] = []
  for (let i = 0; i < n; i++) {
    const cands = candidatesByTrade[i]
    if (cands.length === 0) continue
    let winner: DetectedPattern = cands[0]
    for (let k = 1; k < cands.length; k++) {
      const pick = pickHigherPriority(cands[k].tag, winner.tag)
      if (pick === cands[k].tag) winner = cands[k]
    }
    chosenPatterns.push(winner)
  }

  // ── Pass 3: cost attribution + 85% gross-loss cap ──
  const { patterns: costedPatterns, wasCapped } = attributeCosts(
    chosenPatterns,
    trades
  )

  // ── Pass 4: 20% tag-rate cap ──
  const maxMistakeTrades = Math.max(1, Math.ceil(n * 0.2))
  const mistakePatterns = costedPatterns
    .filter((p) => MISTAKE_TAGS.has(p.tag))
    .sort((a, b) => b.score - a.score)

  const untagSet = new Set<number>()
  if (mistakePatterns.length > maxMistakeTrades) {
    for (const p of mistakePatterns.slice(maxMistakeTrades)) {
      untagSet.add(p.tradeIndex)
    }
  }

  // ── Pass 5: write back to enriched trades, drop untagged from output ──
  const finalPatterns: DetectedPattern[] = []
  for (const p of costedPatterns) {
    if (untagSet.has(p.tradeIndex)) continue // dropped by tag-rate cap
    const t = trades[p.tradeIndex]
    if (!t) continue
    t.detectedTag = p.tag
    t.tagConfidence = p.confidence
    t.tagCost = p.cost
    finalPatterns.push(p)
  }

  // ── Summary aggregation ──
  const countByTag = new Map<PatternTag, number>()
  const costByTag = new Map<PatternTag, number>()
  for (const tag of TAG_PRIORITY) {
    countByTag.set(tag, 0)
    costByTag.set(tag, 0)
  }
  for (const p of finalPatterns) {
    countByTag.set(p.tag, (countByTag.get(p.tag) || 0) + 1)
    costByTag.set(p.tag, (costByTag.get(p.tag) || 0) + p.cost)
  }

  const byTag = TAG_PRIORITY.map((tag) => {
    const count = countByTag.get(tag) || 0
    const totalCost = costByTag.get(tag) || 0
    return {
      tag,
      label: labelFor(tag),
      count,
      totalCost,
      avgCost: count > 0 ? totalCost / count : 0,
    }
  })

  const totalMistakeCount = finalPatterns.filter((p) =>
    MISTAKE_TAGS.has(p.tag)
  ).length
  const totalMistakeCost = finalPatterns
    .filter((p) => MISTAKE_TAGS.has(p.tag))
    .reduce((a, p) => a + p.cost, 0)

  const tagRate = n > 0 ? totalMistakeCount / n : 0

  // ── Validation issues (advisory — doesn't block output) ──
  const validationIssues: string[] = []
  if (tagRate > 0.25) {
    validationIssues.push(
      `High mistake tag rate (${(tagRate * 100).toFixed(1)}%) — review detector thresholds`
    )
  }
  if (wasCapped) {
    validationIssues.push(
      '85% gross-loss cost cap applied — raw attributed cost exceeded gross loss'
    )
  }
  if (n === 0) {
    validationIssues.push('No trades in session')
  }

  const summary: PatternSummary = {
    byTag,
    totalMistakeCost,
    totalMistakeCount,
    tagRate,
    costCapped: wasCapped,
    validationIssues,
  }

  return { patterns: finalPatterns, summary }
}
