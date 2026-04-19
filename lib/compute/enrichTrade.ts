/**
 * Module 2, Layer 1 — Trade Enrichment
 *
 * Pure, deterministic transformation: StandardTrade[] → EnrichedTrade[].
 * No network, no AI, no database. Every other layer reads from this output.
 *
 * Pattern/cycle attribution fields are left null/0 here — they are filled
 * by later layers (patternDetector, viciousCycle).
 */

import type { StandardTrade } from '../intake/types'
import type { EnrichedTrade, UserBaseline } from './types'

// ────────────────────────────────────────────────────────────
// Helpers (kept local — pure and tested via enrichTrades)
// ────────────────────────────────────────────────────────────

/** Indian index lot sizes (F&O). Fallback 1 for stocks / unknown. */
function detectLotSize(symbol: string): number {
  const s = (symbol || '').toUpperCase()
  // Indian indices
  if (s.includes('NIFTY') && !s.includes('BANKNIFTY') && !s.includes('FINNIFTY')) return 75
  if (s.includes('BANKNIFTY')) return 30
  if (s.includes('FINNIFTY')) return 65
  if (s.includes('MIDCPNIFTY')) return 140
  if (s.includes('SENSEX')) return 20
  // Default for stocks/options/unknown
  return 1
}

/** Parse "HH:MM" or "HH:MM:SS" → minutes since midnight. Returns 0 if missing/unparsable. */
function parseTimeToMinutes(timeStr: string | undefined | null): number {
  if (!timeStr) return 0
  const parts = String(timeStr).split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const hour = Number.isFinite(h) ? h : 0
  const min = Number.isFinite(m) ? m : 0
  return hour * 60 + min
}

/** Parse just the hour portion of "HH:MM" / "HH:MM:SS". Returns 0 if missing. */
function parseHour(timeStr: string | undefined | null): number {
  if (!timeStr) return 0
  const parts = String(timeStr).split(':')
  const h = parseInt(parts[0], 10)
  return Number.isFinite(h) ? h : 0
}

/** Parse just the minute portion. Returns 0 if missing. */
function parseMinute(timeStr: string | undefined | null): number {
  if (!timeStr) return 0
  const parts = String(timeStr).split(':')
  const m = parseInt(parts[1], 10)
  return Number.isFinite(m) ? m : 0
}

