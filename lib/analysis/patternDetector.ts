/**
 * TradeSaath — Algorithmic pattern detector
 * -------------------------------------------------
 * Pure-code analysis. No AI. Takes a session's trades and computes:
 *   - Per-trade behavioural tags (win / revenge / fomo / panic / averaging / oversize / disciplined / loss)
 *   - Session-level pattern counts
 *   - Code-generated coaching points
 *   - Vicious-cycle sequences
 *   - Decision-Quality-Score factors
 *
 * Replaces per-trade Claude calls that previously cost ~₹15 per session.
 * Deterministic, instant, free.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TradeTag =
  | 'win'
  | 'loss'
  | 'revenge'
  | 'fomo'
  | 'panic'
  | 'averaging'
  | 'oversize'
  | 'disciplined'

export type Severity = 'low' | 'medium' | 'high'

export interface DetectedTrade {
  index: number
  tag: TradeTag
  tagLabel: string
  reason: string
  severity: Severity
  // Convenience — the trade's own pnl (for downstream consumers)
  pnl: number
  // Keep a short one-line note so the UI can render without another pass
  note: string
}

export interface PatternCounts {
  revengeTrades: number
  fomoEntries: number
  panicExits: number
  averagingDown: number
  oversizedTrades: number
  disciplinedTrades: number
  overtradingDetected: boolean
}

export interface CycleStage {
  stage: number
  tradeIndex: number
  description: string
}

export interface DQS {
  entryQuality: number
  exitTiming: number
  positionSizing: number
  ruleFollowing: number
  emotionalControl: number
  overall: number
}

export interface PatternResult {
  trades: DetectedTrade[]
  patterns: PatternCounts
  coachingPoints: string[]
  cycleDetected: boolean
  cycleStages: CycleStage[]
  dqs: DQS
  // Optional extras used by session summary
  meta: {
    totalTrades: number
    netPnl: number
    winCount: number
    lossCount: number
    winRate: number
    revengeCost: number
    fomoCost: number
    panicCost: number
    averagingCost: number
    oversizeCost: number
    mistakeTotalCost: number
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

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
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

/* ────────────────────────────────────────────────────────────────── */
/* Main detector                                                       */
/* ────────────────────────────────────────────────────────────────── */

export interface DetectorOptions {
  /** Optional user-level typical quantity across all sessions — lets us detect
   *  oversize relative to the user's history, not just this session. */
  userTypicalQty?: number
  /** Average daily trades for overtrading detection. */
  userAvgDailyTrades?: number
  /** Market open time in minutes from midnight, default 09:15 NSE. */
  marketOpenMinutes?: number
}

