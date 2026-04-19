/**
 * Module 2, Layer 7 — Session Metrics rollup.
 *
 * Pure cross-layer summary. Takes EnrichedTrade[] and computes a
 * deterministic SessionMetrics object. No detection, no scoring, no AI.
 *
 * Spec resolutions (documented where non-obvious):
 *
 *   peakCapitalAtOneTime
 *     = max(capitalDeployed) across all trades. This is "largest single
 *       position" — NOT "peak concurrent capital across overlapping
 *       positions", which would require a sweep-line over open/close
 *       timestamps. Left as a future refinement.
 *
 *   morningPnl / middayPnl / afternoonPnl
 *     Split in tradeIndex order:
 *       morning  = [0,              floor(n*0.25))
 *       midday   = [floor(n*0.25),  ceil(n*0.75))
 *       afternoon= [ceil(n*0.75),   n)
 *     Single-trade session → morning=trade.pnl, midday=afternoon=0.
 *
 *   turningPointIndex
 *     Index of the trade where drawdownFromPeak jumped the most vs the
 *     previous trade. Returns null if the session never drew down
 *     (monotonic up / flat) or if all jumps are effectively zero.
 *
 *   tradingStyle
 *     - scalper : >60% of trades are 'scalp' OR 'quick'
 *     - swing   : >=30% are 'extended' OR 'positional'
 *     - intraday: otherwise (default)
 *     - mixed   : scalper+swing thresholds both hit (rare but possible)
 *
 *   profitFactor
 *     grossProfit / abs(grossLoss). If grossLoss===0 and grossProfit>0
 *     → capped at 999 (treat as "infinite edge, practical cap"). 0 if
 *     both sides zero.
 *
 *   hasRealTimeData
 *     True if at least one trade has BOTH a non-empty entryTime and
 *     non-empty exitTime. Otherwise false (time data is inferred /
 *     missing → downstream UI should hide time-of-day panels).
 */

import type { EnrichedTrade, SessionMetrics } from './types'

function zeroMetrics(): SessionMetrics {
  return {
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    breakevenCount: 0,
    winRate: 0,

    totalPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,

    totalCapitalDeployed: 0,
    peakCapitalAtOneTime: 0,
    avgCapitalPerTrade: 0,

    avgHoldingMinutes: 0,
    medianHoldingMinutes: 0,

    avgWin: 0,
    avgLoss: 0,
    riskRewardRatio: 0,
    expectancy: 0,

    bestTradePnl: 0,
    bestTradeIndex: -1,
    worstTradePnl: 0,
    worstTradeIndex: -1,

    morningPnl: 0,
    middayPnl: 0,
    afternoonPnl: 0,

    turningPointIndex: null,
    hasRealTimeData: false,
    tradingStyle: 'intraday',
  }
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function classifyStyle(
  trades: EnrichedTrade[]
): SessionMetrics['tradingStyle'] {
  if (trades.length === 0) return 'intraday'
  let scalpLike = 0
  let swingLike = 0
  for (const t of trades) {
    if (t.holdingCategory === 'scalp' || t.holdingCategory === 'quick') {
      scalpLike += 1
    } else if (
      t.holdingCategory === 'extended' ||
      t.holdingCategory === 'positional'
    ) {
      swingLike += 1
    }
  }
  const n = trades.length
  const scalperHit = scalpLike / n > 0.6
  const swingHit = swingLike / n >= 0.3
  if (scalperHit && swingHit) return 'mixed'
  if (scalperHit) return 'scalper'
  if (swingHit) return 'swing'
  return 'intraday'
}

function detectTurningPoint(trades: EnrichedTrade[]): number | null {
  if (trades.length < 2) return null
  // Sort by tradeIndex so "previous" is well-defined even if caller
  // passed trades out-of-order.
  const sorted = [...trades].sort(
    (a, b) => (Number(a.tradeIndex) || 0) - (Number(b.tradeIndex) || 0)
  )
  let bestJump = 0
  let bestIdx: number | null = null
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].drawdownFromPeak) || 0
    const curr = Number(sorted[i].drawdownFromPeak) || 0
    const jump = curr - prev
    if (jump > bestJump) {
      bestJump = jump
      bestIdx = Number(sorted[i].tradeIndex) || i
    }
  }
  // Require the jump to be non-trivial — otherwise "no turning point".
  if (bestJump <= 0) return null
  return bestIdx
}

