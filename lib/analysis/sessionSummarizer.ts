/**
 * TradeSaath — Session summarizer (v3.1)
 * -------------------------------------------------
 * Takes a PatternResult (from patternDetector) + the raw session row and
 * produces the full `analysis` JSONB object that the dashboard widgets expect.
 *
 * Key rules:
 *   - ONE tag per trade (enforced by patternDetector).
 *   - Mistake cost = excess over sessionAvgLoss baseline (positive values).
 *   - DQS has 7 explicit measurable factors summing to 100%.
 *   - Grades: A 80+, B 65-79, C 45-64, D 25-44, F <25.
 *   - The generic catch-all "loss" label is NOT a category. Never emitted.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PatternResult, DetectedTrade } from './patternDetector'
import { toLegacyTag, toLegacyCycleStage, MISTAKE_TAGS } from './patternDetector'

function fmtINR(n: number): string {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(Math.round(n))
  return `${sign}₹${a.toLocaleString('en-IN')}`
}

/* ────────────────────────────────────────────────────────────────── */
/* Per-trade legacy row (matches trade_analysis table schema)         */
/* ────────────────────────────────────────────────────────────────── */

export interface LegacyTradeAnalysis {
  trade_index: number
  tag: string
  tag_label: string
  quick_summary: string
  technical_analysis: string
  psychology_coaching: string
  counterfactual: string
  cycle_stage: string
}

export function buildLegacyTradeAnalyses(
  trades: any[],
  result: PatternResult,
): LegacyTradeAnalysis[] {
  const cycleIndices = new Set(result.cycleStages.map(s => s.tradeIndex))
  return result.trades.map((d: DetectedTrade) => {
    const t = trades[d.index] || {}
    const legacy = toLegacyTag(d.tag, cycleIndices.has(d.index))
    return {
      trade_index: d.index,
      tag: legacy.tag,
      tag_label: legacy.label,
      quick_summary: `${d.tagLabel} on ${t.symbol || 'symbol'} — ${fmtINR(d.pnl)}`,
      technical_analysis: buildTechnical(t, d),
      psychology_coaching: buildPsychology(d),
      counterfactual: buildCounterfactual(t, d),
      cycle_stage: toLegacyCycleStage(d.tag),
    }
  })
}

function buildTechnical(trade: any, d: DetectedTrade): string {
  const sym = String(trade.symbol || 'this symbol')
  const side = String(trade.side || '').toUpperCase()
  const entry = trade.entry ?? trade.entry_price ?? trade.price
  const timeVal = trade.time ?? trade.entry_time
  const ts = timeVal ? ` at ${timeVal}` : ''
  const base = `${side || 'Trade'} on ${sym}${ts}${entry ? ` @ ₹${entry}` : ''}.`

  const me = trade._marketEnrichment as {
    trendAtEntry?: string
    entryContext?: string
    exitContext?: string
  } | undefined

  const marketLine = [me?.entryContext, me?.exitContext].filter(Boolean).join(' ')

  const tagLine = (() => {
    switch (d.tag) {
      case 'revenge':
        return me?.trendAtEntry === 'counter_trend'
          ? `Entry came right after a prior loss and against the short-term trend — reactive and directionally wrong.`
          : `Entry came right after a prior loss in the same instrument — reactive, not structural.`
      case 'panic':
        return me?.exitContext?.includes('favour')
          ? `Exit happened before the thesis played out — and price confirmed your original direction afterwards.`
          : `Exit happened before the thesis had time to develop — the chart hadn't invalidated the setup.`
      case 'averaging':   return `Added to a losing position on ${sym} rather than waiting for confirmation of reversal.`
      case 'fomo':        return `Entry timing and/or size suggests the trade was driven by fear of missing a move rather than a defined setup.`
      case 'overtrading': return `This was trade #${d.index + 1} — past the fatigue threshold. Decision quality decays here.`
      case 'oversize':    return `Position size is well above your typical — single-trade variance dominates, not skill.`
      case 'late_exit':   return `Held far past your average holding time and the loss compounded.`
      case 'disciplined': return `Entry taken in your high-probability window with normal size. This is the process that compounds.`
      case 'win':         return d.pnl >= 0 ? `Clean execution against the plan.` : `Setup didn't work out — no behavioural flag.`
      default:            return null
    }
  })()

  return [base, marketLine, tagLine].filter(Boolean).join(' ')
}

