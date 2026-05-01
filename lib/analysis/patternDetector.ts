/**
 * TradeSaath — Algorithmic pattern detector (v4.0)
 * -------------------------------------------------
 * Multi-signal weighted scoring with cost/tag-rate capping.
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
 *     cost = max(0, abs(trade.pnl) - sessionAvgLoss) * confidenceMultiplier
 *     where confidenceMultiplier: high=1.0, medium=0.7
 *   For all other trades (winners, neutral losses, disciplined):
 *     cost = 0
 *   This isolates the EXCESS loss caused by the mistake — not the full loss.
 *   Eliminates double-counting with totalPnl.
 *
 * CAPPING RULES:
 *   1. Total mistake cost ≤ 85% of gross loss
 *   2. Tag rate ≤ 20% of trades (keep highest-scored, untag rest)
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

export type Confidence = 'high' | 'medium' | 'low'

export interface DetectedTrade {
  index: number
  tag: TradeTag
  tagLabel: string
  reason: string
  severity: Severity
  confidence: Confidence
  /** Composite score from multi-signal detection (0-1). 0 for non-mistake tags. */
  score: number
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

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/** Map confidence label to cost multiplier */
function confidenceMultiplier(c: Confidence): number {
  return c === 'high' ? 1.0 : c === 'medium' ? 0.7 : 0.4
}

/** Derive confidence from score */
function scoreToConfidence(s: number): Confidence {
  if (s >= 0.75) return 'high'
  if (s >= 0.55) return 'medium'
  return 'low'
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
  score: number       // composite weighted score (0-1)
  confidence: Confidence
}

