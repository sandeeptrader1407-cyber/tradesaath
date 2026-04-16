/**
 * TradeSaath — Algorithmic pattern detector (v3.1)
 * -------------------------------------------------
 * Pure-code analysis. No AI. Takes a session's trades and computes:
 *   - Per-trade behavioural tags (ONE per trade, by strict priority)
 *   - Session-level pattern counts
 *   - Code-generated coaching points
 *   - Vicious-cycle sequences
 *   - Decision-Quality-Score factors
 *
 * TAG TAXONOMY:
 *   Mistake tags (in priority order): revenge > averaging > fomo > panic > overtrading > oversize > late_exit
 *   Non-mistake tags:                  disciplined, win
 *
 * COST MODEL (per-trade mistake attribution):
 *   For losing trades with a mistake tag:
 *     cost = max(0, abs(trade.pnl) - sessionAvgLoss)
 *   For all other trades (winners, neutral losses, disciplined):
 *     cost = 0
 *   This isolates the EXCESS loss caused by the mistake — not the full loss.
 *   Eliminates double-counting with totalPnl.
 *
 * Deterministic, instant, free.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TradeTag =
  | 'win'
  | 'disciplined'
  | 'revenge'
  | 'averaging'
  | 'fomo'
  | 'panic'
  | 'overtrading'
  | 'oversize'
  | 'late_exit'

export const MISTAKE_TAGS: ReadonlySet<TradeTag> = new Set<TradeTag>([
  'revenge', 'averaging', 'fomo', 'panic', 'overtrading', 'oversize', 'late_exit',
])

// Strict priority order — lower index = higher priority. Used when multiple patterns match.
const TAG_PRIORITY: TradeTag[] = [
  'revenge', 'averaging', 'fomo', 'panic', 'overtrading', 'oversize', 'late_exit', 'disciplined', 'win',
]

export type Severity = 'low' | 'medium' | 'high'

export interface DetectedTrade {
  index: number
  tag: TradeTag
  tagLabel: string
  reason: string
  severity: Severity
  pnl: number
  /** Attributed cost of this trade's mistake (0 for non-mistakes or non-excess losses). */
  cost: number
  note: string
}

export interface PatternCounts {
  revengeTrades: number
  fomoEntries: number
  panicExits: number
  averagingDown: number
  oversizedTrades: number
  lateExits: number
  overtradingTrades: number
  disciplinedTrades: number
  overtradingDetected: boolean
}

export interface CycleStage {
  stage: number
  tradeIndex: number
  description: string
}