function buildPsychology(d: DetectedTrade): string {
  switch (d.tag) {
    case 'revenge':     return `I know losing hurts — loss aversion screams for immediate recovery. Re-entering hot is tilt, not trading. Rule: 15-minute break after any loss exceeding your session average.`
    case 'averaging':   return `I know 'lowering the average' feels rational — that's sunk-cost fallacy dressed up as strategy. Add only on confirmation, never on hope.`
    case 'fomo':        return `I know watching others make money while you sit out is painful. But chasing after the move has started means you pay premium and eat the reversal. Wait for your setup.`
    case 'panic':       return `I know the red candle felt like the start of a disaster — that's recency bias amplifying a single bar. Set an invalidation level, not a fear level.`
    case 'overtrading': return `I know the urge to 'make today count' is strong after N trades — but every trade past your norm is lower-quality than the last. Volume is not edge.`
    case 'oversize':    return `I know when conviction is high you want to press — a 2× position on a setup no better than usual is overconfidence bias. Edge is in selection, not sizing.`
    case 'late_exit':   return `I know closing a losing trade feels like admitting defeat. Hope is not a stop-loss. Honour your invalidation level on the chart, not your emotion.`
    case 'disciplined': return `This is what I'd repeat tomorrow. Right setup, right size, right window. Outcome aside, the process is right — bank this feeling.`
    case 'win':         return d.pnl >= 0
      ? `Clean win. Don't let it seed overconfidence — every next setup still needs to stand on its own.`
      : `A controlled loss is part of the business. No bias flagged — just the variance tax for playing with an edge.`
  }
}

function buildCounterfactual(trade: any, d: DetectedTrade): string {
  const pnl = d.pnl
  const lossAbs = fmtINR(Math.abs(pnl))
  const costAbs = fmtINR(Math.abs(d.cost))
  switch (d.tag) {
    case 'revenge': {
      const me = (trade as any)._marketEnrichment
      if (me?.trendAtEntry === 'counter_trend') {
        return `Right action: take the ${lossAbs} loss, step away for 15 min. You re-entered against the trend — two strikes at once.`
      }
      return `Right action: take the ${lossAbs} loss, close the terminal for 15 minutes. The avoidable excess here was ${costAbs}.`
    }
    case 'averaging':   return `Right action: take the first loss and walk. Averaging added ${costAbs} beyond the baseline loss.`
    case 'fomo':        return `Right action: skip. Wait for a pullback. Skipping would have saved ${costAbs} beyond your average loss.`
    case 'panic': {
      const me = (trade as any)._marketEnrichment
      if (me?.postExitMove?.direction === 'reversed') {
        return `Right action: honour the stop, not the fear. Price moved ${me.postExitMove.magnitude.toFixed(1)}% in your favour after you exited — your setup was right, your nerve wasn't.`
      }
      return `Right action: honour the stop, not the fear. Exiting at real invalidation would have saved ${costAbs}.`
    }
    case 'overtrading': return `Right action: stop at your daily cap. Trades past the cap cost ${costAbs} beyond baseline.`
    case 'oversize':    return `Right action: normal size. Same setup at 1× would have cost ~${fmtINR(pnl / 2)} — same process, half the damage.`
    case 'late_exit':   return `Right action: exit at your planned invalidation. Holding cost ${costAbs} beyond baseline.`
    case 'disciplined': return `No change needed. Keep running this exact process.`
    case 'win':         return d.pnl >= 0
      ? `Nothing to change — setup and execution both worked. Book it.`
      : `Stop was fine, setup didn't work. No counterfactual — cost of doing business.`
  }
}

/* ────────────────────────────────────────────────────────────────── */

