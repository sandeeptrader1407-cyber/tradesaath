/**
 * Module 2, Layer 3 — Vicious Cycle orchestrator.
 *
 *   1. Assign best stage per trade (stageDetectors + best-score).
 *   2. Mutate EnrichedTrade.cycleStageName / cycleStageNumber so the
 *      UI can render "Stage 4 — Market Reversal" on any trade.
 *   3. Find sequential ascending cycles (≥3 stages, 60-min gap max).
 *   4. Build ViciousCycle records with severity + description.
 *
 * The signature feature of TradeSaath: "you went from a disciplined
 * win to panic to revenge in 90 minutes — here's the shape of your
 * cycle."
 */

import type { EnrichedTrade, ViciousCycle } from '../types'
import {
  assignStagesToTrades,
  findCycles,
  type TradeStageAssignment,
} from './sequenceMatcher'
import { buildViciousCycle } from './severity'

export type { StageContext, StageMatch } from './stageDetectors'
export {
  runAllStageDetectors,
  STAGE_DETECTORS,
  detectDisciplinedWin,
  detectOverconfidence,
  detectOversizedPosition,
  detectMarketReversal,
  detectHopeAndHold,
  detectAveragingDown,
  detectPanicExit,
  detectRevengeTrade,
  detectTilt,
  detectFomoReentry,
} from './stageDetectors'
export {
  assignStagesToTrades,
  findCycles,
  type TradeStageAssignment,
  type RawCycle,
} from './sequenceMatcher'
export {
  computeSeverity,
  computeCycleCost,
  buildCycleDescription,
  buildViciousCycle,
  stageLabel,
} from './severity'

/**
 * Main entrypoint. MUTATES each EnrichedTrade's cycleStageName /
 * cycleStageNumber fields.  Returns the list of detected cycles.
 */
export function detectViciousCycles(
  trades: EnrichedTrade[]
): ViciousCycle[] {
  const n = trades.length

  // Zero out in case of re-runs on the same array
  for (const t of trades) {
    t.cycleStageName = null
    t.cycleStageNumber = null
  }

  if (n === 0) return []

  // 1. Stage assignment (one best stage per trade).
  const assignments: TradeStageAssignment[] = assignStagesToTrades(trades)

  // 2. Writeback onto enriched trades.
  for (const a of assignments) {
    if (!a.stage) continue
    const t = trades[a.tradeIndex]
    if (!t) continue
    t.cycleStageName = a.stage.stageName
    t.cycleStageNumber = a.stage.stageNumber
  }

  // 3. Find sequential cycles.
  const rawCycles = findCycles(trades, assignments)

  // 4. Build final records.
  return rawCycles.map((c) => buildViciousCycle(c, trades))
}
