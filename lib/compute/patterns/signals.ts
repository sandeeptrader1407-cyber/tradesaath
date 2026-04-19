/**
 * Module 2, Layer 2 — Shared signal library for pattern detection.
 *
 * Each signal returns a SignalResult describing whether it fired
 * and how much score it contributes. Score contribution = value * weight.
 *
 * These mirror the inline `+= 0.XX` expressions in the legacy
 * lib/analysis/patternDetector.ts — no new signals invented.
 */

import type { EnrichedTrade, SignalResult, UserBaseline } from '../types'

// ────────────────────────────────────────────────────────────
// Pure number helpers
// ────────────────────────────────────────────────────────────

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length
  return Math.sqrt(v)
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/** Parse "HH:MM" to minutes since midnight. Returns null if unparseable. */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mn = parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(mn)) return null
  return h * 60 + mn
}

/** Score → confidence bucket. Mirrors legacy `scoreToConfidence`. */
export function scoreToConfidence(
  score: number
): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high'
  if (score >= 0.55) return 'medium'
  return 'low'
}

/** Confidence → cost multiplier. Mirrors legacy `confidenceMultiplier`. */
export function confidenceMultiplier(c: 'high' | 'medium' | 'low'): number {
  return c === 'high' ? 1.0 : c === 'medium' ? 0.7 : 0.4
}

/** Severity bucketing — matches legacy thresholds for most detectors. */
export function severityFor(
  score: number
): 'low' | 'medium' | 'high' {
  if (score >= 0.75) return 'high'
  if (score >= 0.55) return 'medium'
  return 'low'
}

// ────────────────────────────────────────────────────────────
// Context — pre-computed session stats.
// Populated once in the orchestrator; read by each detector.
// ────────────────────────────────────────────────────────────

export interface SessionStats {
  n: number
  sessionStartMinutes: number
  sessionAvgQty: number
  sessionAvgLoss: number
  avgHoldingTime: number
  userTypicalQty: number
  avgDailyTrades: number
  bigWinCutoff: number
  overtradingDetected: boolean
  overtradingThreshold: number
  losingAbs: number[]
  sortedLosingAbsDesc: number[]
  /** For each trade index i, the last losing trade of the same symbol that occurred BEFORE i (or null). */
  lastLossBySymbolAt: Array<{
    tradeIndex: number
    minutes: number | null
    pnl: number
    qty: number
  } | null>
  /** Trade indices that the averaging-streak algorithm tagged. */
  averagingIndices: Set<number>
  /** For each trade index, the length of the averaging streak at that point (0 if not in streak). */
  avgStreakLengthAt: Map<number, number>
  /** For each trade index i, "was the previous trade a big win?" */
  prevWasBigWinAt: boolean[]
}

export interface DetectionContext {
  trade: EnrichedTrade
  index: number
  previous: EnrichedTrade | null
  recentTrades: EnrichedTrade[]
  allTrades: EnrichedTrade[]
  session: SessionStats
  baseline?: UserBaseline
}

// ────────────────────────────────────────────────────────────
// Pre-computation — one forward pass over enriched trades.
// Produces the SessionStats struct consumed by every detector.
// ────────────────────────────────────────────────────────────