export function detectPatterns(rawTrades: any[], opts: DetectorOptions = {}): PatternResult {
  const trades: any[] = Array.isArray(rawTrades) ? rawTrades : []
  const n = trades.length

  if (n === 0) return emptyResult()

  // Compute session start from actual trade data instead of hardcoding market open
  const validMins = trades.map(t => timeToMinutes(t.time ?? t.entry_time)).filter((m): m is number => m !== null)
  const sessionStartMinutes = validMins.length > 0 ? Math.min(...validMins) : (9 * 60 + 15)
  // opts.marketOpenMinutes available for future per-market override
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

  // Running loss average — updated trade-by-trade so revenge S4 uses only past losses
  let runningLossSum = 0
  let runningLossCount = 0

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

  // Pre-compute baselines for multi-signal scoring
  const winAmounts = pnls.filter(p => p > 0)
  const _avgWin = mean(winAmounts)
  const _medianLoss = median(losingAbs)
  const winsSorted = [...winAmounts].sort((a, b) => b - a)
  const bigWinCutoff = winsSorted.length
    ? winsSorted[Math.max(0, Math.floor(winsSorted.length * 0.25) - 1)]
    : Infinity

  // Overtrading detection — flag trades beyond the threshold
  const overtradingDetected = n > avgDailyTrades * 1.5
  const overtradingThreshold = Math.ceil(avgDailyTrades * 1.5)

  const detected: DetectedTrade[] = new Array(n)
  let prevWasBigWin = false
  let consecutiveLosses = 0          // running count of consecutive losses
  let sessionLossesSoFar = 0         // cumulative losses up to current trade
  let avgDownStreak: { symbol: string; lastPrice: number; startIndex: number; indices: number[] } | null = null
  const averagingIndices = new Set<number>()

  // First pass: gather candidates per trade with multi-signal scoring
  const candidates: Candidate[][] = Array.from({ length: n }, () => [])

  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const symbol: string = String(t.symbol || 'UNKNOWN')
    const side: string = String(t.side || '').toUpperCase()
    const qty = qtys[i]
    const pnl = pnls[i]
    const m = mins[i]
    const price = toNum(t.entry ?? t.entry_price ?? t.price)

    /* ── REVENGE — 5 signals, threshold 0.55 ── */
    const lastLoss = lastLossBySymbol.get(symbol)
    if (lastLoss && pnl <= 0) {
      let revengeScore = 0
      const timeSinceLoss = (m !== null && lastLoss.minutes !== null) ? (m - lastLoss.minutes) : Infinity
      // S1: Re-entry within 5 min of same-symbol loss (w=0.30)
      if (timeSinceLoss >= 0 && timeSinceLoss <= 5) revengeScore += 0.30
      // S2: Increased size vs the losing trade (w=0.25)
      if (qty > lastLoss.qty * 1.15 && qty > 0) revengeScore += 0.25
      // S3: Currently on a losing streak ≥2 (w=0.20)
      if (consecutiveLosses >= 2) revengeScore += 0.20
      // S4: Loss on this trade exceeds running avg loss (w=0.15) — uses only losses seen so far
      const runningAvgLoss = runningLossCount > 0 ? runningLossSum / runningLossCount : 0
      if (Math.abs(pnl) > runningAvgLoss * 1.2 && runningAvgLoss > 0) revengeScore += 0.15
      // S5: Same symbol re-entry (already implied by lastLoss check) (w=0.10)
      revengeScore += 0.10

      if (revengeScore >= 0.55) {
        const conf = scoreToConfidence(revengeScore)
        candidates[i].push({
          tag: 'revenge',
          reason: timeSinceLoss <= 5
            ? `Re-entered ${symbol} within ${Math.max(0, Math.round(timeSinceLoss))} min of a ${fmtINR(lastLoss.pnl)} loss (score: ${revengeScore.toFixed(2)})`
            : `Increased size on ${symbol} after a ${fmtINR(lastLoss.pnl)} loss — ${consecutiveLosses} consecutive losses (score: ${revengeScore.toFixed(2)})`,
          severity: revengeScore >= 0.75 ? 'high' : revengeScore >= 0.55 ? 'medium' : 'low',
          score: revengeScore,
          confidence: conf,
        })
      }
    }

    /* ── AVERAGING-DOWN — streak detection + scoring, threshold 0.60 ── */
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
      let avgScore = 0.40  // base: in a confirmed averaging streak
      // S1: Streak length ≥ 3 (w=0.20)
      if (avgDownStreak && avgDownStreak.indices.length >= 3) avgScore += 0.20
      // S2: Trade is a loser (w=0.20)
      if (pnl < 0) avgScore += 0.20
      // S3: Position larger than session avg (w=0.20)
      if (sessionAvgQty > 0 && qty > sessionAvgQty * 1.3) avgScore += 0.20

      if (avgScore >= 0.60) {
        candidates[i].push({
          tag: 'averaging',
          reason: `Consecutive buy on ${symbol} at a lower price — doubling down on a losing thesis (score: ${avgScore.toFixed(2)})`,
          severity: avgScore >= 0.75 ? 'high' : 'medium',
          score: avgScore,
          confidence: scoreToConfidence(avgScore),
        })
      }
    }

    /* ── FOMO — 5 signals, threshold 0.55 ── */
    {
      let fomoScore = 0
      // S1: Entry in first 3 min of session (w=0.25)
      if (m !== null && m >= sessionStartMinutes && m <= sessionStartMinutes + 3) fomoScore += 0.25
      // S2: Oversized vs session average (w=0.25)
      if (sessionAvgQty > 0 && qty > sessionAvgQty * 1.8) fomoScore += 0.25
      // S3: Chasing after a big win (w=0.20)
      if (prevWasBigWin) fomoScore += 0.20
      // S4: Loss on this trade (w=0.15)
      if (pnl < 0) fomoScore += 0.15
      // S5: Bigger loss than session average (w=0.15)
      if (pnl < 0 && sessionAvgLoss > 0 && Math.abs(pnl) > sessionAvgLoss * 1.5) fomoScore += 0.15

      if (fomoScore >= 0.55) {
        const earlyOpen = m !== null && m >= sessionStartMinutes && m <= sessionStartMinutes + 3
        const conf = scoreToConfidence(fomoScore)
        candidates[i].push({
          tag: 'fomo',
          reason: earlyOpen
            ? `Entered at ${t.time} — within the first 3 min of the session (score: ${fomoScore.toFixed(2)})`
            : prevWasBigWin
              ? `Chased momentum right after a big win of ${fmtINR(pnls[i - 1] || 0)} (score: ${fomoScore.toFixed(2)})`
              : `Quantity ${qty} is ${(qty / Math.max(1, sessionAvgQty)).toFixed(1)}× your session average (score: ${fomoScore.toFixed(2)})`,
          severity: fomoScore >= 0.75 ? 'high' : fomoScore >= 0.55 ? 'medium' : 'low',
          score: fomoScore,
          confidence: conf,
        })
      }
    }

    /* ── PANIC — 5 signals, threshold 0.55 ── */
    if (pnl < 0) {
      const nextGap = toNum(trades[i]?.time_gap_minutes, NaN)
      const nextMin = i + 1 < n ? mins[i + 1] : null
      const durApprox = Number.isFinite(nextGap) && nextGap > 0
        ? nextGap
        : (nextMin !== null && m !== null ? (nextMin as number) - (m as number) : NaN)

      if (Number.isFinite(durApprox)) {
        let panicScore = 0
        // S1: Held < 2 min (w=0.30)
        if (durApprox < 2) panicScore += 0.30
        // S2: Held < 1 min (extra w=0.10)
        if (durApprox < 1) panicScore += 0.10
        // S3: On a losing streak ≥ 2 (w=0.20)
        if (consecutiveLosses >= 2) panicScore += 0.20
        // S4: Loss is smaller than session avg (premature exit before stop hit) (w=0.20)
        if (sessionAvgLoss > 0 && Math.abs(pnl) < sessionAvgLoss * 0.6) panicScore += 0.20
        // S5: Session has been net negative so far (emotional state) (w=0.20)
        if (sessionLossesSoFar < 0) panicScore += 0.20

        if (panicScore >= 0.55) {
          candidates[i].push({
            tag: 'panic',
            reason: `Exited within ~${Math.max(0, Math.round(durApprox))} min — no time for the thesis to play out (score: ${panicScore.toFixed(2)})`,
            severity: panicScore >= 0.75 ? 'high' : 'medium',
            score: panicScore,
            confidence: scoreToConfidence(panicScore),
          })
        }
      }
    }

    /* ── OVERTRADING — 4 signals, threshold 0.50 ── */
    if (overtradingDetected && i >= overtradingThreshold) {
      let otScore = 0
      // S1: Beyond 1.5x daily norm (w=0.30)
      otScore += 0.30
      // S2: Beyond 2x daily norm (w=0.20)
      if (i >= Math.ceil(avgDailyTrades * 2)) otScore += 0.20
      // S3: Trade is a loser (w=0.25)
      if (pnl < 0) otScore += 0.25
      // S4: Declining P&L in the overtrade zone (w=0.25)
      if (i >= 2 && pnls[i - 1] < 0 && pnls[i - 2] < 0) otScore += 0.25

      if (otScore >= 0.50) {
        candidates[i].push({
          tag: 'overtrading',
          reason: `Trade #${i + 1} is beyond your usual daily volume of ${Math.round(avgDailyTrades)} — fatigue zone (score: ${otScore.toFixed(2)})`,
          severity: otScore >= 0.75 ? 'high' : otScore >= 0.55 ? 'medium' : 'low',
          score: otScore,
          confidence: scoreToConfidence(otScore),
        })
      }
    }

    /* ── OVERSIZE — 3 signals, threshold 0.55 ── */
    if (userTypicalQty > 0 && qty > userTypicalQty * 1.5) {
      let osScore = 0
      const sizeMultiple = qty / userTypicalQty
      // S1: Size > 2x typical (w=0.40)
      if (sizeMultiple > 2) osScore += 0.40
      else if (sizeMultiple > 1.5) osScore += 0.20  // partial credit
      // S2: Trade is a loser (w=0.30)
      if (pnl < 0) osScore += 0.30
      // S3: Loss exceeds session avg loss (w=0.30)
      if (pnl < 0 && sessionAvgLoss > 0 && Math.abs(pnl) > sessionAvgLoss * 1.5) osScore += 0.30

      if (osScore >= 0.55) {
        candidates[i].push({
          tag: 'oversize',
          reason: `Qty ${qty} is ${sizeMultiple.toFixed(1)}× your typical ${Math.round(userTypicalQty)} (score: ${osScore.toFixed(2)})`,
          severity: osScore >= 0.75 ? 'high' : osScore >= 0.55 ? 'medium' : 'low',
          score: osScore,
          confidence: scoreToConfidence(osScore),
        })
      }
    }

    /* ── LATE_EXIT — 3 signals, threshold 0.60 ── */
    if (pnl < 0 && avgHoldingTime > 0 && sessionAvgLoss > 0) {
      const gap = toNum(trades[i]?.time_gap_minutes, NaN)
      const nextMin = i + 1 < n ? mins[i + 1] : null
      const holdApprox = Number.isFinite(gap) && gap > 0
        ? gap
        : (nextMin !== null && m !== null ? (nextMin as number) - (m as number) : NaN)

      if (Number.isFinite(holdApprox) && holdApprox > avgHoldingTime * 1.5) {
        let leScore = 0
        const holdMultiple = holdApprox / Math.max(1, avgHoldingTime)
        // S1: Held > 2x avg holding time (w=0.35)
        if (holdMultiple > 2) leScore += 0.35
        else if (holdMultiple > 1.5) leScore += 0.18  // partial
        // S2: Loss > 2x avg loss (w=0.35)
        if (Math.abs(pnl) > sessionAvgLoss * 2) leScore += 0.35
        else if (Math.abs(pnl) > sessionAvgLoss * 1.5) leScore += 0.18
        // S3: This is one of the largest losses in session (w=0.30)
        if (losingAbs.length >= 3 && Math.abs(pnl) >= [...losingAbs].sort((a, b) => b - a)[Math.min(2, losingAbs.length - 1)]) leScore += 0.30

        if (leScore >= 0.60) {
          candidates[i].push({
            tag: 'late_exit',
            reason: `Held ${Math.round(holdApprox)} min (${holdMultiple.toFixed(1)}× your average) and lost ${fmtINR(pnl)} — hope, not plan (score: ${leScore.toFixed(2)})`,
            severity: leScore >= 0.75 ? 'high' : 'medium',
            score: leScore,
            confidence: scoreToConfidence(leScore),
          })
        }
      }
    }

    // DISCIPLINED (only relevant when no mistake candidates exist — scored as 0)
    // Session-relative: entered 3-45 min into session (works for any market)
    const goodEntryWindow = m !== null && m >= sessionStartMinutes + 3 && m <= sessionStartMinutes + 45
    const reasonableSize = qty > 0 && qty <= Math.max(1, sessionAvgQty * 1.2)
    if (goodEntryWindow && reasonableSize) {
      candidates[i].push({
        tag: 'disciplined',
        reason: `Entered in the high-probability window (${t.time}) with normal size — process > outcome`,
        severity: 'low',
        score: 0,
        confidence: 'low',
      })
    }

    // Track for next iteration
    if (pnl < 0) {
      lastLossBySymbol.set(symbol, { minutes: m, pnl, qty })
      consecutiveLosses++
      runningLossSum += Math.abs(pnl)
      runningLossCount++
    } else {
      consecutiveLosses = 0
    }
    sessionLossesSoFar += pnl
    prevWasBigWin = pnl > 0 && pnl >= bigWinCutoff && Number.isFinite(bigWinCutoff)
    prevBuySamePrice.set(symbol, price)
  }

  // Second pass: pick ONE tag per trade by priority, then compute cost with confidence scaling
  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const pnl = pnls[i]
    let chosen: TradeTag = pnl >= 0 ? 'win' : 'win'
    let chosenCand: Candidate | null = null
    for (const c of candidates[i]) {
      if (!chosenCand) { chosenCand = c; chosen = c.tag; continue }
      const winner = pickHigherPriority(c.tag, chosen)
      if (winner === c.tag) { chosenCand = c; chosen = c.tag }
    }

    // Per-trade cost attribution with confidence scaling
    let cost = 0
    if (MISTAKE_TAGS.has(chosen) && pnl < 0 && chosenCand) {
      const baseCost = Math.max(0, Math.abs(pnl) - sessionAvgLoss)
      cost = baseCost * confidenceMultiplier(chosenCand.confidence)
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
      confidence: chosenCand?.confidence ?? 'low',
      score: chosenCand?.score ?? 0,
      pnl,
      cost,
      note: buildShortNote(t, chosen, reason, pnl),
    }
  }

  // ── Cost capping: total mistake cost ≤ 85% of gross loss ──
  const grossLoss = losingAbs.reduce((a, b) => a + b, 0)
  const maxAllowedCost = grossLoss * 0.85
  const rawMistakeCost = detected.reduce((a, d) => a + d.cost, 0)
  if (rawMistakeCost > maxAllowedCost && rawMistakeCost > 0) {
    const scaleFactor = maxAllowedCost / rawMistakeCost
    for (let i = 0; i < n; i++) {
      if (detected[i].cost > 0) {
        detected[i].cost = Math.round(detected[i].cost * scaleFactor * 100) / 100
      }
    }
  }

  // ── Tag rate capping: max 20% of trades tagged as mistakes ──
  const maxMistakeTrades = Math.max(1, Math.ceil(n * 0.20))
  const mistakeTrades = detected
    .filter(d => MISTAKE_TAGS.has(d.tag))
    .sort((a, b) => b.score - a.score)  // keep highest-scored

  if (mistakeTrades.length > maxMistakeTrades) {
    const toUntag = new Set(mistakeTrades.slice(maxMistakeTrades).map(d => d.index))
    for (let i = 0; i < n; i++) {
      if (toUntag.has(i)) {
        detected[i].tag = detected[i].pnl >= 0 ? 'win' : 'win'
        detected[i].tagLabel = labelFor(detected[i].tag)
        detected[i].cost = 0
        detected[i].score = 0
        detected[i].confidence = 'low'
        detected[i].reason = detected[i].pnl >= 0
          ? `Clean win of ${fmtINR(detected[i].pnl)}`
          : `Loss of ${fmtINR(detected[i].pnl)} — no behavioural flag`
        detected[i].note = buildShortNote(trades[i], detected[i].tag, detected[i].reason, detected[i].pnl)
      }
    }
  }

  // Aggregate AFTER capping
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
  const goodEntries = mins.reduce<number>((acc, m) => acc + ((m !== null && m >= sessionStartMinutes + 3 && m <= sessionStartMinutes + 45) ? 1 : 0), 0)
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
  if (patterns.revengeTrades > 0) coachingPoints.push(`${patterns.revengeTrades} revenge trade${patterns.revengeTrades > 1 ? 's' : ''} cost you ${fmtINR(revengeCost)} in excess losses — walk away for 15 min after any loss exceeding your session average.`)
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
  if (mistakeTotalCost > grossLoss + 0.01) warnings.push(`mistakeTotalCost (${mistakeTotalCost.toFixed(0)}) exceeds gross losses (${grossLoss.toFixed(0)})`)
  const tagCounts = detected.reduce<Record<string, number>>((acc, d) => { acc[d.tag] = (acc[d.tag] || 0) + 1; return acc }, {})
  for (const d of detected) if ((tagCounts[d.tag] || 0) > n) warnings.push(`duplicate tag overflow: ${d.tag}`)
  const tagRate = n > 0 ? mistakeCount / n : 0
  if (tagRate > 0.25) warnings.push(`${Math.round(tagRate * 100)}% of trades tagged as mistakes — detector may be over-sensitive`)
  const costRatio = grossLoss > 0 ? mistakeTotalCost / grossLoss : 0
  if (costRatio > 0.85) warnings.push(`Cost ratio ${(costRatio * 100).toFixed(1)}% exceeds 85% cap — capping may have failed`)
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
