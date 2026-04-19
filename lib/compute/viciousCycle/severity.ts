/**
 * Module 2, Layer 3 — Cycle severity scoring + description builder.
 *
 * Severity thresholds:
 *   mild     — 3-4 stages AND costAsPctCapital < 2%
 *   moderate — 5-7 stages OR costAsPctCapital 2-5%
 *   severe   — 8-10 stages OR costAsPctCapital > 5%
 *              OR includes (oversized_position + panic_exit + revenge_trade)
 *
 * Cost: sum of tagCost over all trades in the cycle (already attributed
 * by the pattern layer). For cycles whose trades are not tagged as
 * mistakes (e.g. a clean disciplined_win→overconfidence→market_reversal),
 * cost may be 0; the stage count then determines severity.
 */

import type {
  EnrichedTrade,
  SignalResult,
  ViciousCycle,
  ViciousCycleStage,
  ViciousCycleStageName,
} from '../types'
import type { RawCycle } from './sequenceMatcher'
import { timeToMinutes } from '../patterns/signals'

const STAGE_LABELS: Record<ViciousCycleStageName, string> = {
  disciplined_win: 'Disciplined Win',
  overconfidence: 'Overconfidence',
  oversized_position: 'Oversized',
  market_reversal: 'Market Reversal',
  hope_and_hold: 'Hope & Hold',
  averaging_down: 'Averaging Down',
  panic_exit: 'Panic Exit',
  revenge_trade: 'Revenge Trade',
  tilt: 'Tilt',
  fomo_reentry: 'FOMO Re-entry',
}

export function stageLabel(name: ViciousCycleStageName): string {
  return STAGE_LABELS[name]
}

/**
 * Cycle cost = Σ tagCost over trades in the cycle (pattern-layer
 * attribution). Also returns capital estimate for pct-of-capital math.
 */
export function computeCycleCost(
  cycle: RawCycle,
  trades: EnrichedTrade[]
): { totalCost: number; capitalAtCycleStart: number; costAsPctCapital: number } {
  let totalCost = 0
  for (const idx of cycle.tradeIndices) {
    const t = trades[idx]
    if (!t) continue
    totalCost += Number(t.tagCost) || 0
  }

  // Capital proxy = capitalDeployed on the first trade in the cycle,
  // or peak capital if present, or sum of |pnl| over session.
  const first = trades[cycle.tradeIndices[0]]
  let capital = 0
  if (first) {
    capital = Number(first.capitalDeployed) || 0
    // If capitalAsPercentOfPeak is meaningful we can back into peak
    const pct = Number(first.capitalAsPercentOfPeak) || 0
    if (pct > 0 && capital > 0) {
      capital = (capital / pct) * 100
    }
  }
  // Fallback: largest capitalDeployed seen
  if (capital <= 0) {
    capital = trades.reduce(
      (m, t) => Math.max(m, Number(t.capitalDeployed) || 0),
      0
    )
  }
  const costAsPctCapital = capital > 0 ? (totalCost / capital) * 100 : 0
  return { totalCost, capitalAtCycleStart: capital, costAsPctCapital }
}

/**
 * Severity rules (see header comment).
 */
export function computeSeverity(
  cycle: RawCycle,
  trades: EnrichedTrade[]
): { severity: 'mild' | 'moderate' | 'severe'; totalCost: number; costPct: number } {
  const { totalCost, costAsPctCapital } = computeCycleCost(cycle, trades)
  const stageCount = cycle.stages.length
  const stageNames = new Set(cycle.stages.map((s) => s.stage.stageName))

  const hasDangerousTrio =
    stageNames.has('oversized_position') &&
    stageNames.has('panic_exit') &&
    stageNames.has('revenge_trade')

  if (
    stageCount >= 8 ||
    costAsPctCapital > 5 ||
    hasDangerousTrio
  ) {
    return { severity: 'severe', totalCost, costPct: costAsPctCapital }
  }
  if (stageCount >= 5 || costAsPctCapital >= 2) {
    return { severity: 'moderate', totalCost, costPct: costAsPctCapital }
  }
  return { severity: 'mild', totalCost, costPct: costAsPctCapital }
}

/**
 * Human-readable description e.g.
 *   "Overconfidence → Oversized → Panic Exit"
 */
export function buildCycleDescription(cycle: RawCycle): string {
  return cycle.stages.map((s) => stageLabel(s.stage.stageName)).join(' → ')
}

/**
 * Convert a RawCycle + trade data into the final ViciousCycle shape.
 */
export function buildViciousCycle(
  cycle: RawCycle,
  trades: EnrichedTrade[]
): ViciousCycle {
  const first = trades[cycle.tradeIndices[0]]
  const last = trades[cycle.tradeIndices[cycle.tradeIndices.length - 1]]

  const startMin = timeToMinutes(first?.entryTime)
  const endMin = timeToMinutes(last?.entryTime)
  const duration =
    startMin !== null && endMin !== null ? Math.max(0, endMin - startMin) : 0

  const stages: ViciousCycleStage[] = cycle.stages.map((s) => ({
    tradeIndex: s.tradeIndex,
    stageName: s.stage.stageName,
    stageNumber: s.stage.stageNumber,
    description: s.stage.description,
    signals: s.stage.signals as SignalResult[],
  }))

  const { severity, totalCost } = computeSeverity(cycle, trades)

  return {
    startIndex: cycle.tradeIndices[0],
    endIndex: cycle.tradeIndices[cycle.tradeIndices.length - 1],
    tradeIndices: [...cycle.tradeIndices],
    stages,
    totalCost,
    durationMinutes: duration,
    description: buildCycleDescription(cycle),
    severity,
  }
}