export function detectPatterns(rawTrades: any[], opts: DetectorOptions = {}): PatternResult {
  const trades: any[] = Array.isArray(rawTrades) ? rawTrades : []
  const n = trades.length

  if (n === 0) {
    return emptyResult()
  }

  const marketOpen = opts.marketOpenMinutes ?? (9 * 60 + 15)

  // Precompute per-trade numeric fields (accept both ParsedTrade and Claude-extracted shapes)
  const pnls = trades.map(t => toNum(t.pnl))
  const qtys = trades.map(t => toNum(t.qty ?? t.quantity))
  const mins = trades.map(t => timeToMinutes(t.time ?? t.entry_time))

  const sessionAvgQty = mean(qtys.filter(q => q > 0))
  const sessionQtyStd = stddev(qtys.filter(q => q > 0))
  const userTypicalQty = opts.userTypicalQty && opts.userTypicalQty > 0 ? opts.userTypicalQty : sessionAvgQty
  const avgDailyTrades = opts.userAvgDailyTrades && opts.userAvgDailyTrades > 0 ? opts.userAvgDailyTrades : n

  // Per-symbol last-loss tracking for revenge detection
  const lastLossBySymbol = new Map<string, { index: number; minutes: number | null; pnl: number; qty: number }>()

  // Consecutive same-symbol buy tracking for averaging-down detection
  let avgDownRun: { symbol: string; lastPrice: number; runIndices: number[] } | null = null

  // Per-symbol time-sorted buy list (for averaging-down even if non-consecutive in session)
  // but the spec says consecutive, so we'll stick with consecutive.

  const detected: DetectedTrade[] = new Array(n)
  let prevWasBigWin = false
  const BIG_WIN_THRESHOLD = () => {
    // A "big win" = top quartile of winning pnls this session
    const wins = pnls.filter(p => p > 0).sort((a, b) => b - a)
    if (!wins.length) return Infinity
    const cutoffIdx = Math.max(0, Math.floor(wins.length * 0.25) - 1)
    return wins[cutoffIdx]
  }
  const bigWinCutoff = BIG_WIN_THRESHOLD()

  for (let i = 0; i < n; i++) {
    const t = trades[i]
    const symbol: string = String(t.symbol || 'UNKNOWN')
    const side: string = String(t.side || '').toUpperCase()
    const qty = qtys[i]
    const pnl = pnls[i]
    const m = mins[i]

    let tag: TradeTag = pnl >= 0 ? 'win' : 'loss'
    let tagLabel = pnl >= 0 ? 'Win' : 'Loss'
    let reason = ''
    let severity: Severity = 'low'

    /* ── REVENGE: same-symbol re-entry within 5 min of a loss, or larger qty after loss ── */
    const lastLoss = lastLossBySymbol.get(symbol)
    if (lastLoss && pnl <= 0) {
      const withinTime = m !== null && lastLoss.minutes !== null && (m - lastLoss.minutes) <= 5 && (m - lastLoss.minutes) >= 0
      const biggerSize = qty > lastLoss.qty * 1.25 && qty > 0
      if (withinTime || biggerSize) {
        tag = 'revenge'
        tagLabel = 'Revenge Trade'
        reason = withinTime
          ? `Re-entered ${symbol} within ${Math.max(0, (m! - lastLoss.minutes!))} min of a ${fmtINR(lastLoss.pnl)} loss`
          : `Increased size on ${symbol} after a ${fmtINR(lastLoss.pnl)} loss (${lastLoss.qty} → ${qty})`
        severity = Math.abs(pnl) > 1000 ? 'high' : Math.abs(pnl) > 300 ? 'medium' : 'low'
      }
    }

    /* ── FOMO: first 3 min of open, or qty > 2x session avg, or chasing after a big win ── */
    if (tag !== 'revenge') {
      const earlyOpen = m !== null && m >= marketOpen && m <= marketOpen + 3
      const oversizeVsSession = sessionAvgQty > 0 && qty > sessionAvgQty * 2
      const chaseAfterWin = prevWasBigWin
      if (earlyOpen || oversizeVsSession || chaseAfterWin) {
        tag = 'fomo'
        tagLabel = 'FOMO Entry'
        reason = earlyOpen
          ? `Entered at ${t.time} — within the first 3 min of the open (emotion > plan)`
          : oversizeVsSession
            ? `Quantity ${qty} is ${(qty / Math.max(1, sessionAvgQty)).toFixed(1)}× your session average`
            : `Chased momentum right after a big win of ${fmtINR(pnls[i - 1] || 0)}`
        severity = pnl < -500 ? 'high' : pnl < 0 ? 'medium' : 'low'
      }
    }

    /* ── PANIC: hold <2 min AND loss ── */
    // We don't have exit time per row (each row is one trade); use time_gap_minutes as proxy
    // to the NEXT trade as a crude hold duration. If time_gap < 2 and this is a loss → panic.
    if (tag !== 'revenge' && tag !== 'fomo' && pnl < 0) {
      const nextGap = toNum(trades[i]?.time_gap_minutes, NaN)
      const nextMin = i + 1 < n ? mins[i + 1] : null
      const durApprox = Number.isFinite(nextGap) && nextGap > 0
        ? nextGap
        : (nextMin !== null && m !== null ? nextMin - m : NaN)
      if (Number.isFinite(durApprox) && durApprox < 2) {
        tag = 'panic'
        tagLabel = 'Panic Exit'
        reason = `Exited within ~${Math.max(0, Math.round(durApprox))} min — no time for the thesis to play out`
        severity = Math.abs(pnl) > 500 ? 'high' : 'medium'
      }
    }

    /* ── OVERSIZE: qty > 2x the user's typical (across history) ── */
    if (tag === 'win' || tag === 'loss') {
      if (userTypicalQty > 0 && qty > userTypicalQty * 2) {
        tag = 'oversize'
        tagLabel = 'Oversized Position'
        reason = `Qty ${qty} is ${(qty / userTypicalQty).toFixed(1)}× your typical ${Math.round(userTypicalQty)}`
        severity = pnl < -1000 ? 'high' : pnl < 0 ? 'medium' : 'low'
      }
    }

    /* ── DISCIPLINED: good entry window, normal size, not a revenge/fomo/panic/oversize ── */
    if (tag === 'win' || tag === 'loss') {
      const goodEntryWindow = m !== null && m >= marketOpen + 5 && m <= marketOpen + 45
      const reasonableSize = qty > 0 && qty <= Math.max(1, sessionAvgQty * 1.2)
      if (goodEntryWindow && reasonableSize) {
        tag = 'disciplined'
        tagLabel = pnl >= 0 ? 'Disciplined Win' : 'Disciplined Loss'
        reason = `Entered in the high-probability window (${t.time}) with normal size — process > outcome`
        severity = 'low'
      }
    }

    detected[i] = {
      index: i,
      tag,
      tagLabel,
      reason: reason || (pnl >= 0 ? `Clean win of ${fmtINR(pnl)}` : `Loss of ${fmtINR(pnl)}`),
      severity,
      pnl,
      note: buildShortNote(t, tag, reason, pnl),
    }

    // Update trackers for next iteration
    if (pnl < 0) lastLossBySymbol.set(symbol, { index: i, minutes: m, pnl, qty })
    prevWasBigWin = pnl > 0 && pnl >= bigWinCutoff && Number.isFinite(bigWinCutoff)

    /* ── AVERAGING-DOWN: 2+ consecutive BUYs on same symbol at lower price ── */
    // Only BUYs count; we need price info.
    const price = toNum(t.entry ?? t.entry_price ?? t.price)
    if (side === 'BUY' && price > 0) {
      if (avgDownRun && avgDownRun.symbol === symbol && price < avgDownRun.lastPrice) {
        avgDownRun.runIndices.push(i)
        avgDownRun.lastPrice = price
        if (avgDownRun.runIndices.length >= 2) {
          for (const idx of avgDownRun.runIndices) {
            if (detected[idx] && detected[idx].tag !== 'revenge') {
              detected[idx] = {
                ...detected[idx],
                tag: 'averaging',
                tagLabel: 'Averaging Down',
                reason: `Consecutive buy on ${symbol} at a lower price — doubling down on a losing thesis`,
                severity: detected[idx].pnl < -500 ? 'high' : 'medium',
              }
            }
          }
        }
      } else {
        avgDownRun = { symbol, lastPrice: price, runIndices: [i] }
      }
    } else {
      avgDownRun = null
    }
  }

  /* ── Aggregate patterns ── */
  const patterns: PatternCounts = {
    revengeTrades: detected.filter(d => d.tag === 'revenge').length,
    fomoEntries: detected.filter(d => d.tag === 'fomo').length,
    panicExits: detected.filter(d => d.tag === 'panic').length,
    averagingDown: detected.filter(d => d.tag === 'averaging').length,
    oversizedTrades: detected.filter(d => d.tag === 'oversize').length,
    disciplinedTrades: detected.filter(d => d.tag === 'disciplined').length,
    overtradingDetected: n > avgDailyTrades * 1.5,
  }

  /* ── Costs for mistake tags ── */
  const costOf = (tag: TradeTag) => detected
    .filter(d => d.tag === tag && d.pnl < 0)
    .reduce((a, b) => a + b.pnl, 0)

  const revengeCost = costOf('revenge')
  const fomoCost = costOf('fomo')
  const panicCost = costOf('panic')
  const averagingCost = costOf('averaging')
  const oversizeCost = costOf('oversize')
  const mistakeTotalCost = revengeCost + fomoCost + panicCost + averagingCost + oversizeCost

  /* ── Vicious cycle detection: loss → revenge → bigger loss → bigger size → even bigger loss ── */
  const cycleStages: CycleStage[] = []
  for (let i = 0; i + 2 < n; i++) {
    const a = detected[i]
    const b = detected[i + 1]
    const c = detected[i + 2]
    const escalatingLoss = a.pnl < 0 && b.pnl < a.pnl && c.pnl < b.pnl
    const escalatingSize = toNum(trades[i].qty) < toNum(trades[i + 1].qty) && toNum(trades[i + 1].qty) <= toNum(trades[i + 2].qty)
    const revengeInvolved = b.tag === 'revenge' || c.tag === 'revenge'
    if (escalatingLoss && (escalatingSize || revengeInvolved)) {
      cycleStages.push({ stage: 1, tradeIndex: i, description: `Initial loss of ${fmtINR(a.pnl)}` })
      cycleStages.push({ stage: 2, tradeIndex: i + 1, description: `Deeper loss ${fmtINR(b.pnl)} — tilt begins` })
      cycleStages.push({ stage: 3, tradeIndex: i + 2, description: `Escalation: loss widens to ${fmtINR(c.pnl)}` })
      break // one cycle is enough to flag; the coaching points cover the rest
    }
  }
  const cycleDetected = cycleStages.length > 0

  /* ── DQS factors (0-100 each) ── */
  const winCount = pnls.filter(p => p > 0).length
  const lossCount = pnls.filter(p => p < 0).length
  const winRate = n > 0 ? (winCount / n) * 100 : 0
  const netPnl = pnls.reduce((a, b) => a + b, 0)

  // Entry Quality — % of entries in the high-probability window (09:20-10:00)
  const goodEntries = detected.filter(d => {
    const m = mins[d.index]
    return m !== null && m >= marketOpen + 5 && m <= marketOpen + 45
  }).length
  const entryQuality = clamp((goodEntries / n) * 100)

  // Exit Timing — % of trades NOT panic and NOT averaging
  const cleanExits = n - patterns.panicExits - patterns.averagingDown
  const exitTiming = clamp((cleanExits / n) * 100)

  // Position Sizing — lower coefficient of variation in qty is better. CV=0→100, CV>=1→0.
  const cv = sessionAvgQty > 0 ? sessionQtyStd / sessionAvgQty : 1
  const positionSizing = clamp(100 - cv * 100)

  // Rule Following — punish overtrading, punish not stopping after 3 consecutive losses
  let ruleFollowing = 100
  if (patterns.overtradingDetected) ruleFollowing -= 25
  let consecLosses = 0
  let tradesAfterThreeLoss = 0
  let hitThreshold = false
  for (let i = 0; i < n; i++) {
    if (pnls[i] < 0) consecLosses++
    else consecLosses = 0
    if (consecLosses >= 3) hitThreshold = true
    else if (hitThreshold) tradesAfterThreeLoss++
  }
  if (hitThreshold && tradesAfterThreeLoss > 0) {
    ruleFollowing -= Math.min(40, tradesAfterThreeLoss * 5)
  }
  ruleFollowing = clamp(ruleFollowing)

  // Emotional Control — % of trades that are NOT revenge/fomo/panic/oversize
  const clean = n - patterns.revengeTrades - patterns.fomoEntries - patterns.panicExits - patterns.oversizedTrades
  const emotionalControl = clamp((clean / n) * 100)

  const overall = clamp(
    entryQuality * 0.2 +
    exitTiming * 0.2 +
    positionSizing * 0.15 +
    ruleFollowing * 0.2 +
    emotionalControl * 0.25,
  )

  const dqs: DQS = {
    entryQuality: Math.round(entryQuality),
    exitTiming: Math.round(exitTiming),
    positionSizing: Math.round(positionSizing),
    ruleFollowing: Math.round(ruleFollowing),
    emotionalControl: Math.round(emotionalControl),
    overall: Math.round(overall),
  }

  /* ── Coaching points (code-generated) ── */
  const coachingPoints: string[] = []
  if (patterns.revengeTrades > 0) {
    coachingPoints.push(
      `${patterns.revengeTrades} revenge trade${patterns.revengeTrades > 1 ? 's' : ''} cost you ${fmtINR(revengeCost)} — your rule: walk away for 15 min after any loss > ₹500.`,
    )
  }
  if (patterns.overtradingDetected) {
    coachingPoints.push(
      `You took ${n} trades today — ~${Math.round(n / Math.max(1, avgDailyTrades) * 100 - 100)}% above your norm. Cap daily trades to ${Math.round(avgDailyTrades * 1.2)} to stay in flow.`,
    )
  }
  if (patterns.panicExits > 2) {
    coachingPoints.push(
      `${patterns.panicExits} panic exits bled ${fmtINR(panicCost)}. Give every trade at least 2 min unless the structure is invalidated.`,
    )
  }
  if (patterns.averagingDown > 0) {
    coachingPoints.push(
      `Averaging-down on losing trades cost ${fmtINR(averagingCost)}. Rule: add ONLY when the original thesis strengthens, never to reduce an unrealised loss.`,
    )
  }
  if (patterns.oversizedTrades > 0 && oversizeCost < 0) {
    coachingPoints.push(
      `Oversized positions cost ${fmtINR(oversizeCost)}. Your best trades today were at normal size — size doesn't fix a bad setup.`,
    )
  }
  if (patterns.disciplinedTrades >= n * 0.4) {
    coachingPoints.push(
      `${patterns.disciplinedTrades} disciplined trades today — that's your edge. Protect the ${patterns.disciplinedTrades}/${n} process, outcome will follow.`,
    )
  }
  if (cycleDetected) {
    coachingPoints.push(
      `A tilt-cycle was detected around trade ${cycleStages[0].tradeIndex + 1}. Next time you see 2 consecutive losses, close the terminal for 10 minutes.`,
    )
  }
  if (coachingPoints.length === 0) {
    coachingPoints.push(
      `Clean session. Net ${fmtINR(netPnl)} across ${n} trades with no major behavioural flags — bank the discipline, not just the P&L.`,
    )
  }

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
      revengeCost,
      fomoCost,
      panicCost,
      averagingCost,
      oversizeCost,
      mistakeTotalCost,
    },
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Short per-trade note (used on table rows + cards)                  */
/* ────────────────────────────────────────────────────────────────── */

