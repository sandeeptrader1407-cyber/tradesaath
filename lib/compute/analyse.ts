/**
 * Module 2, Step 8A — Top-level orchestrator.
 *
 * Wires every compute layer into a single `ComputeResult`:
 *
 *   Layer 1   enrichTrades        (derives fields on StandardTrade)
 *   Layer 2   detectPatterns      (mutates detectedTag/tagCost)
 *   Layer 3   detectViciousCycles (mutates cycleStageName/Number)
 *   Layer 4   computeDQS          (scoring)
 *   Layer 5   computeSessionMetrics
 *   Layer 6   computeSessionInsights  (code-generated narrative etc.)
 *   Layer 7   computeAllAggregates    (per-symbol, time slots, ...)
 *   Layer 8   aiCoaching          (injectable provider — optional)
 *
 * Nothing here calls Anthropic directly. Callers pass a
 * `coachingProvider` callback; production wiring lives in Step 8B.
 *
 * Error policy: AI coaching failures are non-fatal — we swallow the
 * error, push a warning, and return with aiCoaching=''.
 */

import type { StandardTrade } from '../intake/types'
import type {
  ComputeResult,
  UserBaseline,
  EnrichedTrade,
  SessionMetrics,
  DQSResult,
  ViciousCycle,
} from './types'
import { enrichTrades } from './enrichTrade'
import { detectPatterns } from './patterns'
import { detectViciousCycles } from './viciousCycle'
import { computeDQS } from './dqs'
import { computeSessionMetrics } from './sessionMetrics'
import { computeSessionInsights } from './insights'
import { computeAllAggregates } from './aggregates'

export interface CoachingContext {
  trades: EnrichedTrade[]
  metrics: SessionMetrics
  dqs: DQSResult
  cycles: ViciousCycle[]
  narrative: string
}

export type CoachingProvider = (ctx: CoachingContext) => Promise<string>

export interface AnalyseOptions {
  baseline?: UserBaseline
  coachingProvider?: CoachingProvider
  /** Default 10_000 ms. Coaching failure is non-fatal. */
  coachingTimeoutMs?: number
}

/**
 * Bump when the semantic output of analyseSession changes in a way
 * that would invalidate cached ComputeResults in the database.
 */
export const COMPUTE_VERSION = 1

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

export async function analyseSession(
  trades: StandardTrade[],
  options: AnalyseOptions = {}
): Promise<ComputeResult> {
  const startTime = Date.now()
  const warnings: string[] = []

  if (!trades || trades.length === 0) {
    return buildEmptyResult(warnings, startTime)
  }

  const core = runCoreLayers(trades, options.baseline)

  // Layer 8 — AI coaching (optional + injectable)
  let aiCoaching = ''
  if (options.coachingProvider) {
    try {
      const ctx: CoachingContext = {
        trades: core.enrichedTrades,
        metrics: core.sessionMetrics,
        dqs: core.dqs,
        cycles: core.viciousCycles,
        narrative: core.insights.narrative,
      }
      aiCoaching = await withTimeout(
        options.coachingProvider(ctx),
        options.coachingTimeoutMs ?? 10000
      )
      if (typeof aiCoaching !== 'string') aiCoaching = ''
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      warnings.push(`AI coaching failed: ${msg}`)
      aiCoaching = ''
    }
  }

  core.insights.aiCoaching = aiCoaching
  return assembleResult(core, warnings, startTime)
}

/**
 * Synchronous sibling. Identical output to `analyseSession` except
 * aiCoaching is always '' (no way to await inside a sync call).
 */
export function analyseSessionSync(
  trades: StandardTrade[],
  options: Omit<AnalyseOptions, 'coachingProvider' | 'coachingTimeoutMs'> = {}
): ComputeResult {
  const startTime = Date.now()
  const warnings: string[] = []

  if (!trades || trades.length === 0) {
    return buildEmptyResult(warnings, startTime)
  }

  const core = runCoreLayers(trades, options.baseline)
  core.insights.aiCoaching = ''
  return assembleResult(core, warnings, startTime)
}

// ────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────

