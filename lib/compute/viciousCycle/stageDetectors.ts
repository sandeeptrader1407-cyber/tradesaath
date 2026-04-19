/**
 * Module 2, Layer 3 — Vicious Cycle Stage Detectors.
 *
 * 10 independent stage detectors. Each examines ONE trade (with
 * limited context about the preceding trades in the session) and
 * answers: "does this trade look like stage X of a classic vicious
 * cycle?"  Returns a StageMatch with a score that the sequence
 * matcher uses to pick the best stage label when multiple match.
 *
 * NB: these detectors are independent of the 9-tag pattern layer —
 * they operate on enriched fields (size, holding, pnl, streaks) and
 * are tuned to catch the sequential *progression* of a cycle, not
 * the single-trade mistakes the pattern layer tags.
 */

import type { EnrichedTrade, SignalResult, ViciousCycleStageName } from '../types'
import { signal, timeToMinutes } from '../patterns/signals'

// ────────────────────────────────────────────────────────────
// Context bundle — assembled once per trade by sequenceMatcher.
// ────────────────────────────────────────────────────────────

export interface StageContext {
  previous: EnrichedTrade | null
  previous3: EnrichedTrade[] // at most 3 most-recent preceding trades
  allPreviousInSession: EnrichedTrade[]
  sessionAvgSize: number
  sessionAvgHoldingMinutes: number
  sessionAvgWinPnl: number // mean(pnl) over wins, >0
  sessionAvgLossPnl: number // mean(|pnl|) over losses, >0
}

export interface StageMatch {
  matches: boolean
  stageName: ViciousCycleStageName
  stageNumber: number
  signals: SignalResult[]
  description: string
  score: number // 0..1; used to break ties when >1 stage matches a trade
}

function noMatch(
  stageName: ViciousCycleStageName,
  stageNumber: number
): StageMatch {
  return {
    matches: false,
    stageName,
    stageNumber,
    signals: [],
    description: '',
    score: 0,
  }
}

function sumWeighted(signals: SignalResult[]): number {
  return signals.reduce((acc, s) => acc + s.weight * s.value, 0)
}

// ────────────────────────────────────────────────────────────
// Stage 1 — disciplined_win
// A clean, well-sized winning trade. Baseline "healthy" trade.
// Gates: isWin + not oversized + reasonable hold (not instant, not endless).
// ────────────────────────────────────────────────────────────

