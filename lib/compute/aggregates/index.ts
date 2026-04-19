/**
 * Module 2, Layer 6 — Aggregate Metrics barrel + orchestrator.
 *
 * Pure rollups over EnrichedTrade[]. No detection, no scoring, no AI.
 *
 * Sort policies (chosen here, can be overridden by the UI):
 *   perSymbol:            tradeCount DESC (then symbol ASC)
 *   timeSlots30/60:       startHour ASC, startMinute ASC
 *   dayOfWeek:            natural order 0..6 (Sun..Sat)
 *   holdingDistribution:  duration order (scalp..positional)
 *   bestWorstTrades:      wins pnl DESC, losses pnl ASC
 *   equityCurve:          tradeIndex ASC
 */

import type {
  EnrichedTrade,
  PerSymbolMetrics,
  TimeSlotMetrics,
  DayOfWeekMetrics,
  HoldingTimeDistribution,
  BestWorstTrades,
  EquityCurvePoint,
} from '../types'
import { computePerSymbolMetrics } from './perSymbol'
import { computeTimeSlots30min, computeTimeSlots60min } from './timeSlots'
import { computeDayOfWeekMetrics } from './dayOfWeek'
import { computeHoldingDistribution } from './holdingDistribution'
import { computeBestWorstTrades } from './bestWorstTrades'
import { computeEquityCurve } from './equityCurve'

export { computePerSymbolMetrics } from './perSymbol'
export { computeTimeSlots30min, computeTimeSlots60min } from './timeSlots'
export { computeDayOfWeekMetrics } from './dayOfWeek'
export { computeHoldingDistribution } from './holdingDistribution'
export { computeBestWorstTrades } from './bestWorstTrades'
export { computeEquityCurve } from './equityCurve'

export interface AggregateBundle {
  perSymbol: PerSymbolMetrics[]
  timeSlots30min: TimeSlotMetrics[]
  timeSlots60min: TimeSlotMetrics[]
  dayOfWeek: DayOfWeekMetrics[]
  holdingDistribution: HoldingTimeDistribution[]
  bestWorstTrades: BestWorstTrades
  equityCurve: EquityCurvePoint[]
}

/**
 * Convenience — compute every aggregate at once. Order mirrors the
 * SessionMetrics/aggregates shape in lib/compute/types.ts.
 */
export function computeAllAggregates(
  trades: EnrichedTrade[]
): AggregateBundle {
  return {
    perSymbol: computePerSymbolMetrics(trades),
    timeSlots30min: computeTimeSlots30min(trades),
    timeSlots60min: computeTimeSlots60min(trades),
    dayOfWeek: computeDayOfWeekMetrics(trades),
    holdingDistribution: computeHoldingDistribution(trades),
    bestWorstTrades: computeBestWorstTrades(trades),
    equityCurve: computeEquityCurve(trades),
  }
}