export function computeSessionStats(
  trades: EnrichedTrade[],
  baseline?: UserBaseline
): SessionStats {
  const n = trades.length
  const pnls = trades.map((t) => Number(t.pnl) || 0)
  const qtys = trades.map((t) => Number(t.qty) || 0)
  const mins = trades.map((t) => timeToMinutes(t.entryTime))

  // Session start — earliest entryTime among trades, fallback to 09:15.
  const validMins = mins.filter((m): m is number => m !== null)
  const sessionStartMinutes =
    validMins.length > 0 ? Math.min(...validMins) : 9 * 60 + 15

  const positiveQtys = qtys.filter((q) => q > 0)
  const sessionAvgQty = mean(positiveQtys)

  const losingAbs = pnls.filter((p) => p < 0).map((p) => Math.abs(p))
  const sessionAvgLoss = mean(losingAbs)
  const sortedLosingAbsDesc = [...losingAbs].sort((a, b) => b - a)

  // avgHoldingTime — mean of durationMinutes (ported from legacy proxy).
  const holdingTimes = trades
    .map((t) => Number(t.durationMinutes) || 0)
    .filter((d) => d > 0)
  const avgHoldingTime = mean(holdingTimes)

  const userTypicalQty =
    baseline && baseline.medianQty > 0 ? baseline.medianQty : sessionAvgQty
  const avgDailyTrades =
    baseline && baseline.avgDailyTrades > 0 ? baseline.avgDailyTrades : n

  // Big-win cutoff — top 25% of winning trades (index floor(len*0.25) - 1 in desc-sorted).
  const winAmounts = pnls.filter((p) => p > 0)
  const winsSorted = [...winAmounts].sort((a, b) => b - a)
  const bigWinCutoff =
    winsSorted.length > 0
      ? winsSorted[Math.max(0, Math.floor(winsSorted.length * 0.25) - 1)]
      : Infinity

  const overtradingDetected = n > avgDailyTrades * 1.5
  const overtradingThreshold = Math.ceil(avgDailyTrades * 1.5)

  // lastLossBySymbolAt — for trade i, the last losing trade of the same
  // symbol that occurred strictly before i.
  const lastLossBySymbolAt: SessionStats['lastLossBySymbolAt'] = new Array(n).fill(
    null
  )
  const running = new Map<
    string,
    { tradeIndex: number; minutes: number | null; pnl: number; qty: number }
  >()
  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const sym = String(t.symbol || 'UNKNOWN')
    const prev = running.get(sym) || null
    lastLossBySymbolAt[i] = prev
    if (pnls[i] < 0) {
      running.set(sym, {
        tradeIndex: i,
        minutes: mins[i],
        pnl: pnls[i],
        qty: qtys[i],
      })
    }
  }

  // Averaging streak detection — same algorithm as legacy patternDetector.
  // A streak forms when consecutive BUYs on the same symbol occur at
  // strictly descending prices. Once streak length ≥ 2, ALL indices in
  // the streak get flagged.
  const averagingIndices = new Set<number>()
  const avgStreakLengthAt = new Map<number, number>()
  let streak:
    | { symbol: string; lastPrice: number; indices: number[] }
    | null = null
  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const side = String(t.side || '').toUpperCase()
    const price = Number(t.entryPrice) || 0
    const sym = String(t.symbol || 'UNKNOWN')
    if (side === 'BUY' && price > 0) {
      if (streak && streak.symbol === sym && price < streak.lastPrice) {
        streak.indices.push(i)
        streak.lastPrice = price
        if (streak.indices.length >= 2) {
          for (const idx of streak.indices) averagingIndices.add(idx)
        }
      } else {
        streak = { symbol: sym, lastPrice: price, indices: [i] }
      }
    } else {
      streak = null
    }
    avgStreakLengthAt.set(i, streak ? streak.indices.length : 0)
  }

  // prevWasBigWinAt[i] — true iff trade i-1 was a "big win" (pnl > 0 and
  // pnl >= bigWinCutoff). prevWasBigWinAt[0] = false.
  const prevWasBigWinAt: boolean[] = new Array(n).fill(false)
  for (let i = 1; i < n; i++) {
    const prevPnl = pnls[i - 1]
    prevWasBigWinAt[i] =
      prevPnl > 0 && prevPnl >= bigWinCutoff && Number.isFinite(bigWinCutoff)
  }

  return {
    n,
    sessionStartMinutes,
    sessionAvgQty,
    sessionAvgLoss,
    avgHoldingTime,
    userTypicalQty,
    avgDailyTrades,
    bigWinCutoff,
    overtradingDetected,
    overtradingThreshold,
    losingAbs,
    sortedLosingAbsDesc,
    lastLossBySymbolAt,
    averagingIndices,
    avgStreakLengthAt,
    prevWasBigWinAt,
  }
}

// ────────────────────────────────────────────────────────────
// Generic signal helper — build a SignalResult record.
// value is in [0, 1]; weight is the max contribution when value=1.
// Score contribution = value * weight.
// ────────────────────────────────────────────────────────────

export function signal(
  name: string,
  weight: number,
  value: number,
  detail: string
): SignalResult {
  return {
    name,
    weight,
    value: Math.max(0, Math.min(1, value)),
    detail,
  }
}

/** Sum of weight*value across a SignalResult[]. */
export function scoreSignals(signals: SignalResult[]): number {
  return signals.reduce((acc, s) => acc + s.weight * s.value, 0)
}

// ────────────────────────────────────────────────────────────
// Individual shared signals required by the task spec.
// Each returns a SignalResult; detectors compose them with
// local weights that mirror the legacy detector.
// ────────────────────────────────────────────────────────────

/**
 * Fires when the current trade is placed shortly after a losing trade
 * on the SAME symbol. Time window: 0..5 minutes → value=1, else 0.
 * Port of legacy REVENGE S1.
 */
export function timeProximityAfterLoss(
  trade: EnrichedTrade,
  prevLoss: { minutes: number | null } | null,
  weight: number
): SignalResult {
  const currMin = timeToMinutes(trade.entryTime)
  if (!prevLoss || prevLoss.minutes === null || currMin === null) {
    return signal(
      'timeProximityAfterLoss',
      weight,
      0,
      'no prior same-symbol loss'
    )
  }
  const delta = currMin - prevLoss.minutes
  const fired = delta >= 0 && delta <= 5
  return signal(
    'timeProximityAfterLoss',
    weight,
    fired ? 1 : 0,
    fired ? `re-entered ${delta} min after a loss` : `${delta} min after loss`
  )
}

