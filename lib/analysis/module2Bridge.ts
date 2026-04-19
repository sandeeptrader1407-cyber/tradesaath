/**
 * Module 2 → Legacy bridge.
 *
 * Translates a Module 2 `ComputeResult` into the legacy
 * `AnalysisJSON` shape that the dashboard + Supabase `analysis`
 * JSONB column currently consume. This is the seam that makes the
 * new pipeline a drop-in swap — zero changes to Module 3 (display).
 *
 * Strategy: build a synthetic `PatternResult` from the ComputeResult
 * and run it through the EXISTING `buildAnalysisJSON()` so the
 * output shape stays bit-identical to the legacy path.
 *
 * AI coaching: Module 2's `insights.aiCoaching` (produced by the
 * injected provider) overrides the `ai_coaching` field of the
 * resulting AnalysisJSON.
 *
 * Nothing in this file calls patternDetector — we bypass it entirely
 * and hand the summarizer a PatternResult we built ourselves.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StandardTrade } from '../intake/types'
import type {
  ComputeResult,
  EnrichedTrade,
  UserBaseline,
  PatternTag,
} from '../compute/types'
import { analyseSession } from '../compute/analyse'
import { createHaikuCoachingProvider } from '../compute/coachingProvider'
import type {
  DetectedTrade,
  PatternCounts,
  CycleStage,
  DQS as LegacyDQS,
  PatternResult,
  TradeTag,
} from './patternDetector'
import { buildAnalysisJSON, type AnalysisJSON } from './sessionSummarizer'

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

export interface RunModule2Options {
  baseline?: UserBaseline
  /** Default 10_000 ms. Coaching failure is non-fatal. */
  coachingTimeoutMs?: number
  /**
   * Override the coaching provider (mainly for tests). If omitted,
   * the Haiku provider is used.
   */
  coachingProvider?: Parameters<typeof analyseSession>[1] extends
    | { coachingProvider?: infer P }
    | undefined
    ? P
    : never
  /**
   * Session row as stored in Supabase (for session_summary context).
   * At minimum needs `trade_date` and `trades` — the legacy summarizer
   * reads them for the narrative.
   */
  session?: Record<string, any>
}

/**
 * Run Module 2 analysis end-to-end and return a legacy-shaped
 * `AnalysisJSON` suitable for direct swap-in to the existing save
 * path.
 */
export async function runModule2Analysis(
  trades: StandardTrade[],
  options: RunModule2Options = {}
): Promise<AnalysisJSON> {
  const coachingProvider =
    options.coachingProvider ?? createHaikuCoachingProvider()

  const result: ComputeResult = await analyseSession(trades, {
    baseline: options.baseline,
    coachingProvider,
    coachingTimeoutMs: options.coachingTimeoutMs ?? 10000,
  })

  return translateToLegacyShape(result, options.session ?? { trades })
}

/**
 * Pure translator — exported for the shadow-mode diff logger and for
 * unit tests. Does not call any AI or database.
 */
export function translateToLegacyShape(
  result: ComputeResult,
  session: Record<string, any> = {}
): AnalysisJSON {
  const synthetic = buildSyntheticPatternResult(result)

  const legacySessionRow = {
    ...session,
    // Prefer the enriched trade list we already have — it preserves
    // order, pnl, and all fields the summarizer touches.
    trades: result.enrichedTrades,
  }

  const analysis = buildAnalysisJSON(
    legacySessionRow,
    synthetic,
    result.insights.aiCoaching || undefined
  )

  return analysis
}

// ────────────────────────────────────────────────────────────────────
// Internals — ComputeResult → synthetic PatternResult
// ────────────────────────────────────────────────────────────────────