function buildShortNote(trade: any, tag: TradeTag, reason: string, pnl: number): string {
  const sym = String(trade.symbol || '')
  const money = fmtINR(pnl)
  switch (tag) {
    case 'revenge':
      return `Revenge re-entry on ${sym}. ${money}. ${reason}`
    case 'fomo':
      return `FOMO entry on ${sym}. ${money}. ${reason}`
    case 'panic':
      return `Panic exit on ${sym}. ${money}. ${reason}`
    case 'averaging':
      return `Averaged down on ${sym}. ${money}. ${reason}`
    case 'oversize':
      return `Oversized on ${sym}. ${money}. ${reason}`
    case 'disciplined':
      return `Disciplined trade on ${sym}. ${money}. ${reason}`
    case 'win':
      return `Clean win on ${sym}. ${money}.`
    default:
      return `Loss on ${sym}. ${money}.`
  }
}

/* ────────────────────────────────────────────────────────────────── */

function emptyResult(): PatternResult {
  return {
    trades: [],
    patterns: {
      revengeTrades: 0, fomoEntries: 0, panicExits: 0, averagingDown: 0,
      oversizedTrades: 0, disciplinedTrades: 0, overtradingDetected: false,
    },
    coachingPoints: [],
    cycleDetected: false,
    cycleStages: [],
    dqs: { entryQuality: 0, exitTiming: 0, positionSizing: 0, ruleFollowing: 0, emotionalControl: 0, overall: 0 },
    meta: {
      totalTrades: 0, netPnl: 0, winCount: 0, lossCount: 0, winRate: 0,
      revengeCost: 0, fomoCost: 0, panicCost: 0, averagingCost: 0, oversizeCost: 0, mistakeTotalCost: 0,
    },
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* Legacy-format bridge                                                */
/* ────────────────────────────────────────────────────────────────── */
/**
 * Map our internal tags back to the legacy short codes expected by the
 * existing trade_analysis table and dashboard widgets:
 *   win, fomo, rvg, avg, pnc, vs
 * "vs" (vicious) is reserved for trades inside a detected cycle.
 */
export function toLegacyTag(tag: TradeTag, inCycle: boolean): { tag: string; label: string } {
  if (inCycle) return { tag: 'vs', label: 'Vicious Cycle' }
  switch (tag) {
    case 'revenge':   return { tag: 'rvg', label: 'Revenge Trade' }
    case 'fomo':      return { tag: 'fomo', label: 'FOMO Entry' }
    case 'panic':     return { tag: 'pnc', label: 'Panic Exit' }
    case 'averaging': return { tag: 'avg', label: 'Averaging Down' }
    case 'oversize':  return { tag: 'fomo', label: 'Oversized Position' } // closest legacy bucket
    case 'disciplined': return { tag: 'win', label: 'Disciplined Trade' }
    case 'win':       return { tag: 'win', label: 'Win' }
    default:          return { tag: 'win', label: 'Loss' } // legacy schema has no 'loss' bucket; UI uses pnl sign
  }
}

/**
 * Map our cycle stages to the legacy 10-stage labels used by BehavioralInsights.
 */
export function toLegacyCycleStage(tag: TradeTag): string {
  switch (tag) {
    case 'win':        return 'win'
    case 'disciplined': return 'win'
    case 'revenge':    return 'rvg'
    case 'fomo':       return 'fomo'
    case 'panic':      return 'pnc'
    case 'averaging':  return 'avg'
    case 'oversize':   return 'large'
    default:           return 'vs'
  }
}