export interface DQS {
  // 7 measurable factors (spec-defined weights)
  riskManagement: number    // 25%
  positionSizing: number    // 15%
  emotionalControl: number  // 20%
  exitDiscipline: number    // 15%
  entryQuality: number      // 10%
  exitTiming: number        // 10%
  ruleFollowing: number     // 5%
  overall: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface PatternResult {
  trades: DetectedTrade[]
  patterns: PatternCounts
  coachingPoints: string[]
  cycleDetected: boolean
  cycleStages: CycleStage[]
  dqs: DQS
  meta: {
    totalTrades: number
    netPnl: number
    winCount: number
    lossCount: number
    winRate: number
    sessionAvgLoss: number
    revengeCost: number
    fomoCost: number
    panicCost: number
    averagingCost: number
    oversizeCost: number
    lateExitCost: number
    overtradingCost: number
    mistakeTotalCost: number
    mistakeCount: number
  }
  validation: {
    ok: boolean
    warnings: string[]
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Helpers                                                            */
/* ────────────────────────────────────────────────────────────────── */

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function timeToMinutes(t: unknown): number | null {
  if (typeof t !== 'string') return null
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mn = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(mn)) return null
  return h * 60 + mn
}

function mean(xs: number[]): number {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length
  return Math.sqrt(v)
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

function fmtINR(n: number): string {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(Math.round(n))
  return `${sign}₹${a.toLocaleString('en-IN')}`
}

function labelFor(tag: TradeTag): string {
  switch (tag) {
    case 'revenge':     return 'Revenge Trade'
    case 'averaging':   return 'Averaging Down'
    case 'fomo':        return 'FOMO Entry'
    case 'panic':       return 'Panic Exit'
    case 'overtrading': return 'Overtrading'
    case 'oversize':    return 'Oversized Position'
    case 'late_exit':   return 'Late Exit'
    case 'disciplined': return 'Disciplined'
    case 'win':         return 'Win'
  }
}

function pickHigherPriority(a: TradeTag, b: TradeTag): TradeTag {
  return TAG_PRIORITY.indexOf(a) <= TAG_PRIORITY.indexOf(b) ? a : b
}

/** Grade thresholds per spec: A 80+, B 65-79, C 45-64, D 25-44, F <25 */
function gradeFor(score: number): DQS['grade'] {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 45) return 'C'
  if (score >= 25) return 'D'
  return 'F'
}

/* ────────────────────────────────────────────────────────────────── */
/* Main detector                                                       */
/* ────────────────────────────────────────────────────────────────── */

export interface DetectorOptions {
  userTypicalQty?: number
  userAvgDailyTrades?: number
  marketOpenMinutes?: number
}

interface Candidate {
  tag: TradeTag
  reason: string
  severity: Severity
}

export function detectPatterns(rawTrades: any[], opts: DetectorOptions = {}): PatternResult {
  const trades: any[] = Array.isArray(rawTrades) ? rawTrades : []
  const n = trades.length

  if (n === 0) return emptyResult()

  const marketOpen = opts.marketOpenMinutes ?? (9 * 60 + 15)
  const pnls = trades.map(t => toNum(t.pnl))
  const qtys = trades.map(t => toNum(t.qty ?? t.quantity))
  const mins = trades.map(t => timeToMinutes(t.time ?? t.entry_time))

  const sessionAvgQty = mean(qtys.filter(q => q > 0))
  const sessionQtyStd = stddev(qtys.filter(q => q > 0))
  const userTypicalQty = opts.userTypicalQty && opts.userTypicalQty > 0 ? opts.userTypicalQty : sessionAvgQty
  const avgDailyTrades = opts.userAvgDailyTrades && opts.userAvgDailyTrades > 0 ? opts.userAvgDailyTrades : n

  // Session-level loss baseline for cost attribution
  const losingAbs = pnls.filter(p => p < 0).map(p => Math.abs(p))
  const sessionAvgLoss = mean(losingAbs)

  // Holding-time baseline for late_exit
  const holdingTimes: number[] = []
  for (let i = 0; i < n; i++) {
    const gap = toNum(trades[i]?.time_gap_minutes, NaN)
    if (Number.isFinite(gap) && gap > 0) holdingTimes.push(gap)
    else if (i + 1 < n && mins[i] !== null && mins[i + 1] !== null) {
      const d = (mins[i + 1] as number) - (mins[i] as number)
      if (d > 0) holdingTimes.push(d)
    }
  }
  const avgHoldingTime = mean(holdingTimes)

  const lastLossBySymbol = new Map<string, { minutes: number | null; pnl: number; qty: number }>()
  const prevBuySamePrice = new Map<string, number>() // lastPrice per symbol for averaging streak

  // Pre-compute big-win cutoff for FOMO-chase detection
  const winsSorted = pnls.filter(p => p > 0).sort((a, b) => b - a)
  const bigWinCutoff = winsSorted.length
    ? winsSorted[Math.max(0, Math.floor(winsSorted.length * 0.25) - 1)]
    : Infinity

  // Overtrading detection — flag trades beyond the threshold
  const overtradingDetected = n > avgDailyTrades * 1.5
  const overtradingThreshold = Math.ceil(avgDailyTrades * 1.5)

  const detected: DetectedTrade[] = new Array(n)
  let prevWasBigWin = false
  let avgDownStreak: { symbol: string; lastPrice: number; startIndex: number; indices: number[] } | null = null
  // Collect indices that are part of an averaging-down run (2+ consecutive)
  const averagingIndices = new Set<number>()

  // First pass: gather candidates per trade
  const candidates: Candidate[][] = Array.from({ length: n }, () => [])

  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const symbol: string = String(t.symbol || 'UNKNOWN')
    const side: string = String(t.side || '').toUpperCase()
    const qty = qtys[i]
    const pnl = pnls[i]
    const m = mins[i]
    const price = toNum(t.entry ?? t.entry_price ?? t.price)

    // REVENGE
    const lastLoss = lastLossBySymbol.get(symbol)
    if (lastLoss && pnl <= 0) {
      const withinTime = m !== null && lastLoss.minutes !== null && (m - lastLoss.minutes) <= 5 && (m - lastLoss.minutes) >= 0
      const biggerSize = qty > lastLoss.qty * 1.25 && qty > 0
      if (withinTime || biggerSize) {
        candidates[i].push({
          tag: 'revenge',
          reason: withinTime
            ? `Re-entered ${symbol} within ${Math.max(0, (m as number) - (lastLoss.minutes as number))} min of a ${fmtINR(lastLoss.pnl)} loss`
            : `Increased size on ${symbol} after a ${fmtINR(lastLoss.pnl)} loss (${lastLoss.qty} → ${qty})`,
          severity: Math.abs(pnl) > 1000 ? 'high' : Math.abs(pnl) > 300 ? 'medium' : 'low',
        })
      }
    }

    // AVERAGING-DOWN (tracked across consecutive BUYs on same symbol at lower price)
    if (side === 'BUY' && price > 0) {
      if (avgDownStreak && avgDownStreak.symbol === symbol && price < avgDownStreak.lastPrice) {
        avgDownStreak.indices.push(i)
        avgDownStreak.lastPrice = price
        if (avgDownStreak.indices.length >= 2) {
          for (const idx of avgDownStreak.indices) averagingIndices.add(idx)
        }
      } else {
        avgDownStreak = { symbol, lastPrice: price, startIndex: i, indices: [i] }
      }
    } else {
      avgDownStreak = null
    }
    if (averagingIndices.has(i)) {
      candidates[i].push({
        tag: 'averaging',
        reason: `Consecutive buy on ${symbol} at a lower price — doubling down on a losing thesis`,
        severity: pnl < -500 ? 'high' : 'medium',
      })
    }

    // FOMO
    const earlyOpen = m !== null && m >= marketOpen && m <= marketOpen + 3
    const oversizeVsSession = sessionAvgQty > 0 && qty > sessionAvgQty * 2
    const chaseAfterWin = prevWasBigWin
    if (earlyOpen || oversizeVsSession || chaseAfterWin) {
      candidates[i].push({
        tag: 'fomo',
        reason: earlyOpen
          ? `Entered at ${t.time} — within the first 3 min of the open (emotion > plan)`
          : oversizeVsSession
            ? `Quantity ${qty} is ${(qty / Math.max(1, sessionAvgQty)).toFixed(1)}× your session average`
            : `Chased momentum right after a big win of ${fmtINR(pnls[i - 1] || 0)}`,
        severity: pnl < -500 ? 'high' : pnl < 0 ? 'medium' : 'low',
      })
    }

    // PANIC (short hold + loss)
    if (pnl < 0) {
      const nextGap = toNum(trades[i]?.time_gap_minutes, NaN)
      const nextMin = i + 1 < n ? mins[i + 1] : null
      const durApprox = Number.isFinite(nextGap) && nextGap > 0
        ? nextGap
        : (nextMin !== null && m !== null ? (nextMin as number) - (m as number) : NaN)
      if (Number.isFinite(durApprox) && durApprox < 2) {
        candidates[i].push({
          tag: 'panic',
          reason: `Exited within ~${Math.max(0, Math.round(durApprox))} min — no time for the thesis to play out`,
          severity: Math.abs(pnl) > 500 ? 'high' : 'medium',
        })
      }
    }

    // OVERTRADING (per-trade flag for the trades beyond the session threshold)
    if (overtradingDetected && i >= overtradingThreshold) {
      candidates[i].push({
        tag: 'overtrading',
        reason: `Trade #${i + 1} is beyond your usual daily volume of ${Math.round(avgDailyTrades)} — fatigue zone`,
        severity: pnl < 0 ? 'medium' : 'low',
      })
    }

    // OVERSIZE
    if (userTypicalQty > 0 && qty > userTypicalQty * 2) {
      candidates[i].push({
        tag: 'oversize',
        reason: `Qty ${qty} is ${(qty / userTypicalQty).toFixed(1)}× your typical ${Math.round(userTypicalQty)}`,
        severity: pnl < -1000 ? 'high' : pnl < 0 ? 'medium' : 'low',
      })
    }

    // LATE_EXIT — held > 2x avg holding time AND lost > 2x avg loss
    if (pnl < 0 && avgHoldingTime > 0 && sessionAvgLoss > 0) {
      const gap = toNum(trades[i]?.time_gap_minutes, NaN)
      const nextMin = i + 1 < n ? mins[i + 1] : null
      const holdApprox = Number.isFinite(gap) && gap > 0
        ? gap
        : (nextMin !== null && m !== null ? (nextMin as number) - (m as number) : NaN)
      if (Number.isFinite(holdApprox) && holdApprox > avgHoldingTime * 2 && Math.abs(pnl) > sessionAvgLoss * 2) {
        candidates[i].push({
          tag: 'late_exit',
          reason: `Held ${Math.round(holdApprox)} min (${(holdApprox / Math.max(1, avgHoldingTime)).toFixed(1)}× your average) and lost ${fmtINR(pnl)} — hope, not plan`,
          severity: Math.abs(pnl) > sessionAvgLoss * 3 ? 'high' : 'medium',
        })
      }
    }

    // DISCIPLINED (only when no mistake candidates)
    const goodEntryWindow = m !== null && m >= marketOpen + 5 && m <= marketOpen + 45
    const reasonableSize = qty > 0 && qty <= Math.max(1, sessionAvgQty * 1.2)
    if (goodEntryWindow && reasonableSize) {
      candidates[i].push({
        tag: 'disciplined',
        reason: `Entered in the high-probability window (${t.time}) with normal size — process > outcome`,
        severity: 'low',
      })
    }

    // Track for next iteration
    if (pnl < 0) lastLossBySymbol.set(symbol, { minutes: m, pnl, qty })
    prevWasBigWin = pnl > 0 && pnl >= bigWinCutoff && Number.isFinite(bigWinCutoff)
    prevBuySamePrice.set(symbol, price)
  }

  // Second pass: pick ONE tag per trade by priority, then compute cost
  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const pnl = pnls[i]
    let chosen: TradeTag = pnl >= 0 ? 'win' : 'win' // neutral bucket for uncategorised losses
    let chosenCand: Candidate | null = null
    for (const c of candidates[i]) {
      if (!chosenCand) { chosenCand = c; chosen = c.tag; continue }
      const winner = pickHigherPriority(c.tag, chosen)
      if (winner === c.tag) { chosenCand = c; chosen = c.tag }
    }

    // Per-trade cost attribution
    let cost = 0
    if (MISTAKE_TAGS.has(chosen) && pnl < 0) {
      cost = Math.max(0, Math.abs(pnl) - sessionAvgLoss)
    }

    const tagLabel = labelFor(chosen)
    const reason = chosenCand?.reason
      || (pnl >= 0 ? `Clean win of ${fmtINR(pnl)}` : `Loss of ${fmtINR(pnl)} — no behavioural flag`)
    const severity = chosenCand?.severity ?? 'low'

    detected[i] = {
      index: i,
      tag: chosen,
      tagLabel,
      reason,
      severity,
      pnl,
      cost,
      note: buildShortNote(t, chosen, reason, pnl),
    }
  }