function buildSyntheticPatternResult(r: ComputeResult): PatternResult {
  const detectedTrades = r.enrichedTrades.map(toDetectedTrade)
  const counts = countsByTag(r.enrichedTrades)

  const cycleStages: CycleStage[] = []
  for (const cyc of r.viciousCycles) {
    for (const s of cyc.stages) {
      cycleStages.push({
        stage: s.stageNumber,
        tradeIndex: s.tradeIndex,
        description: s.description,
      })
    }
  }

  const legacyDqs: LegacyDQS = {
    riskManagement: r.dqs.subScores.riskManagement.score,
    positionSizing: r.dqs.subScores.positionSizing.score,
    emotionalControl: r.dqs.subScores.emotionalControl.score,
    exitDiscipline: r.dqs.subScores.exitDiscipline.score,
    entryQuality: r.dqs.subScores.entryQuality.score,
    exitTiming: r.dqs.subScores.exitTiming.score,
    ruleFollowing: r.dqs.subScores.ruleFollowing.score,
    overall: r.dqs.overall,
    grade: r.dqs.grade,
  }

  const byTagCost = costByTag(r.patternSummary.byTag)

  const sessionAvgLoss = computeSessionAvgLoss(r.enrichedTrades)

  const meta: PatternResult['meta'] = {
    totalTrades: r.sessionMetrics.totalTrades,
    netPnl: r.sessionMetrics.totalPnl,
    winCount: r.sessionMetrics.winCount,
    lossCount: r.sessionMetrics.lossCount,
    // Legacy winRate is 0..100; Module 2 winRate is 0..1
    winRate: r.sessionMetrics.winRate * 100,
    sessionAvgLoss,
    revengeCost: byTagCost.revenge,
    fomoCost: byTagCost.fomo,
    panicCost: byTagCost.panic,
    averagingCost: byTagCost.averaging,
    oversizeCost: byTagCost.oversize,
    lateExitCost: byTagCost.late_exit,
    overtradingCost: byTagCost.overtrading,
    mistakeTotalCost: r.patternSummary.totalMistakeCost,
    mistakeCount: r.patternSummary.totalMistakeCount,
  }

  return {
    trades: detectedTrades,
    patterns: counts,
    coachingPoints: deriveCoachingPoints(r),
    cycleDetected: r.viciousCycles.length > 0,
    cycleStages,
    dqs: legacyDqs,
    meta,
    validation: {
      ok: r.patternSummary.validationIssues.length === 0,
      warnings: [
        ...r.patternSummary.validationIssues,
        ...r.warnings,
      ],
    },
  }
}

function toDetectedTrade(t: EnrichedTrade): DetectedTrade {
  // If the pattern detector didn't tag the trade, default to 'win'
  // (the legacy "no behavioural flag" bucket — covers both clean
  //  wins and controlled losses).
  const tag: TradeTag = (t.detectedTag ?? 'win') as TradeTag
  return {
    index: t.tradeIndex,
    tag,
    tagLabel: labelFor(tag),
    reason: '',
    severity: severityFromConfidence(t.tagConfidence),
    confidence: (t.tagConfidence ?? 'low') as DetectedTrade['confidence'],
    score: 0,
    pnl: t.pnl ?? 0,
    cost: t.tagCost ?? 0,
    note: '',
  }
}

function labelFor(tag: TradeTag): string {
  switch (tag) {
    case 'revenge':
      return 'Revenge Trade'
    case 'averaging':
      return 'Averaging Down'
    case 'fomo':
      return 'FOMO Entry'
    case 'panic':
      return 'Panic Exit'
    case 'overtrading':
      return 'Overtrading'
    case 'oversize':
      return 'Oversized Position'
    case 'late_exit':
      return 'Late Exit'
    case 'disciplined':
      return 'Disciplined'
    case 'win':
    default:
      return 'Win'
  }
}

function severityFromConfidence(
  c: EnrichedTrade['tagConfidence']
): DetectedTrade['severity'] {
  if (c === 'high') return 'high'
  if (c === 'medium') return 'medium'
  return 'low'
}