export function generateSessionSummary(session: any, r: PatternResult): string {
  const date = session.trade_date || ''
  const mktTrend: string | undefined = session.market_context?.sessionTrend
  const trendPhrase = mktTrend === 'strongly_up'   ? 'a strongly trending-up session'
    : mktTrend === 'up'             ? 'a broadly rising session'
    : mktTrend === 'strongly_down'  ? 'a strongly downtrending session'
    : mktTrend === 'down'           ? 'a declining session'
    : mktTrend === 'flat'           ? 'a range-bound session'
    : null
  const n = r.meta.totalTrades
  const pnl = r.meta.netPnl
  const wr = r.meta.winRate.toFixed(1)
  const bits: string[] = []

  bits.push(`You traded ${n} time${n === 1 ? '' : 's'}${date ? ' on ' + date : ''}. Net P&L: ${fmtINR(pnl)}. Win rate: ${wr}%.`)

  if (trendPhrase) {
    bits.push(`Market context: ${trendPhrase} (index moved ${session.market_context?.totalRangePercent?.toFixed(1) || '?'}% range).`)
  }

  if (r.meta.mistakeTotalCost > 0) {
    bits.push(`Behavioural excess cost ${fmtINR(r.meta.mistakeTotalCost)} above your baseline loss — that's the leak to plug first.`)
  }
  if (r.patterns.revengeTrades > 0) bits.push(`${r.patterns.revengeTrades} revenge trade${r.patterns.revengeTrades > 1 ? 's' : ''} (excess ${fmtINR(r.meta.revengeCost)}).`)
  if (r.patterns.panicExits > 0) bits.push(`${r.patterns.panicExits} panic exit${r.patterns.panicExits > 1 ? 's' : ''} (excess ${fmtINR(r.meta.panicCost)}).`)
  if (r.patterns.averagingDown > 0) bits.push(`${r.patterns.averagingDown} averaging-down trade${r.patterns.averagingDown > 1 ? 's' : ''} (excess ${fmtINR(r.meta.averagingCost)}).`)
  if (r.patterns.lateExits > 0) bits.push(`${r.patterns.lateExits} late exit${r.patterns.lateExits > 1 ? 's' : ''} (excess ${fmtINR(r.meta.lateExitCost)}).`)
  if (r.patterns.overtradingDetected) bits.push(`Volume was high — overtrading detected.`)
  if (r.patterns.disciplinedTrades >= Math.max(3, n * 0.3)) bits.push(`On the upside: ${r.patterns.disciplinedTrades} disciplined trades show your process is there when you use it.`)
  if (r.cycleDetected) bits.push(`A tilt-cycle was detected — see the behavioural breakdown.`)

  return bits.join(' ')
}

export function generateRules(r: PatternResult): string[] {
  const rules: string[] = []
  if (r.patterns.revengeTrades > 0 || r.cycleDetected) rules.push('After any loss exceeding your session average, step away for 15 minutes before the next entry.')
  if (r.patterns.overtradingDetected) rules.push(`Cap total trades today at ${Math.max(10, Math.round(r.meta.totalTrades / 1.5))}; anything more is volume, not edge.`)
  if (r.patterns.fomoEntries > 0) rules.push('No entries in the first 3 minutes of the open; wait for first structure to form.')
  if (r.patterns.panicExits > 1) rules.push('Every trade must be held until either your stop or your target prints — 2-minute exits are banned.')
  if (r.patterns.averagingDown > 0) rules.push('Never add to a losing trade. Add only on confirmation of the original thesis.')
  if (r.patterns.oversizedTrades > 0) rules.push('Max position size today = your session median. No single trade can dominate the P&L.')
  if (r.patterns.lateExits > 0) rules.push('Honour the chart-based invalidation, not hope. Pre-set a stop before every entry.')
  while (rules.length < 3) {
    const fillers = [
      'Write the setup, size, and stop BEFORE each entry — if any one is unclear, skip the trade.',
      'Review today\'s best trade at end-of-day and repeat ONLY that setup tomorrow.',
      'Close the terminal at your pre-set stop-loss for the day, no exceptions.',
    ]
    for (const f of fillers) if (rules.length < 3 && !rules.includes(f)) rules.push(f)
  }
  return rules.slice(0, 3)
}

/* ────────────────────────────────────────────────────────────────── */

export interface AnalysisJSON {
  session_summary: string
  momentum_indicators: { name: string; score: number; description: string }[]
  vicious_cycle: { stage: string; count: number; icon: string; description: string }[]
  technical_insights: { name: string; score: number; description: string }[]
  dqs: {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    factors: { name: string; score: number; color: string; weight: number }[]
  }
  financial_impact: {
    total_lost_to_mistakes: number
    potential_pnl_without_mistakes: number
    message: string
  }
  mistake_patterns: { name: string; icon: string; count: number; cost: number; frequency: string }[]
  rules_for_next_session: string[]
  cross_user_insight: string
  trade_analyses: LegacyTradeAnalysis[]
  coaching_points: string[]
  analysed_at: string
  analysed_version: number
  ai_coaching?: string
  validation?: { ok: boolean; warnings: string[] }
}