  // Aggregate
  const count = (tag: TradeTag) => detected.filter(d => d.tag === tag).length
  const patterns: PatternCounts = {
    revengeTrades:      count('revenge'),
    fomoEntries:        count('fomo'),
    panicExits:         count('panic'),
    averagingDown:      count('averaging'),
    oversizedTrades:    count('oversize'),
    lateExits:          count('late_exit'),
    overtradingTrades:  count('overtrading'),
    disciplinedTrades:  count('disciplined'),
    overtradingDetected,
  }

  const costOf = (tag: TradeTag) => detected.filter(d => d.tag === tag).reduce((a, b) => a + b.cost, 0)
  const revengeCost     = costOf('revenge')
  const fomoCost        = costOf('fomo')
  const panicCost       = costOf('panic')
  const averagingCost   = costOf('averaging')
  const oversizeCost    = costOf('oversize')
  const lateExitCost    = costOf('late_exit')
  const overtradingCost = costOf('overtrading')
  const mistakeTotalCost = revengeCost + fomoCost + panicCost + averagingCost + oversizeCost + lateExitCost + overtradingCost
  const mistakeCount = detected.filter(d => MISTAKE_TAGS.has(d.tag)).length

  // Vicious cycle detection
  const cycleStages: CycleStage[] = []
  for (let i = 0; i + 2 < n; i++) {
    const a = detected[i], b = detected[i + 1], c = detected[i + 2]
    const escalatingLoss = a.pnl < 0 && b.pnl < a.pnl && c.pnl < b.pnl
    const escalatingSize = toNum(trades[i].qty) < toNum(trades[i + 1].qty) && toNum(trades[i + 1].qty) <= toNum(trades[i + 2].qty)
    const revengeInvolved = b.tag === 'revenge' || c.tag === 'revenge'
    if (escalatingLoss && (escalatingSize || revengeInvolved)) {
      cycleStages.push({ stage: 1, tradeIndex: i, description: `Initial loss of ${fmtINR(a.pnl)}` })
      cycleStages.push({ stage: 2, tradeIndex: i + 1, description: `Deeper loss ${fmtINR(b.pnl)} — tilt begins` })
      cycleStages.push({ stage: 3, tradeIndex: i + 2, description: `Escalation: loss widens to ${fmtINR(c.pnl)}` })
      break
    }
  }
  const cycleDetected = cycleStages.length > 0

