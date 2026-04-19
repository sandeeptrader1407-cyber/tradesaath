/**
 * Module 2 — public barrel.
 *
 * Single import surface for the rest of the app:
 *
 *   import { analyseSession, COMPUTE_VERSION } from '@/lib/compute'
 *
 * Re-exports the orchestrator, every layer's compute function, and
 * every public type. Nothing in this file has side effects.
 */

// ── Orchestrator (Step 8A) ──────────────────────────────────────────
export {
  analyseSession,
  analyseSessionSync,
  COMPUTE_VERSION,
} from './analyse'
export type {
  CoachingProvider,
  CoachingContext,
  AnalyseOptions,
} from './analyse'

// ── Types ───────────────────────────────────────────────────────────
export type * from './types'

// ── Layer 1 — Enrichment ────────────────────────────────────────────
export { enrichTrades } from './enrichTrade'

// ── Layer 2 — Pattern detection ─────────────────────────────────────
export { detectPatterns } from './patterns'

// ── Layer 3 — Vicious cycle detection ───────────────────────────────
export { detectViciousCycles } from './viciousCycle'

// ── Layer 4 — DQS scoring ───────────────────────────────────────────
export { computeDQS } from './dqs'

// ── Layer 5 — Session metrics ───────────────────────────────────────
export { computeSessionMetrics } from './sessionMetrics'

// ── Layer 6 — Session insights (narrative + per-trade + highlights) ─
export { computeSessionInsights } from './insights'

// ── Layer 7 — Aggregates (per-symbol, time slots, ...) ──────────────
export {
  computePerSymbolMetrics,
  computeTimeSlots30min,
  computeTimeSlots60min,
  computeDayOfWeekMetrics,
  computeHoldingDistribution,
  computeBestWorstTrades,
  computeEquityCurve,
  computeAllAggregates,
} from './aggregates'
