/**
 * Module 2, Layer 3 — Vicious Cycle Sequence Matcher.
 *
 * Step 1: assignStagesToTrades — pick ONE best stage per trade (or
 * none) by running every detector and picking the highest-scoring
 * match.
 *
 * Step 2: findCycles — scan the trades left-to-right, grow a running
 * candidate cycle as long as:
 *   - the next staged trade's stageNumber is STRICTLY GREATER than
 *     the current cycle's maximum stageNumber (ascending-only), AND
 *   - the trade-to-trade time gap between the new staged trade and
 *     the previous cycle member is ≤ 60 minutes.
 *
 * Otherwise the running candidate is closed. A closed candidate is
 * emitted as a cycle iff it contains ≥3 stages.
 *
 * A stage-1 (disciplined_win) match that appears AFTER a cycle has
 * advanced past stage 1 automatically closes the current cycle and
 * starts a new one (the ascending-only rule enforces this).
 */

import type { EnrichedTrade } from '../types'
import {
  runAllStageDetectors,
  type StageContext,
  type StageMatch,
} from './stageDetectors'
import { timeToMinutes } from '../patterns/signals'

// ────────────────────────────────────────────────────────────
// Exported: per-trade stage assignment
// ────────────────────────────────────────────────────────────

export interface TradeStageAssignment {
  tradeIndex: number
  stage: StageMatch | null // null if no stage matched
}

/**
 * For each trade, return the single best StageMatch (by score),
 * or null if no detector matched.
 */
export function assignStagesToTrades(
  trades: EnrichedTrade[]
): TradeStageAssignment[] {
  const n = trades.length

  // Pre-compute session averages once — stage detectors need these.
  const positiveSizes: number[] = []
  const holdings: number[] = []
  const winPnls: number[] = []
  const lossPnls: number[] = []
  for (const t of trades) {
    const q = Number(t.qty) || 0
    if (q > 0) positiveSizes.push(q)
    const d = Number(t.durationMinutes) || 0
    if (d > 0) holdings.push(d)
    const p = Number(t.pnl) || 0
    if (p > 0 && t.isWin) winPnls.push(p)
    if (p < 0 && t.isLoss) lossPnls.push(Math.abs(p))
  }
  const avg = (xs: number[]): number =>
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
  const sessionAvgSize = avg(positiveSizes)
  const sessionAvgHoldingMinutes = avg(holdings)
  const sessionAvgWinPnl = avg(winPnls)
  const sessionAvgLossPnl = avg(lossPnls)

  const out: TradeStageAssignment[] = []
  for (let i = 0; i < n; i++) {
    const trade = trades[i]
    const previous = i > 0 ? trades[i - 1] : null
    const previous3 = trades.slice(Math.max(0, i - 3), i)
    const allPreviousInSession = trades.slice(0, i)
    const ctx: StageContext = {
      previous,
      previous3,
      allPreviousInSession,
      sessionAvgSize,
      sessionAvgHoldingMinutes,
      sessionAvgWinPnl,
      sessionAvgLossPnl,
    }
    const matches = runAllStageDetectors(trade, ctx)
    if (matches.length === 0) {
      out.push({ tradeIndex: i, stage: null })
      continue
    }
    // Pick highest-scoring match; break ties by higher stageNumber
    // (later stages tend to be more specific/severe).
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.stageNumber - a.stageNumber
    })
    out.push({ tradeIndex: i, stage: matches[0] })
  }
  return out
}

// ────────────────────────────────────────────────────────────
// Exported: cycle finder
// ────────────────────────────────────────────────────────────

export interface RawCycle {
  tradeIndices: number[]
  stages: Array<{
    tradeIndex: number
    stage: StageMatch
  }>
}

/** Minutes between two trades (uses entryTime; 0 if either missing). */
function gapMinutes(a: EnrichedTrade, b: EnrichedTrade): number {
  const ma = timeToMinutes(a.entryTime)
  const mb = timeToMinutes(b.entryTime)
  if (ma === null || mb === null) return 0
  return Math.max(0, mb - ma)
}

/**
 * Walk the stage assignments left-to-right, grow sequential ascending
 * cycles, and emit any that reach ≥3 stages.
 */
export function findCycles(
  trades: EnrichedTrade[],
  assignments: TradeStageAssignment[]
): RawCycle[] {
  const cycles: RawCycle[] = []

  // Work only with trades that got assigned a stage.
  const staged = assignments.filter(
    (a): a is { tradeIndex: number; stage: StageMatch } => a.stage !== null
  )

  let current: RawCycle | null = null

  const closeAndEmit = () => {
    if (current && current.stages.length >= 3) {
      cycles.push(current)
    }
    current = null
  }

  for (const entry of staged) {
    const stageNum = entry.stage.stageNumber
    const trade = trades[entry.tradeIndex]

    if (!current) {
      current = {
        tradeIndices: [entry.tradeIndex],
        stages: [{ tradeIndex: entry.tradeIndex, stage: entry.stage }],
      }
      continue
    }

    const lastStaged = current.stages[current.stages.length - 1]
    const lastTrade = trades[lastStaged.tradeIndex]
    const gap = gapMinutes(lastTrade, trade)
    const lastStageNum = lastStaged.stage.stageNumber
    const maxStageNum = current.stages.reduce(
      (m, s) => Math.max(m, s.stage.stageNumber),
      0
    )

    // Ascending-only rule: new stageNumber must strictly exceed max-so-far
    const ascendingOk = stageNum > maxStageNum
    const gapOk = gap <= 60

    if (ascendingOk && gapOk) {
      current.stages.push({ tradeIndex: entry.tradeIndex, stage: entry.stage })
      current.tradeIndices.push(entry.tradeIndex)
      void lastStageNum
      continue
    }

    // Not a valid continuation — close current and (maybe) start a new one.
    closeAndEmit()
    current = {
      tradeIndices: [entry.tradeIndex],
      stages: [{ tradeIndex: entry.tradeIndex, stage: entry.stage }],
    }
  }

  closeAndEmit()
  return cycles
}