interface CoreBundle {
  enrichedTrades: ReturnType<typeof enrichTrades>
  patterns: ReturnType<typeof detectPatterns>['patterns']
  patternSummary: ReturnType<typeof detectPatterns>['summary']
  viciousCycles: ReturnType<typeof detectViciousCycles>
  dqs: ReturnType<typeof computeDQS>
  sessionMetrics: ReturnType<typeof computeSessionMetrics>
  insights: ReturnType<typeof computeSessionInsights>
  aggregates: ReturnType<typeof computeAllAggregates>
}

function runCoreLayers(
  trades: StandardTrade[],
  baseline?: UserBaseline
): CoreBundle {
  const enrichedTrades = enrichTrades(trades, baseline)
  const { patterns, summary: patternSummary } = detectPatterns(
    enrichedTrades,
    baseline
  )
  const viciousCycles = detectViciousCycles(enrichedTrades)
  const dqs = computeDQS(enrichedTrades, patterns, viciousCycles)
  const sessionMetrics = computeSessionMetrics(enrichedTrades)
  const insights = computeSessionInsights(
    enrichedTrades,
    patterns,
    viciousCycles,
    sessionMetrics,
    dqs
  )
  const aggregates = computeAllAggregates(enrichedTrades)
  return {
    enrichedTrades,
    patterns,
    patternSummary,
    viciousCycles,
    dqs,
    sessionMetrics,
    insights,
    aggregates,
  }
}

function assembleResult(
  core: CoreBundle,
  warnings: string[],
  startTime: number
): ComputeResult {
  return {
    version: COMPUTE_VERSION,
    analysedAt: new Date().toISOString(),
    enrichedTrades: core.enrichedTrades,
    sessionMetrics: core.sessionMetrics,
    patterns: core.patterns,
    patternSummary: core.patternSummary,
    viciousCycles: core.viciousCycles,
    dqs: core.dqs,
    insights: core.insights,
    perSymbol: core.aggregates.perSymbol,
    timeSlots30min: core.aggregates.timeSlots30min,
    timeSlots60min: core.aggregates.timeSlots60min,
    dayOfWeek: core.aggregates.dayOfWeek,
    holdingDistribution: core.aggregates.holdingDistribution,
    bestWorstTrades: core.aggregates.bestWorstTrades,
    equityCurve: core.aggregates.equityCurve,
    warnings,
    processingTimeMs: Math.max(0, Date.now() - startTime),
  }
}

function buildEmptyResult(
  warnings: string[],
  startTime: number
): ComputeResult {
  const sessionMetrics = computeSessionMetrics([])
  const dqs: DQSResult = {
    overall: 0,
    grade: 'F',
    subScores: {
      riskManagement: emptySub('Risk management', 25),
      emotionalControl: emptySub('Emotional control', 20),
      positionSizing: emptySub('Position sizing', 15),
      exitDiscipline: emptySub('Exit discipline', 15),
      entryQuality: emptySub('Entry quality', 10),
      exitTiming: emptySub('Exit timing', 10),
      ruleFollowing: emptySub('Rule following', 5),
    },
    biggestDrag: {
      factorName: '',
      currentScore: 0,
      potentialImprovement: 0,
    },
  }
  const insights = computeSessionInsights([], [], [], sessionMetrics, dqs)
  const aggregates = computeAllAggregates([])

  return {
    version: COMPUTE_VERSION,
    analysedAt: new Date().toISOString(),
    enrichedTrades: [],
    sessionMetrics,
    patterns: [],
    patternSummary: {
      byTag: [],
      totalMistakeCost: 0,
      totalMistakeCount: 0,
      tagRate: 0,
      costCapped: false,
      validationIssues: [],
    },
    viciousCycles: [],
    dqs,
    insights,
    perSymbol: aggregates.perSymbol,
    timeSlots30min: aggregates.timeSlots30min,
    timeSlots60min: aggregates.timeSlots60min,
    dayOfWeek: aggregates.dayOfWeek,
    holdingDistribution: aggregates.holdingDistribution,
    bestWorstTrades: aggregates.bestWorstTrades,
    equityCurve: aggregates.equityCurve,
    warnings,
    processingTimeMs: Math.max(0, Date.now() - startTime),
  }
}

function emptySub(name: string, weight: number) {
  return {
    name,
    score: 0,
    weight,
    detail: '',
    suggestion: '',
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Coaching timed out after ${ms}ms`)),
      ms
    )
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}