  // DQS — 7 factors with explicit measurable formulas
  const winCount  = pnls.filter(p => p > 0).length
  const lossCount = pnls.filter(p => p < 0).length
  const winRate   = n > 0 ? (winCount / n) * 100 : 0
  const netPnl    = pnls.reduce((a, b) => a + b, 0)

  // Risk Management (25%): 100 - penalty for (maxSingleLoss / sessionAvgLoss) and for losses > 3% of gross-win pool
  const maxLoss = losingAbs.length ? Math.max(...losingAbs) : 0
  const riskRatio = sessionAvgLoss > 0 ? maxLoss / sessionAvgLoss : 1
  const riskManagement = clamp(100 - Math.max(0, (riskRatio - 1.5)) * 30)

  // Position Sizing (15%): low CV good; penalise oversize incidence
  const cv = sessionAvgQty > 0 ? sessionQtyStd / sessionAvgQty : 0
  const oversizePenalty = (patterns.oversizedTrades / n) * 40
  const positionSizing = clamp(100 - cv * 80 - oversizePenalty)

  // Emotional Control (20%): share of trades with NO tilt tag (revenge/fomo/panic/averaging)
  const tiltCount = patterns.revengeTrades + patterns.fomoEntries + patterns.panicExits + patterns.averagingDown
  const emotionalControl = clamp(((n - tiltCount) / n) * 100)