/** Pad to 2 digits: 9 → "09". */
function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Format "HH:MM-HH:MM" time-slot label. */
function formatSlot(startHour: number, startMin: number, endHour: number, endMin: number): string {
  return `${pad(startHour)}:${pad(startMin)}-${pad(endHour)}:${pad(endMin)}`
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Day-of-week for an ISO date "YYYY-MM-DD" parsed as UTC (stable across timezones). */
function dayOfWeekForDate(dateStr: string): number {
  if (!dateStr) return 0
  // Treat as UTC to avoid local-tz off-by-one on date-only strings.
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dow = d.getUTCDay()
  return Number.isFinite(dow) ? dow : 0
}

/** Classify a duration in minutes into a holding-style bucket. */
function classifyHolding(
  minutes: number
): 'scalp' | 'quick' | 'normal' | 'extended' | 'positional' {
  if (minutes < 2) return 'scalp'
  if (minutes < 10) return 'quick'
  if (minutes < 60) return 'normal'
  if (minutes <= 240) return 'extended'
  return 'positional'
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Enrich a list of StandardTrade[] with all derived fields the rest of
 * Module 2 depends on. Pure and deterministic — no side effects.
 *
 * Pattern/cycle fields are intentionally left null/0 here; they are populated
 * by later layers (patternDetector, viciousCycle).
 */
export function enrichTrades(
  trades: StandardTrade[],
  baseline?: UserBaseline
): EnrichedTrade[] {
  if (!trades || trades.length === 0) return []

  // 1) Sort by date + entryTime (ascending, stable).
  const sorted = trades.slice().sort((a, b) => {
    const aKey = `${a.date || ''}T${a.entryTime || '00:00'}`
    const bKey = `${b.date || ''}T${b.entryTime || '00:00'}`
    if (aKey < bKey) return -1
    if (aKey > bKey) return 1
    return 0
  })

  const n = sorted.length

  // 2) Pass 1: per-trade capitalDeployed, session totals, peak.
  const capitals: number[] = sorted.map((t) => {
    const qty = Number(t.qty) || 0
    const price = Number(t.entryPrice) || 0
    return qty * price
  })
  const totalCapital = capitals.reduce((acc, c) => acc + c, 0)
  const avgCapital = n > 0 ? totalCapital / n : 0
  const sessionPeakCapital = capitals.reduce((max, c) => (c > max ? c : max), 0)

  // 3) Pass 2: build EnrichedTrade[] in order, carrying running state.
  const result: EnrichedTrade[] = []
  let cumulativePnl = 0 // running sum BEFORE current trade
  let peakPnlSoFar = -Infinity
  let runningWinStreak = 0
  let runningLossStreak = 0

  for (let i = 0; i < n; i++) {
    const t = sorted[i]
    const isFirstTrade = i === 0
    const isLastTrade = i === n - 1

    // --- Time breakdown ---
    const dayOfWeek = dayOfWeekForDate(t.date)
    const dayOfWeekName = DAY_NAMES[dayOfWeek] || 'Sunday'
    const hourOfDay = parseHour(t.entryTime)
    const entryMinute = parseMinute(t.entryTime)
    const slotMinute = entryMinute < 30 ? 0 : 30
    const endHour30 = slotMinute === 30 ? hourOfDay + 1 : hourOfDay
    const endMinute30 = slotMinute === 30 ? 0 : 30
    const timeSlot30min = formatSlot(hourOfDay, slotMinute, endHour30, endMinute30)
    const timeSlot60min = formatSlot(hourOfDay, 0, hourOfDay + 1, 0)

    const sessionProgress = n > 1 ? i / (n - 1) : 0

    // timeSincePreviousTrade: prev.exitTime → curr.entryTime (minutes).
    let timeSincePreviousTrade = 0
    if (!isFirstTrade) {
      const prev = sorted[i - 1]
      if (prev.exitTime && t.entryTime) {
        const prevEnd = parseTimeToMinutes(prev.exitTime)
        const currStart = parseTimeToMinutes(t.entryTime)
        let diff = currStart - prevEnd
        if (diff < 0) diff += 1440 // cross-midnight correction
        timeSincePreviousTrade = diff
      }
    }

    // --- Holding ---
    let durationMinutes: number
    if (t.entryTime && t.exitTime) {
      const start = parseTimeToMinutes(t.entryTime)
      const end = parseTimeToMinutes(t.exitTime)
      let d = end - start
      if (d < 0) d += 1440
      durationMinutes = d
    } else {
      durationMinutes = Number(t.holdingMinutes) || 0
    }
    const holdingCategory = classifyHolding(durationMinutes)

    // --- Capital ---
    const capitalDeployed = capitals[i]
    const capitalAsPercentOfPeak =
      sessionPeakCapital > 0 ? (capitalDeployed / sessionPeakCapital) * 100 : 0
    const lotSize = detectLotSize(t.symbol)
    const numberOfLots = Math.max(1, Math.floor((Number(t.qty) || 0) / Math.max(1, lotSize)))
    const sizeVsSessionAvg = avgCapital > 0 ? capitalDeployed / avgCapital : 0
    let sizeVsUserMedian = 1.0
    if (baseline && baseline.medianQty > 0 && Number(t.entryPrice) > 0) {
      const medianCapital = baseline.medianQty * Number(t.entryPrice)
      sizeVsUserMedian = medianCapital > 0 ? capitalDeployed / medianCapital : 1.0
    }
    const isOversized = sizeVsSessionAvg > 2.0
    const isUndersized = sizeVsSessionAvg < 0.5

    // --- P&L ---
    const pnl = Number(t.pnl) || 0
    const pnlPerLot = numberOfLots > 0 ? pnl / numberOfLots : pnl
    const pnlAsPercentOfCapital =
      capitalDeployed > 0 ? (pnl / capitalDeployed) * 100 : 0
    const isBreakeven = Math.abs(pnlAsPercentOfCapital) < 0.5
    const isWin = pnl > 0 && !isBreakeven
    const isLoss = pnl < 0 && !isBreakeven

    const cumulativePnlBefore = cumulativePnl
    const cumulativePnlAfter = cumulativePnlBefore + pnl
    if (cumulativePnlAfter > peakPnlSoFar) peakPnlSoFar = cumulativePnlAfter
    const drawdownFromPeak = Math.max(0, peakPnlSoFar - cumulativePnlAfter)

    // --- Sequence ---
    // Capture the previous trade's final consecutiveWins BEFORE we mutate running state.
    const prevConsecutiveWins = i > 0 ? result[i - 1].consecutiveWins : 0

    let consecutiveWins: number
    let consecutiveLosses: number
    if (isWin) {
      consecutiveWins = runningWinStreak + 1
      consecutiveLosses = 0
      runningWinStreak = consecutiveWins
      runningLossStreak = 0
    } else if (isLoss) {
      consecutiveLosses = runningLossStreak + 1
      consecutiveWins = 0
      runningLossStreak = consecutiveLosses
      runningWinStreak = 0
    } else {
      // breakeven or zero pnl → resets both streaks
      consecutiveWins = 0
      consecutiveLosses = 0
      runningWinStreak = 0
      runningLossStreak = 0
    }

    const winStreakBroken = isLoss && prevConsecutiveWins >= 2
    const lossStreakExtended = isLoss && consecutiveLosses >= 2

    // --- Assemble EnrichedTrade ---
    const enriched: EnrichedTrade = {
      // StandardTrade passthrough
      index: t.index,
      symbol: t.symbol,
      side: t.side,
      qty: t.qty,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      pnl: t.pnl,
      cumPnl: t.cumPnl,
      date: t.date,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      holdingMinutes: t.holdingMinutes,
      session: t.session,
      timeGapMinutes: t.timeGapMinutes,
      tag: t.tag,
      label: t.label,
      exchange: t.exchange,
      tradeId: t.tradeId,
      sourceRows: t.sourceRows,
      isShort: t.isShort,
      fees: t.fees,

      // Indexing
      tradeIndex: i,
      tradeNumberInSession: i + 1,
      isFirstTrade,
      isLastTrade,

      // Time breakdown
      dayOfWeek,
      dayOfWeekName,
      hourOfDay,
      timeSlot30min,
      timeSlot60min,
      sessionProgress,
      timeSincePreviousTrade,

      // Holding
      durationMinutes,
      holdingCategory,

      // Capital
      capitalDeployed,
      capitalAsPercentOfPeak,
      lotSize,
      numberOfLots,
      sizeVsSessionAvg,
      sizeVsUserMedian,
      isOversized,
      isUndersized,

      // P&L
      pnlPerLot,
      pnlAsPercentOfCapital,
      isWin,
      isLoss,
      isBreakeven,
      cumulativePnl: cumulativePnlBefore,
      cumulativePnlAfter,
      drawdownFromPeak,

      // Sequence
      consecutiveWins,
      consecutiveLosses,
      winStreakBroken,
      lossStreakExtended,

      // Pattern attribution (filled by later layers)
      detectedTag: null,
      tagConfidence: null,
      tagCost: 0,

      // Vicious cycle stage (filled by later layers)
      cycleStageName: null,
      cycleStageNumber: null,
    }

    result.push(enriched)

    // Advance cumulativePnl for the next iteration
    cumulativePnl = cumulativePnlAfter
  }

  return result
}
