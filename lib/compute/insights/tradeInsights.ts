/**
 * Module 2, Layer 7 — Per-trade insights (code, no AI).
 *
 * One TradeInsight per EnrichedTrade. First matching rule wins:
 *
 *   1. Mistake tag (revenge/averaging/fomo/panic/overtrading/
 *      oversize/late_exit) → uses DetectedPattern.description;
 *      severity from tagCost magnitude.
 *   2. Disciplined win (detectedTag === 'disciplined' | 'win') →
 *      "Clean execution" line, severity 'positive'.
 *   3. Cycle stage → stage name & number, severity 'warning'.
 *   4. Breakeven → severity 'info'.
 *   5. Default → Loss/Profit line, severity from win/loss.
 *
 * Highlights are short tokens (money / size / time / tag) in the
 * order: money first, then size, then time, then tag.
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  PatternTag,
  TradeInsight,
} from '../types'
import { formatCurrency } from '../../utils/currency'

const MISTAKE_TAGS: ReadonlySet<PatternTag> = new Set<PatternTag>([
  'revenge',
  'averaging',
  'fomo',
  'panic',
  'overtrading',
  'oversize',
  'late_exit',
])

const TAG_LABELS: Record<PatternTag, string> = {
  revenge: 'Revenge trade',
  averaging: 'Averaging down',
  fomo: 'FOMO entry',
  panic: 'Panic exit',
  overtrading: 'Overtrading',
  oversize: 'Oversized',
  late_exit: 'Late exit',
  disciplined: 'Disciplined',
  win: 'Win',
}

const STAGE_LABEL: Record<string, string> = {
  disciplined_win: 'Disciplined win',
  overconfidence: 'Overconfidence',
  oversized_position: 'Oversized position',
  market_reversal: 'Market reversal',
  hope_and_hold: 'Hope and hold',
  averaging_down: 'Averaging down',
  panic_exit: 'Panic exit',
  revenge_trade: 'Revenge trade',
  tilt: 'Tilt',
  fomo_reentry: 'FOMO re-entry',
}

function holdingLabel(t: EnrichedTrade): string {
  const dur = Number(t.durationMinutes) || 0
  if (t.holdingCategory === 'scalp') {
    if (dur < 1) return `Scalp (${Math.round(dur * 60)}s)`
    return `Scalp (${dur.toFixed(1)}m)`
  }
  if (t.holdingCategory === 'quick') return `Quick (${Math.round(dur)}m)`
  if (t.holdingCategory === 'normal') return `Held ${Math.round(dur)}m`
  if (t.holdingCategory === 'extended') {
    return `Extended (${(dur / 60).toFixed(1)}h)`
  }
  return `Positional (${(dur / 60).toFixed(1)}h)`
}

function sizeLabel(t: EnrichedTrade): string {
  const s = Number(t.sizeVsSessionAvg) || 1
  if (s >= 1.5) return `${s.toFixed(1)}x avg size`
  if (s <= 0.5) return 'Undersized'
  return 'Normal size'
}

function moneyLabel(pnl: number): string {
  return formatCurrency(pnl, 'INR', { signed: true })
}

function tagSeverityFromCost(cost: number): 'warning' | 'critical' {
  // Anything costing more than 2,000 in "excess loss" is flagged as
  // critical. 2000 INR is a rough threshold — tune once real user data
  // is flowing. Below that, a mistake is still a warning.
  return Math.abs(Number(cost) || 0) >= 2000 ? 'critical' : 'warning'
}

export function buildTradeInsights(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[]
): TradeInsight[] {
  if (trades.length === 0) return []
  const patternByIndex = new Map<number, DetectedPattern>()
  for (const p of patterns) {
    patternByIndex.set(Number(p.tradeIndex) || 0, p)
  }

  const out: TradeInsight[] = []
  for (const t of trades) {
    const idx = Number(t.tradeIndex) || 0
    const pnl = Number(t.pnl) || 0
    const highlights: string[] = []
    let insight = ''
    let severity: TradeInsight['severity'] = 'info'

    const tag = t.detectedTag
    const pattern = patternByIndex.get(idx)

    // Rule 1: mistake tag
    if (tag && MISTAKE_TAGS.has(tag)) {
      insight = pattern?.description || `${TAG_LABELS[tag]} detected.`
      severity = tagSeverityFromCost(Number(t.tagCost) || 0)
      highlights.push(moneyLabel(pnl))
      highlights.push(sizeLabel(t))
      highlights.push(holdingLabel(t))
      highlights.push(TAG_LABELS[tag])
    }
    // Rule 2: disciplined / win
    else if (tag === 'disciplined' || tag === 'win') {
      insight = `Clean execution. ${moneyLabel(pnl)} profit, ${t.holdingCategory} trade.`
      severity = 'positive'
      highlights.push(moneyLabel(pnl))
      highlights.push(holdingLabel(t))
      highlights.push(sizeLabel(t))
    }
    // Rule 3: cycle stage
    else if (t.cycleStageName) {
      const stageNum = Number(t.cycleStageNumber) || 0
      const stageLabel = STAGE_LABEL[t.cycleStageName] || t.cycleStageName
      insight = `Stage ${stageNum} of emotional cycle: ${stageLabel}.`
      severity = 'warning'
      highlights.push(stageLabel)
      highlights.push(moneyLabel(pnl))
    }
    // Rule 4: breakeven
    else if (t.isBreakeven) {
      const ep = Number(t.entryPrice) || 0
      const xp = Number(t.exitPrice) || 0
      insight = `Breakeven. Entry ${ep}, exit ${xp}.`
      severity = 'info'
      highlights.push(moneyLabel(pnl))
      highlights.push(holdingLabel(t))
    }
    // Rule 5: default
    else {
      if (pnl > 0) {
        insight = `Profit of ${moneyLabel(pnl)}.`
        severity = 'positive'
      } else if (pnl < 0) {
        insight = `Loss of ${moneyLabel(pnl)}.`
        severity = 'warning'
      } else {
        insight = `No P&L.`
        severity = 'info'
      }
      highlights.push(moneyLabel(pnl))
      highlights.push(holdingLabel(t))
      highlights.push(sizeLabel(t))
    }

    out.push({ tradeIndex: idx, insight, highlights, severity })
  }
  return out
}