function countsByTag(trades: EnrichedTrade[]): PatternCounts {
  const c: PatternCounts = {
    revengeTrades: 0,
    fomoEntries: 0,
    panicExits: 0,
    averagingDown: 0,
    oversizedTrades: 0,
    lateExits: 0,
    overtradingTrades: 0,
    disciplinedTrades: 0,
    overtradingDetected: false,
  }
  for (const t of trades) {
    switch (t.detectedTag) {
      case 'revenge':
        c.revengeTrades++
        break
      case 'fomo':
        c.fomoEntries++
        break
      case 'panic':
        c.panicExits++
        break
      case 'averaging':
        c.averagingDown++
        break
      case 'oversize':
        c.oversizedTrades++
        break
      case 'late_exit':
        c.lateExits++
        break
      case 'overtrading':
        c.overtradingTrades++
        break
      case 'disciplined':
        c.disciplinedTrades++
        break
      default:
        break
    }
  }
  c.overtradingDetected = c.overtradingTrades > 0
  return c
}

function costByTag(
  byTag: ComputeResult['patternSummary']['byTag']
): Record<PatternTag, number> {
  const map: Record<PatternTag, number> = {
    revenge: 0,
    averaging: 0,
    fomo: 0,
    panic: 0,
    overtrading: 0,
    oversize: 0,
    late_exit: 0,
    disciplined: 0,
    win: 0,
  }
  for (const row of byTag) {
    map[row.tag] = row.totalCost
  }
  return map
}

function computeSessionAvgLoss(trades: EnrichedTrade[]): number {
  let sum = 0
  let n = 0
  for (const t of trades) {
    const pnl = t.pnl ?? 0
    if (pnl < 0) {
      sum += Math.abs(pnl)
      n++
    }
  }
  return n === 0 ? 0 : sum / n
}

/**
 * Module 2 has no 1:1 equivalent of `coachingPoints` — we derive a
 * short list from the behavioralHighlights + narrative so the legacy
 * consumer (`AnalysisJSON.coaching_points`) has something useful.
 */
function deriveCoachingPoints(r: ComputeResult): string[] {
  const pts: string[] = []
  for (const h of r.insights.behavioralHighlights) {
    if (h.description) pts.push(h.description)
    if (pts.length >= 3) break
  }
  if (pts.length === 0 && r.insights.narrative) {
    // Fallback: first couple of narrative sentences
    const sents = r.insights.narrative
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
    pts.push(...sents)
  }
  return pts
}

// ────────────────────────────────────────────────────────────────────
// Shadow-mode diff logger (exported for sessionAnalyser.ts)
// ────────────────────────────────────────────────────────────────────

export interface ShadowDiffSummary {
  pnl_old: number
  pnl_new: number
  pnl_match: boolean
  dqs_old: number
  dqs_new: number
  patterns_old: number
  patterns_new: number
  cycles_old: number
  cycles_new: number
}

export function buildShadowDiff(
  oldAnalysis: AnalysisJSON | null,
  newAnalysis: AnalysisJSON | null
): ShadowDiffSummary {
  const pnlOld = Number(oldAnalysis?.financial_impact?.potential_pnl_without_mistakes) || 0
  const pnlNew = Number(newAnalysis?.financial_impact?.potential_pnl_without_mistakes) || 0
  return {
    pnl_old: pnlOld,
    pnl_new: pnlNew,
    pnl_match: pnlOld === pnlNew,
    dqs_old: oldAnalysis?.dqs?.score ?? 0,
    dqs_new: newAnalysis?.dqs?.score ?? 0,
    patterns_old: oldAnalysis?.mistake_patterns?.length ?? 0,
    patterns_new: newAnalysis?.mistake_patterns?.length ?? 0,
    cycles_old: oldAnalysis?.vicious_cycle?.length ?? 0,
    cycles_new: newAnalysis?.vicious_cycle?.length ?? 0,
  }
}

export function logShadowDiff(diff: ShadowDiffSummary): void {
  // Single-line, easy to grep in Vercel logs.
  console.log('[MODULE_2_SHADOW]', JSON.stringify(diff))
}
