/**
 * Module 2, Layer 7 — Insights orchestrator.
 *
 * Composes narrative + per-trade insights + key stats + behavioral
 * highlights into a single SessionInsights object. Pure code, no AI.
 *
 * aiCoaching is left as '' (empty string) — wiring real AI coaching
 * is Step 8.
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  SessionMetrics,
  DQSResult,
  SessionInsights,
} from '../types'
import { buildNarrative } from './narrative'
import { buildTradeInsights } from './tradeInsights'
import { buildKeyStats } from './keyStats'
import { buildBehavioralHighlights } from './highlights'

export { buildNarrative } from './narrative'
export { buildTradeInsights } from './tradeInsights'
export { buildKeyStats } from './keyStats'
export { buildBehavioralHighlights } from './highlights'

export function computeSessionInsights(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  cycles: ViciousCycle[],
  metrics: SessionMetrics,
  dqs: DQSResult
): SessionInsights {
  return {
    narrative: buildNarrative(trades, metrics, cycles, dqs),
    aiCoaching: '',
    tradeInsights: buildTradeInsights(trades, patterns),
    keyStats: buildKeyStats(trades, metrics),
    behavioralHighlights: buildBehavioralHighlights(
      patterns,
      cycles,
      metrics,
      dqs
    ),
  }
}