export function detectDisciplinedWin(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  if (!trade.isWin) return noMatch('disciplined_win', 1)

  const sizeRatio = Math.max(0, Number(trade.sizeVsSessionAvg) || 0)
  const dur = Number(trade.durationMinutes) || 0
  const avgHold = Math.max(1, ctx.sessionAvgHoldingMinutes)
  const holdMult = dur / avgHold

  // Not wildly oversized
  if (sizeRatio > 1.5) return noMatch('disciplined_win', 1)
  // Not an accidental instant scalp nor an all-session hold
  if (dur > 0 && (holdMult < 0.15 || holdMult > 3)) {
    return noMatch('disciplined_win', 1)
  }

  const signals: SignalResult[] = [
    signal('isWin', 0.4, 1, `win +${trade.pnl.toFixed(0)}`),
    signal(
      'reasonableSize',
      0.3,
      sizeRatio <= 1.2 ? 1 : 0.5,
      `size ${sizeRatio.toFixed(2)}× session avg`
    ),
    signal(
      'reasonableHold',
      0.3,
      dur > 0 && holdMult >= 0.3 && holdMult <= 2 ? 1 : 0.5,
      dur > 0 ? `held ${dur.toFixed(1)}min (${holdMult.toFixed(2)}× avg)` : 'no duration'
    ),
  ]

  return {
    matches: true,
    stageName: 'disciplined_win',
    stageNumber: 1,
    signals,
    description: `Disciplined win (+${trade.pnl.toFixed(0)}) with normal size and hold`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 2 — overconfidence
// After a recent win, size is creeping up (1.2×..2.0× session avg)
// but not yet oversized.  "Just a little more."
// ────────────────────────────────────────────────────────────

export function detectOverconfidence(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  const sizeRatio = Math.max(0, Number(trade.sizeVsSessionAvg) || 0)
  if (sizeRatio < 1.2 || sizeRatio >= 2.0) {
    return noMatch('overconfidence', 2)
  }

  // Previous trade (or one of last 3) was a win
  const recentWin =
    (ctx.previous?.isWin ?? false) ||
    ctx.previous3.some((t) => t.isWin)
  if (!recentWin) return noMatch('overconfidence', 2)

  // Not currently already oversized (reserved for stage 3)
  if (trade.isOversized) return noMatch('overconfidence', 2)

  const signals: SignalResult[] = [
    signal(
      'sizeCreep',
      0.5,
      Math.min(1, (sizeRatio - 1.2) / 0.8 + 0.3),
      `size ${sizeRatio.toFixed(2)}× session avg (creep zone)`
    ),
    signal(
      'recentWin',
      0.5,
      ctx.previous?.isWin ? 1 : 0.5,
      ctx.previous?.isWin
        ? `previous trade was a win (+${ctx.previous.pnl.toFixed(0)})`
        : 'win within last 3 trades'
    ),
  ]

  return {
    matches: true,
    stageName: 'overconfidence',
    stageNumber: 2,
    signals,
    description: `Overconfidence — size creeping to ${sizeRatio.toFixed(2)}× after a recent win`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 3 — oversized_position
// isOversized or sizeRatio >= 2.0. Way too big for this session.
// ────────────────────────────────────────────────────────────

export function detectOversizedPosition(
  trade: EnrichedTrade,
  _ctx: StageContext
): StageMatch {
  const sizeRatio = Math.max(0, Number(trade.sizeVsSessionAvg) || 0)
  const fired = trade.isOversized || sizeRatio >= 2.0
  if (!fired) return noMatch('oversized_position', 3)

  const signals: SignalResult[] = [
    signal(
      'oversized',
      0.6,
      trade.isOversized ? 1 : 0.8,
      `size ${sizeRatio.toFixed(2)}× session avg (oversized flag=${trade.isOversized})`
    ),
    signal(
      'sizeMagnitude',
      0.4,
      Math.min(1, (sizeRatio - 2.0) / 1.0 + 0.5),
      `qty=${trade.qty}`
    ),
  ]

  return {
    matches: true,
    stageName: 'oversized_position',
    stageNumber: 3,
    signals,
    description: `Oversized position — ${sizeRatio.toFixed(2)}× session avg size`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 4 — market_reversal
// Trade that is a loss AND was held long enough that the market
// clearly moved against the entry (held ≥ avg holding, not a
// quick-stop). Indicates you sat through a reversal.
// ────────────────────────────────────────────────────────────

export function detectMarketReversal(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  if (!trade.isLoss) return noMatch('market_reversal', 4)
  const dur = Number(trade.durationMinutes) || 0
  const avgHold = Math.max(1, ctx.sessionAvgHoldingMinutes)
  const holdMult = dur / avgHold

  // Must have held at least ~0.8× avg to count as "sat through reversal"
  if (holdMult < 0.8) return noMatch('market_reversal', 4)

  const lossPct = Math.abs(Number(trade.pnlAsPercentOfCapital) || 0)
  // Meaningful loss size (>= 0.5% of capital already enforced by isLoss,
  // but we weight bigger reversals higher).
  const signals: SignalResult[] = [
    signal(
      'heldThroughReversal',
      0.5,
      Math.min(1, holdMult / 2),
      `held ${dur.toFixed(1)}min (${holdMult.toFixed(2)}× avg)`
    ),
    signal(
      'reversalLoss',
      0.5,
      Math.min(1, lossPct / 2),
      `loss ${lossPct.toFixed(2)}% of capital`
    ),
  ]

  return {
    matches: true,
    stageName: 'market_reversal',
    stageNumber: 4,
    signals,
    description: `Market reversal — held ${dur.toFixed(1)}min into a ${lossPct.toFixed(2)}% loss`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 5 — hope_and_hold
// Loser held >1.5× session avg holding time. "It'll come back."
// Overlap with market_reversal is intentional — stage 5 is a stronger
// version (longer hold); sequenceMatcher resolves by score.
// ────────────────────────────────────────────────────────────

export function detectHopeAndHold(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  if (!trade.isLoss) return noMatch('hope_and_hold', 5)
  const dur = Number(trade.durationMinutes) || 0
  const avgHold = Math.max(1, ctx.sessionAvgHoldingMinutes)
  const holdMult = dur / avgHold

  if (holdMult < 1.5) return noMatch('hope_and_hold', 5)

  const signals: SignalResult[] = [
    signal(
      'excessiveHold',
      0.6,
      Math.min(1, (holdMult - 1.5) / 1.5 + 0.5),
      `held ${dur.toFixed(1)}min = ${holdMult.toFixed(2)}× avg`
    ),
    signal(
      'loserHeld',
      0.4,
      1,
      `loss ${trade.pnl.toFixed(0)}`
    ),
  ]

  return {
    matches: true,
    stageName: 'hope_and_hold',
    stageNumber: 5,
    signals,
    description: `Hope-and-hold — loser held ${holdMult.toFixed(2)}× longer than average`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 6 — averaging_down
// BUY on same symbol as a recent BUY at a lower price (adding to
// loser). Detects either via detectedTag='averaging' OR same-symbol
// BUY at strictly lower entry price vs previous BUY in session.
// ────────────────────────────────────────────────────────────

export function detectAveragingDown(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  const side = String(trade.side || '').toUpperCase()
  if (side !== 'BUY') return noMatch('averaging_down', 6)

  // Fast path: pattern layer already tagged this
  if (trade.detectedTag === 'averaging') {
    const signals: SignalResult[] = [
      signal('patternLayerAveraging', 1, 1, 'pattern layer tagged as averaging'),
    ]
    return {
      matches: true,
      stageName: 'averaging_down',
      stageNumber: 6,
      signals,
      description: 'Averaging down — added to a losing position',
      score: sumWeighted(signals),
    }
  }

  // Fallback: find the most recent BUY on same symbol in this session
  const price = Number(trade.entryPrice) || 0
  if (price <= 0) return noMatch('averaging_down', 6)
  let lastBuy: EnrichedTrade | null = null
  for (let i = ctx.allPreviousInSession.length - 1; i >= 0; i--) {
    const p = ctx.allPreviousInSession[i]
    if (
      String(p.side || '').toUpperCase() === 'BUY' &&
      String(p.symbol) === String(trade.symbol) &&
      Number(p.entryPrice) > 0
    ) {
      lastBuy = p
      break
    }
  }
  if (!lastBuy) return noMatch('averaging_down', 6)
  if (price >= Number(lastBuy.entryPrice)) {
    return noMatch('averaging_down', 6)
  }

  const drop = ((Number(lastBuy.entryPrice) - price) / Number(lastBuy.entryPrice)) * 100
  const signals: SignalResult[] = [
    signal('sameSymbolBuy', 0.4, 1, `same symbol ${trade.symbol} on BUY side`),
    signal(
      'lowerPrice',
      0.6,
      Math.min(1, drop / 2),
      `price ${price} vs prior BUY ${lastBuy.entryPrice} (${drop.toFixed(2)}% lower)`
    ),
  ]

  return {
    matches: true,
    stageName: 'averaging_down',
    stageNumber: 6,
    signals,
    description: `Averaging down — bought ${trade.symbol} at ${drop.toFixed(2)}% below prior BUY`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 7 — panic_exit
// Loser exited very fast: durationMinutes < 0.3× sessionAvg.
// (If session avg is unknown, fall back to scalp holding category.)
// ────────────────────────────────────────────────────────────

export function detectPanicExit(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  if (!trade.isLoss) return noMatch('panic_exit', 7)

  const dur = Number(trade.durationMinutes) || 0
  const avgHold = ctx.sessionAvgHoldingMinutes
  let fired = false
  let detail = ''
  if (avgHold > 0 && dur > 0) {
    if (dur / avgHold < 0.3) {
      fired = true
      detail = `held ${dur.toFixed(1)}min vs session avg ${avgHold.toFixed(1)}min`
    }
  } else if (trade.holdingCategory === 'scalp') {
    fired = true
    detail = `scalp-category loser (${dur.toFixed(1)}min)`
  }
  if (!fired) return noMatch('panic_exit', 7)

  // Extra weight if pattern layer flagged as panic
  const patternBoost = trade.detectedTag === 'panic' ? 1 : 0

  const signals: SignalResult[] = [
    signal('quickExitOnLoser', 0.7, 1, detail),
    signal(
      'patternLayerPanic',
      0.3,
      patternBoost,
      patternBoost ? 'pattern layer tagged panic' : 'no pattern-layer panic'
    ),
  ]

  return {
    matches: true,
    stageName: 'panic_exit',
    stageNumber: 7,
    signals,
    description: `Panic exit — loser dumped after ${dur.toFixed(1)}min`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 8 — revenge_trade
// Previous trade was a loss + this trade entered quickly + size
// is elevated (≥ 1.2× session avg) + often same symbol.
// ────────────────────────────────────────────────────────────

export function detectRevengeTrade(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  const prev = ctx.previous
  if (!prev || !prev.isLoss) return noMatch('revenge_trade', 8)

  const gap = Number(trade.timeSincePreviousTrade) || 0
  if (gap > 10) return noMatch('revenge_trade', 8)

  const sizeRatio = Math.max(0, Number(trade.sizeVsSessionAvg) || 0)
  // Size elevated OR explicitly oversized
  if (sizeRatio < 1.2 && !trade.isOversized) {
    return noMatch('revenge_trade', 8)
  }

  const sameSymbol = String(trade.symbol) === String(prev.symbol)
  const patternBoost = trade.detectedTag === 'revenge' ? 1 : 0

  const signals: SignalResult[] = [
    signal('quickReentryAfterLoss', 0.4, 1, `${gap}min after a loser`),
    signal(
      'sizeElevated',
      0.3,
      Math.min(1, (sizeRatio - 1.2) / 0.8 + 0.5),
      `size ${sizeRatio.toFixed(2)}× session avg`
    ),
    signal(
      'sameSymbol',
      0.15,
      sameSymbol ? 1 : 0,
      sameSymbol ? `same symbol ${trade.symbol}` : `different symbol`
    ),
    signal(
      'patternLayerRevenge',
      0.15,
      patternBoost,
      patternBoost ? 'pattern layer tagged revenge' : 'no pattern-layer revenge'
    ),
  ]

  return {
    matches: true,
    stageName: 'revenge_trade',
    stageNumber: 8,
    signals,
    description: `Revenge trade — re-entered ${gap}min after a loss at ${sizeRatio.toFixed(2)}× size`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 9 — tilt
// ≥3 consecutive losses ending at or just before this trade AND
// erratic size/symbol vs earlier in session. Emotional random
// trading.
// ────────────────────────────────────────────────────────────

export function detectTilt(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  // Either currently in a 3+ loss streak, or came from one
  const inLossStreak = (Number(trade.consecutiveLosses) || 0) >= 3
  const prevLossStreak = ctx.previous
    ? (Number(ctx.previous.consecutiveLosses) || 0) >= 3
    : false
  if (!inLossStreak && !prevLossStreak) return noMatch('tilt', 9)

  // Erratic: size swing vs previous OR symbol change
  const prev = ctx.previous
  const sizePrev = prev ? Number(prev.sizeVsSessionAvg) || 1 : 1
  const sizeNow = Number(trade.sizeVsSessionAvg) || 1
  const sizeSwing = Math.abs(sizeNow - sizePrev)
  const symbolChanged = prev
    ? String(prev.symbol) !== String(trade.symbol)
    : false

  // Require at least one erratic indicator, otherwise it's just a losing streak
  if (sizeSwing < 0.5 && !symbolChanged) return noMatch('tilt', 9)

  const signals: SignalResult[] = [
    signal(
      'lossStreak',
      0.5,
      Math.min(1, (Number(trade.consecutiveLosses) || 0) / 5),
      `${trade.consecutiveLosses} consecutive losses`
    ),
    signal(
      'erraticSize',
      0.3,
      Math.min(1, sizeSwing / 2),
      `size swung ${sizeSwing.toFixed(2)} from previous`
    ),
    signal(
      'symbolHopping',
      0.2,
      symbolChanged ? 1 : 0,
      symbolChanged ? `switched ${prev?.symbol}→${trade.symbol}` : 'same symbol'
    ),
  ]

  return {
    matches: true,
    stageName: 'tilt',
    stageNumber: 9,
    signals,
    description: `Tilt — erratic trade within a ${trade.consecutiveLosses}-loss streak`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// Stage 10 — fomo_reentry
// Re-entered the same (or a trending) symbol shortly after exiting,
// chasing a move.  Heuristic: previous trade was also this side
// (BUY after a previous BUY exit) within 15min AND pattern-layer
// fomo OR big move since exit.
// ────────────────────────────────────────────────────────────

export function detectFomoReentry(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch {
  const prev = ctx.previous
  if (!prev) return noMatch('fomo_reentry', 10)

  const gap = Number(trade.timeSincePreviousTrade) || 0
  if (gap > 15) return noMatch('fomo_reentry', 10)

  const sameSide =
    String(prev.side || '').toUpperCase() ===
    String(trade.side || '').toUpperCase()
  const sameSymbol = String(prev.symbol) === String(trade.symbol)

  // Must be re-entering same instrument OR have explicit fomo tag
  const patternFomo = trade.detectedTag === 'fomo'
  if (!(sameSymbol && sameSide) && !patternFomo) {
    return noMatch('fomo_reentry', 10)
  }

  // Compare entry price to previous exit — chasing means entering
  // worse (for BUY → price went up; for SELL → price went down)
  const prevExit = Number(prev.exitPrice) || 0
  const entry = Number(trade.entryPrice) || 0
  let chase = 0
  let detail = `re-entered ${gap}min after previous exit`
  if (prevExit > 0 && entry > 0) {
    if (String(trade.side).toUpperCase() === 'BUY' && entry > prevExit) {
      chase = Math.min(1, ((entry - prevExit) / prevExit) * 50) // 2% = 1.0
      detail = `bought at ${entry} vs prior exit ${prevExit} (+${(((entry - prevExit) / prevExit) * 100).toFixed(2)}%)`
    } else if (String(trade.side).toUpperCase() === 'SELL' && entry < prevExit) {
      chase = Math.min(1, ((prevExit - entry) / prevExit) * 50)
      detail = `sold at ${entry} vs prior exit ${prevExit} (-${(((prevExit - entry) / prevExit) * 100).toFixed(2)}%)`
    }
  }

  const signals: SignalResult[] = [
    signal(
      'quickReentrySameInstrument',
      0.5,
      sameSymbol && sameSide ? 1 : 0.4,
      sameSymbol && sameSide
        ? `${trade.symbol} ${trade.side} again within ${gap}min`
        : 'different instrument (pattern-layer fomo)'
    ),
    signal(
      'chasedMove',
      0.3,
      chase,
      detail
    ),
    signal(
      'patternLayerFomo',
      0.2,
      patternFomo ? 1 : 0,
      patternFomo ? 'pattern layer tagged fomo' : 'no pattern-layer fomo'
    ),
  ]

  return {
    matches: true,
    stageName: 'fomo_reentry',
    stageNumber: 10,
    signals,
    description: `FOMO re-entry — ${detail}`,
    score: sumWeighted(signals),
  }
}

// ────────────────────────────────────────────────────────────
// All-detectors pipeline — run every stage detector against a
// single trade and return the matches (unfiltered).
// ────────────────────────────────────────────────────────────

export const STAGE_DETECTORS: Array<{
  name: ViciousCycleStageName
  number: number
  fn: (trade: EnrichedTrade, ctx: StageContext) => StageMatch
}> = [
  { name: 'disciplined_win', number: 1, fn: detectDisciplinedWin },
  { name: 'overconfidence', number: 2, fn: detectOverconfidence },
  { name: 'oversized_position', number: 3, fn: detectOversizedPosition },
  { name: 'market_reversal', number: 4, fn: detectMarketReversal },
  { name: 'hope_and_hold', number: 5, fn: detectHopeAndHold },
  { name: 'averaging_down', number: 6, fn: detectAveragingDown },
  { name: 'panic_exit', number: 7, fn: detectPanicExit },
  { name: 'revenge_trade', number: 8, fn: detectRevengeTrade },
  { name: 'tilt', number: 9, fn: detectTilt },
  { name: 'fomo_reentry', number: 10, fn: detectFomoReentry },
]

export function runAllStageDetectors(
  trade: EnrichedTrade,
  ctx: StageContext
): StageMatch[] {
  return STAGE_DETECTORS.map((d) => d.fn(trade, ctx)).filter(
    (m) => m.matches
  )
}

// unused import guard — keep for future signals that parse times
void timeToMinutes