/**
 * Fires when qty > sessionAvgQty * threshold. Returns value=1 if fired.
 * Port of multiple "size vs avg" signals (FOMO S2, averaging S3, etc.).
 */
export function sizeIncrease(
  trade: EnrichedTrade,
  sessionAvgQty: number,
  multiplier: number,
  weight: number
): SignalResult {
  const qty = Number(trade.qty) || 0
  if (sessionAvgQty <= 0) {
    return signal('sizeIncrease', weight, 0, 'no session avg qty')
  }
  const fired = qty > sessionAvgQty * multiplier
  return signal(
    'sizeIncrease',
    weight,
    fired ? 1 : 0,
    `${qty} vs ${multiplier}× session avg ${sessionAvgQty.toFixed(1)}`
  )
}

/**
 * Fires high when recent trades form an emotional-loss context.
 * Value = 1 if there are ≥3 consecutive losing trades in the last 5.
 * Helper only — legacy detector uses running counters directly.
 */
export function emotionalContext(
  recentTrades: EnrichedTrade[],
  weight: number
): SignalResult {
  const recentLosses = recentTrades.filter((t) => t.isLoss).length
  const fired = recentLosses >= 3
  return signal(
    'emotionalContext',
    weight,
    fired ? 1 : 0,
    `${recentLosses} losses in last ${recentTrades.length}`
  )
}

/**
 * Fires when a losing trade was held abnormally long vs avg.
 * Uses holdMultiple = durationMinutes / avgHoldingTime.
 * Port of LATE_EXIT S1 (tiered: >2× full, >1.5× partial).
 */
export function extendedHoldOnLoser(
  trade: EnrichedTrade,
  avgHoldingTime: number,
  weight: number
): SignalResult {
  if (!trade.isLoss || avgHoldingTime <= 0) {
    return signal('extendedHoldOnLoser', weight, 0, 'not a held loser')
  }
  const dur = Number(trade.durationMinutes) || 0
  const mult = dur / Math.max(1, avgHoldingTime)
  let v = 0
  if (mult > 2) v = 1
  else if (mult > 1.5) v = 0.5143 // partial-credit port (0.18/0.35 weight ratio)
  return signal(
    'extendedHoldOnLoser',
    weight,
    v,
    `held ${dur.toFixed(1)}min = ${mult.toFixed(2)}× avg`
  )
}

/**
 * Fires when there are many trades in a short window around this one.
 * Helper — legacy detector uses position-in-session (overtradingThreshold)
 * not time-window clustering. This is useful for signal-level tests.
 */
export function tradeClustering(
  trade: EnrichedTrade,
  allTrades: EnrichedTrade[],
  weight: number,
  windowMinutes: number = 30,
  countThreshold: number = 5
): SignalResult {
  const currMin = timeToMinutes(trade.entryTime)
  const sameDay = allTrades.filter((t) => t.date === trade.date)
  if (currMin === null) {
    return signal('tradeClustering', weight, 0, 'no entryTime')
  }
  let count = 0
  for (const t of sameDay) {
    const m = timeToMinutes(t.entryTime)
    if (m === null) continue
    if (Math.abs(m - currMin) <= windowMinutes) count++
  }
  const fired = count >= countThreshold
  return signal(
    'tradeClustering',
    weight,
    fired ? 1 : 0,
    `${count} trades within ±${windowMinutes}min`
  )
}

// ────────────────────────────────────────────────────────────
// Tag label map — matches legacy labelFor() exactly.
// ────────────────────────────────────────────────────────────

import type { PatternTag } from '../types'

export function labelFor(tag: PatternTag): string {
  switch (tag) {
    case 'revenge':
      return 'Revenge Trade'
    case 'averaging':
      return 'Averaging Down'
    case 'fomo':
      return 'FOMO Entry'
    case 'panic':
      return 'Panic Exit'
    case 'overtrading':
      return 'Overtrading'
    case 'oversize':
      return 'Oversized Position'
    case 'late_exit':
      return 'Late Exit'
    case 'disciplined':
      return 'Disciplined'
    case 'win':
      return 'Win'
  }
}

export const MISTAKE_TAGS: ReadonlySet<PatternTag> = new Set<PatternTag>([
  'revenge',
  'averaging',
  'fomo',
  'panic',
  'overtrading',
  'oversize',
  'late_exit',
])

/**
 * Strict priority order — lower index = higher priority.
 * Ported verbatim from legacy TAG_PRIORITY.
 */
export const TAG_PRIORITY: PatternTag[] = [
  'revenge',
  'averaging',
  'fomo',
  'panic',
  'overtrading',
  'oversize',
  'late_exit',
  'disciplined',
  'win',
]

export function pickHigherPriority(a: PatternTag, b: PatternTag): PatternTag {
  return TAG_PRIORITY.indexOf(a) <= TAG_PRIORITY.indexOf(b) ? a : b
}