export function buildAnalysisJSON(session: any, r: PatternResult, aiCoaching?: string): AnalysisJSON {
  const total = Math.max(1, r.meta.totalTrades)

  const momentum = [
    { name: 'Win Rate',           score: Math.round(r.meta.winRate),      description: `${r.meta.winCount} wins, ${r.meta.lossCount} losses` },
    { name: 'Emotional Control',  score: r.dqs.emotionalControl,          description: `Clean of tilt tags` },
    { name: 'Rule Following',     score: r.dqs.ruleFollowing,             description: r.patterns.overtradingDetected ? 'Overtrading detected' : 'Within daily volume' },
  ]

  const technical = [
    { name: 'Entry Quality',      score: r.dqs.entryQuality,              description: 'Entries in high-probability window' },
    { name: 'Exit Timing',        score: r.dqs.exitTiming,                description: `${total - r.patterns.panicExits - r.patterns.lateExits}/${total} clean exits` },
    { name: 'Position Sizing',    score: r.dqs.positionSizing,            description: r.patterns.oversizedTrades > 0 ? 'Inconsistent sizing' : 'Consistent sizing' },
  ]

  // 7 factors with explicit weights (summing to 100%)
  const dqsFactors = [
    { name: 'Risk Management',   score: r.dqs.riskManagement,   color: colorFor(r.dqs.riskManagement),   weight: 25 },
    { name: 'Emotional Control', score: r.dqs.emotionalControl, color: colorFor(r.dqs.emotionalControl), weight: 20 },
    { name: 'Position Sizing',   score: r.dqs.positionSizing,   color: colorFor(r.dqs.positionSizing),   weight: 15 },
    { name: 'Exit Discipline',   score: r.dqs.exitDiscipline,   color: colorFor(r.dqs.exitDiscipline),   weight: 15 },
    { name: 'Entry Quality',     score: r.dqs.entryQuality,     color: colorFor(r.dqs.entryQuality),     weight: 10 },
    { name: 'Exit Timing',       score: r.dqs.exitTiming,       color: colorFor(r.dqs.exitTiming),       weight: 10 },
    { name: 'Rule Following',    score: r.dqs.ruleFollowing,    color: colorFor(r.dqs.ruleFollowing),    weight: 5 },
  ]

  const viciousCycle = [
    { stage: 'Win',             count: r.meta.winCount,               icon: '🟢', description: 'Clean wins' },
    { stage: 'Overconfidence',  count: Math.min(r.patterns.fomoEntries, r.patterns.oversizedTrades), icon: '💪', description: 'Pressing on green' },
    { stage: 'Large Position',  count: r.patterns.oversizedTrades,    icon: '📈', description: 'Size > typical' },
    { stage: 'Vicious Sequence', count: r.cycleDetected ? r.cycleStages.length : 0, icon: '🌀', description: 'Loss-chasing cascade' },
    { stage: 'Late Exit',       count: r.patterns.lateExits,          icon: '🙏', description: 'Held losers too long' },
    { stage: 'Averaging Down',  count: r.patterns.averagingDown,      icon: '📉', description: 'Adding to losers' },
    { stage: 'Panic Exit',      count: r.patterns.panicExits,         icon: '😱', description: 'Exits inside 2 min' },
    { stage: 'Revenge',         count: r.patterns.revengeTrades,      icon: '😤', description: 'Re-entries hot after loss' },
    { stage: 'Overtrading',     count: r.patterns.overtradingTrades,  icon: '😮‍💨', description: 'Volume-driven errors' },
    { stage: 'FOMO',            count: r.patterns.fomoEntries,        icon: '🏃', description: 'Chasing momentum' },
  ]

  // All costs now positive (excess-over-baseline)
  const mistakePatterns = [
    { name: 'Revenge Trade',  icon: '😤', count: r.patterns.revengeTrades,     cost: r.meta.revengeCost,     frequency: freqLabel(r.patterns.revengeTrades, total) },
    { name: 'Averaging Down', icon: '📉', count: r.patterns.averagingDown,     cost: r.meta.averagingCost,   frequency: freqLabel(r.patterns.averagingDown, total) },
    { name: 'FOMO Entry',     icon: '🏃', count: r.patterns.fomoEntries,       cost: r.meta.fomoCost,        frequency: freqLabel(r.patterns.fomoEntries, total) },
    { name: 'Panic Exit',     icon: '😱', count: r.patterns.panicExits,        cost: r.meta.panicCost,       frequency: freqLabel(r.patterns.panicExits, total) },
    { name: 'Overtrading',    icon: '😮‍💨', count: r.patterns.overtradingTrades, cost: r.meta.overtradingCost, frequency: freqLabel(r.patterns.overtradingTrades, total) },
    { name: 'Oversized',      icon: '📈', count: r.patterns.oversizedTrades,   cost: r.meta.oversizeCost,    frequency: freqLabel(r.patterns.oversizedTrades, total) },
    { name: 'Late Exit',      icon: '🙏', count: r.patterns.lateExits,         cost: r.meta.lateExitCost,    frequency: freqLabel(r.patterns.lateExits, total) },
  ].filter(m => m.count > 0)

  const financialImpact = {
    total_lost_to_mistakes: Math.round(r.meta.mistakeTotalCost),
    potential_pnl_without_mistakes: Math.round(r.meta.netPnl + r.meta.mistakeTotalCost),
    message: r.meta.mistakeTotalCost > 0
      ? `Plugging behavioural leaks today would have moved net P&L from ${fmtINR(r.meta.netPnl)} to ${fmtINR(r.meta.netPnl + r.meta.mistakeTotalCost)}.`
      : `No material behavioural leaks — your P&L is a fair reflection of your process today.`,
  }

  // Touch MISTAKE_TAGS so the import isn't stripped by future refactors
  void MISTAKE_TAGS

  return {
    session_summary: generateSessionSummary(session, r),
    momentum_indicators: momentum,
    vicious_cycle: viciousCycle,
    technical_insights: technical,
    dqs: { score: r.dqs.overall, grade: r.dqs.grade, factors: dqsFactors },
    financial_impact: financialImpact,
    mistake_patterns: mistakePatterns,
    rules_for_next_session: generateRules(r),
    cross_user_insight: crossUserInsight(r),
    trade_analyses: buildLegacyTradeAnalyses(session.trades || [], r),
    coaching_points: r.coachingPoints,
    analysed_at: new Date().toISOString(),
    analysed_version: 4,
    ai_coaching: aiCoaching,
    validation: r.validation,
  }
}