  // Exit Discipline (15%): share of exits that are neither panic nor late_exit nor averaging
  const badExits = patterns.panicExits + patterns.lateExits + patterns.averagingDown
  const exitDiscipline = clamp(((n - badExits) / n) * 100)

  // Entry Quality (10%): share of entries in high-probability window
  const goodEntries = mins.reduce<number>((acc, m) => acc + ((m !== null && m >= marketOpen + 5 && m <= marketOpen + 45) ? 1 : 0), 0)
  const entryQuality = clamp((goodEntries / n) * 100)

  // Exit Timing (10%): share of non-panic, non-late exits
  const cleanExits = n - patterns.panicExits - patterns.lateExits
  const exitTiming = clamp((cleanExits / n) * 100)

  // Rule Following (5%): penalise overtrading and trades-after-3-consecutive-losses
  let ruleFollowing = 100
  if (overtradingDetected) ruleFollowing -= 25
  let consec = 0, afterThresh = 0, hit = false
  for (let i = 0; i < n; i++) {
    if (pnls[i] < 0) consec++; else consec = 0
    if (consec >= 3) hit = true
    else if (hit) afterThresh++
  }
  if (hit && afterThresh > 0) ruleFollowing -= Math.min(40, afterThresh * 5)
  ruleFollowing = clamp(ruleFollowing)