export function computeSessionMetrics(
  trades: EnrichedTrade[]
): SessionMetrics {
  if (trades.length === 0) return zeroMetrics()

  const n = trades.length
  let winCount = 0
  let lossCount = 0
  let breakevenCount = 0
  let totalPnl = 0
  let grossProfit = 0
  let grossLoss = 0
  let totalCapitalDeployed = 0
  let peakCapitalAtOneTime = 0
  let totalHolding = 0
  let bestTradePnl = -Infinity
  let bestTradeIndex = -1
  let worstTradePnl = Infinity
  let worstTradeIndex = -1
  let hasRealTimeData = false
  const durations: number[] = []

  for (const t of trades) {
    const pnl = Number(t.pnl) || 0
    const cap = Number(t.capitalDeployed) || 0
    const dur = Number(t.durationMinutes) || 0
    totalPnl += pnl
    if (t.isWin) {
      winCount += 1
      if (pnl > 0) grossProfit += pnl
    } else if (t.isLoss) {
      lossCount += 1
      if (pnl < 0) grossLoss += pnl
    } else if (t.isBreakeven) {
      breakevenCount += 1
    }
    totalCapitalDeployed += cap
    if (cap > peakCapitalAtOneTime) peakCapitalAtOneTime = cap
    totalHolding += dur
    durations.push(dur)
    const idx = Number(t.tradeIndex) || 0
    if (pnl > bestTradePnl) {
      bestTradePnl = pnl
      bestTradeIndex = idx
    }
    if (pnl < worstTradePnl) {
      worstTradePnl = pnl
      worstTradeIndex = idx
    }
    const et = String(
      (t as unknown as { entryTime?: string }).entryTime ?? ''
    ).trim()
    const xt = String(
      (t as unknown as { exitTime?: string }).exitTime ?? ''
    ).trim()
    if (et && xt) hasRealTimeData = true
  }

  const decided = winCount + lossCount
  const winRate = decided > 0 ? winCount / decided : 0

  let profitFactor = 0
  const absLoss = Math.abs(grossLoss)
  if (absLoss > 0) {
    profitFactor = grossProfit / absLoss
  } else if (grossProfit > 0) {
    profitFactor = 999 // "infinite" edge, capped for practical display
  }

  const avgWin = winCount > 0 ? grossProfit / winCount : 0
  const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0 // negative
  const riskRewardRatio =
    lossCount > 0 && Math.abs(avgLoss) > 0
      ? Math.abs(avgWin) / Math.abs(avgLoss)
      : 0
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss

  // Time bucketing by tradeIndex
  const sorted = [...trades].sort(
    (a, b) => (Number(a.tradeIndex) || 0) - (Number(b.tradeIndex) || 0)
  )
  const morningEnd = Math.floor(n * 0.25)
  const afternoonStart = Math.ceil(n * 0.75)
  let morningPnl = 0
  let middayPnl = 0
  let afternoonPnl = 0
  for (let i = 0; i < sorted.length; i++) {
    const pnl = Number(sorted[i].pnl) || 0
    if (i < morningEnd) morningPnl += pnl
    else if (i < afternoonStart) middayPnl += pnl
    else afternoonPnl += pnl
  }
  // Single-trade convention: morning holds it, midday+afternoon=0.
  if (n === 1) {
    morningPnl = Number(sorted[0].pnl) || 0
    middayPnl = 0
    afternoonPnl = 0
  }

  return {
    totalTrades: n,
    winCount,
    lossCount,
    breakevenCount,
    winRate,

    totalPnl,
    grossProfit,
    grossLoss,
    profitFactor,

    totalCapitalDeployed,
    peakCapitalAtOneTime,
    avgCapitalPerTrade: totalCapitalDeployed / n,

    avgHoldingMinutes: totalHolding / n,
    medianHoldingMinutes: median(durations),

    avgWin,
    avgLoss,
    riskRewardRatio,
    expectancy,

    bestTradePnl: bestTradePnl === -Infinity ? 0 : bestTradePnl,
    bestTradeIndex,
    worstTradePnl: worstTradePnl === Infinity ? 0 : worstTradePnl,
    worstTradeIndex,

    morningPnl,
    middayPnl,
    afternoonPnl,

    turningPointIndex: detectTurningPoint(trades),
    hasRealTimeData,
    tradingStyle: classifyStyle(trades),
  }
}