function colorFor(score: number): string {
  if (score >= 80) return 'green'
  if (score >= 65) return 'yellow'
  if (score >= 45) return 'orange'
  return 'red'
}

function freqLabel(count: number, total: number): string {
  if (total === 0 || count === 0) return 'none'
  const pct = (count / total) * 100
  if (pct < 5) return 'rare'
  if (pct < 15) return 'occasional'
  if (pct < 30) return 'frequent'
  return 'chronic'
}

function crossUserInsight(r: PatternResult): string {
  if (r.patterns.revengeTrades >= 3) return `Traders in the bottom quartile for discipline average 4+ revenge trades per losing session; you're in that zone today.`
  if (r.patterns.overtradingDetected) return `Profitable traders take ~40% fewer trades per day than breakeven traders with the same strategy — volume is not edge.`
  if (r.patterns.disciplinedTrades >= r.meta.totalTrades * 0.5) return `Sessions with >50% disciplined-tagged trades correlate with positive 5-day forward P&L in our cohort.`
  return `Most traders take 3× as long to recover from a tilt-session as to generate it. Tomorrow's first 3 trades will decide whether today is a blip or a trend.`
}

/* ────────────────────────────────────────────────────────────────── */

export async function generateAICoaching(
  apiKey: string,
  r: PatternResult,
  timeoutMs = 15000,
): Promise<string | undefined> {
  if (!apiKey) return undefined
  try {
    const bullets = r.coachingPoints.slice(0, 3).map(b => `- ${b}`).join('\n')
    const system = `You are TradeSaath, a brutally honest but empathetic trading psychology coach. Given the bullet-point patterns below, write EXACTLY 2 sentences of coaching (max 50 words total). Use "I know..." empathetic phrasing in the first sentence, then one concrete action. No markdown, no preamble.`
    const user = `Today's patterns:\n${bullets}\n\nWrite the 2-sentence coaching note.`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    clearTimeout(timeout)
    if (!res.ok) return undefined
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
    const text = data.content?.find(c => c.type === 'text')?.text?.trim()
    return text || undefined
  } catch {
    return undefined
  }
}