  const overall = clamp(
    riskManagement    * 0.25 +
    positionSizing    * 0.15 +
    emotionalControl  * 0.20 +
    exitDiscipline    * 0.15 +
    entryQuality      * 0.10 +
    exitTiming        * 0.10 +
    ruleFollowing     * 0.05,
  )

  const dqs: DQS = {
    riskManagement:   Math.round(riskManagement),
    positionSizing:   Math.round(positionSizing),
    emotionalControl: Math.round(emotionalControl),
    exitDiscipline:   Math.round(exitDiscipline),
    entryQuality:     Math.round(entryQuality),
    exitTiming:       Math.round(exitTiming),
    ruleFollowing:    Math.round(ruleFollowing),
    overall:          Math.round(overall),
    grade:            gradeFor(overall),
  }

  // Coaching points
  const coachingPoints: string[] = []
  if (patterns.revengeTrades > 0) coachingPoints.push(`${patterns.revengeTrades} revenge trade${patterns.revengeTrades > 1 ? 's' : ''} cost you ${fmtINR(revengeCost)} in excess losses — walk away for 15 min after any loss > ₹500.`)
  if (overtradingDetected) coachingPoints.push(`You took ${n} trades today — ${Math.round((n / Math.max(1, avgDailyTrades) - 1) * 100)}% above your norm. Cap daily trades to ${Math.round(avgDailyTrades * 1.2)}.`)
  if (patterns.panicExits > 2) coachingPoints.push(`${patterns.panicExits} panic exits bled ${fmtINR(panicCost)} in excess. Hold every trade at least 2 min unless structure invalidates.`)
  if (patterns.averagingDown > 0) coachingPoints.push(`Averaging-down cost ${fmtINR(averagingCost)} beyond baseline losses. Add ONLY when the original thesis strengthens.`)
  if (patterns.oversizedTrades > 0 && oversizeCost > 0) coachingPoints.push(`Oversized positions cost ${fmtINR(oversizeCost)} in excess. Size doesn't fix a bad setup.`)
  if (patterns.lateExits > 0) coachingPoints.push(`${patterns.lateExits} late exit${patterns.lateExits > 1 ? 's' : ''} (${fmtINR(lateExitCost)} excess) — held losers too long. Honour your invalidation level.`)
  if (patterns.disciplinedTrades >= n * 0.4) coachingPoints.push(`${patterns.disciplinedTrades} disciplined trades — that's your edge. Protect the process.`)
  if (cycleDetected) coachingPoints.push(`A tilt-cycle was detected around trade ${cycleStages[0].tradeIndex + 1}. Next time you see 2 consecutive losses, close the terminal for 10 min.`)
  if (coachingPoints.length === 0) coachingPoints.push(`Clean session. Net ${fmtINR(netPnl)} across ${n} trades with no major behavioural flags — bank the discipline, not just the P&L.`)

  // Validation
  const warnings: string[] = []
  const grossLossAbs = losingAbs.reduce((a, b) => a + b, 0)
  if (mistakeTotalCost > grossLossAbs + 0.01) warnings.push(`mistakeTotalCost (${mistakeTotalCost}) exceeds gross losses (${grossLossAbs})`)
  const tagCounts = detected.reduce<Record<string, number>>((acc, d) => { acc[d.tag] = (acc[d.tag] || 0) + 1; return acc }, {})
  for (const d of detected) if ((tagCounts[d.tag] || 0) > n) warnings.push(`duplicate tag overflow: ${d.tag}`)
  const mistakeShare = mistakeCount / n
  if (mistakeShare > 0.5) warnings.push(`${Math.round(mistakeShare * 100)}% of trades tagged as mistakes — detector may be over-sensitive`)
  const validation = { ok: warnings.length === 0, warnings }

  return {
    trades: detected,
    patterns,
    coachingPoints,
    cycleDetected,
    cycleStages,
    dqs,
    meta: {
      totalTrades: n,
      netPnl,
      winCount,
      lossCount,
      winRate,
      sessionAvgLoss,
      revengeCost,
      fomoCost,
      panicCost,
      averagingCost,
      oversizeCost,
      lateExitCost,
      overtradingCost,
      mistakeTotalCost,
      mistakeCount,
    },
    validation,
  }
}

/* ────────────────────────────────────────────────────────────────── */

function buildShortNote(trade: any, tag: TradeTag, reason: string, pnl: number): string {
  const sym = String(trade.symbol || '')
  const money = fmtINR(pnl)
  switch (tag) {
    case 'revenge':     return `Revenge re-entry on ${sym}. ${money}. ${reason}`
    case 'averaging':   return `Averaged down on ${sym}. ${money}. ${reason}`
    case 'fomo':        return `FOMO entry on ${sym}. ${money}. ${reason}`
    case 'panic':       return `Panic exit on ${sym}. ${money}. ${reason}`
    case 'overtrading': return `Overtrading on ${sym}. ${money}. ${reason}`
    case 'oversize':    return `Oversized on ${sym}. ${money}. ${reason}`
    case 'late_exit':   return `Late exit on ${sym}. ${money}. ${reason}`
    case 'disciplined': return `Disciplined trade on ${sym}. ${money}. ${reason}`
    case 'win':         return pnl >= 0 ? `Clean win on ${sym}. ${money}.` : `Loss on ${sym}. ${money}. No behavioural flag.`
  }
}

function emptyResult(): PatternResult {
  return {
    trades: [],
    patterns: {
      revengeTrades: 0, fomoEntries: 0, panicExits: 0, averagingDown: 0,
      oversizedTrades: 0, lateExits: 0, overtradingTrades: 0,
      disciplinedTrades: 0, overtradingDetected: false,
    },
    coachingPoints: [],
    cycleDetected: false,
    cycleStages: [],
    dqs: {
      riskManagement: 0, positionSizing: 0, emotionalControl: 0, exitDiscipline: 0,
      entryQuality: 0, exitTiming: 0, ruleFollowing: 0, overall: 0, grade: 'F',
    },
    meta: {
      totalTrades: 0, netPnl: 0, winCount: 0, lossCount: 0, winRate: 0,
      sessionAvgLoss: 0,
      revengeCost: 0, fomoCost: 0, panicCost: 0, averagingCost: 0, oversizeCost: 0,
      lateExitCost: 0, overtradingCost: 0,
      mistakeTotalCost: 0, mistakeCount: 0,
    },
    validation: { ok: true, warnings: [] },
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Legacy-format bridge                                                */
/* ────────────────────────────────────────────────────────────────── */
/**
 * Map our internal tags back to the short codes stored in the trade_analysis table.
 * NOTE: the legacy schema has no 'loss' bucket; uncategorised losers map to 'win'
 * (sentinel for "no pattern"), and the dashboard filters `tag !== 'win'` to exclude them.
 */
export function toLegacyTag(tag: TradeTag, inCycle: boolean): { tag: string; label: string } {
  if (inCycle) return { tag: 'vs', label: 'Vicious Cycle' }
  switch (tag) {
    case 'revenge':     return { tag: 'rvg',  label: 'Revenge Trade' }
    case 'averaging':   return { tag: 'avg',  label: 'Averaging Down' }
    case 'fomo':        return { tag: 'fomo', label: 'FOMO Entry' }
    case 'panic':       return { tag: 'pnc',  label: 'Panic Exit' }
    case 'overtrading': return { tag: 'over', label: 'Overtrading' }
    case 'oversize':    return { tag: 'size', label: 'Oversized Position' }
    case 'late_exit':   return { tag: 'late', label: 'Late Exit' }
    case 'disciplined': return { tag: 'win',  label: 'Disciplined Trade' }
    case 'win':         return { tag: 'win',  label: 'Win' }
  }
}

export function toLegacyCycleStage(tag: TradeTag): string {
  switch (tag) {
    case 'win':         return 'win'
    case 'disciplined': return 'win'
    case 'revenge':     return 'rvg'
    case 'fomo':        return 'fomo'
    case 'panic':       return 'pnc'
    case 'averaging':   return 'avg'
    case 'oversize':    return 'size'
    case 'late_exit':   return 'late'
    case 'overtrading': return 'over'
  }
}
