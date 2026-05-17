/**
 * Module 2, Step 8B — Haiku coaching provider.
 *
 * Wraps the Anthropic Haiku call as a `CoachingProvider` that can be
 * injected into `analyseSession()`. This is the single place where
 * the AI coaching prompt lives for Module 2.
 *
 * Voice and framework are shared with the legacy path
 * (lib/analysis/sessionSummarizer.ts) via the COACHING_SYSTEM_PROMPT
 * constant — one source of truth for TradeSaath's coaching voice.
 *
 * Prompt caching is enabled on the system block. Haiku 4.5 requires
 * a cacheable prefix ≥4,096 tokens; the shared system prompt clocks
 * in around 4,800 tokens, comfortably above threshold.
 *
 * Missing API key / missing SDK / network errors → caller
 * (analyseSession) catches the failure and turns it into a non-fatal
 * warning + empty aiCoaching string.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import Anthropic from '@anthropic-ai/sdk'
import type { CoachingProvider, CoachingContext } from './analyse'
import type { EnrichedTrade } from './types'
import { COACHING_SYSTEM_PROMPT } from '@/lib/analysis/coachingPrompts'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_TOKENS = 700

export interface HaikuCoachingOptions {
  /** Override the model — defaults to Haiku 4.5. */
  model?: string
  /** Override max_tokens. Default 700 (room for 5-7 sentence prose). */
  maxTokens?: number
  /** Provide a pre-built client (mainly for tests). */
  client?: Pick<Anthropic, 'messages'>
  /** Override the API key (defaults to process.env.ANTHROPIC_API_KEY). */
  apiKey?: string
}

/**
 * Returns a CoachingProvider that calls Anthropic Haiku. If no API
 * key is configured, the returned provider resolves to an empty
 * string (no throw) so the orchestrator doesn't record a warning for
 * the common "key not set" case.
 */
export function createHaikuCoachingProvider(
  options: HaikuCoachingOptions = {}
): CoachingProvider {
  return async (ctx: CoachingContext): Promise<string> => {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return ''
    }

    const client =
      options.client ??
      new Anthropic({
        apiKey,
      })

    const userMessage = buildCoachingPrompt(ctx)

    // The SDK type for `system` accepts string | TextBlockParam[]. The
    // `cache_control` field is part of TextBlockParam in 0.40+. Some
    // older type stubs don't expose it cleanly, so we cast at the
    // boundary. The runtime API accepts it on all current versions.
    const systemBlocks: any = [
      {
        type: 'text',
        text: COACHING_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ]

    const response = await client.messages.create({
      model: options.model ?? HAIKU_MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: systemBlocks,
      messages: [{ role: 'user', content: userMessage }],
    })

    const u = (response as any).usage
    if (u) {
      console.log(
        '[AI_COACHING_CACHE_M2]',
        JSON.stringify({
          in: u.input_tokens ?? 0,
          out: u.output_tokens ?? 0,
          write: u.cache_creation_input_tokens ?? 0,
          read: u.cache_read_input_tokens ?? 0,
        }),
      )
    }

    const text = (response.content || [])
      .filter((b: any) => b && b.type === 'text')
      .map((b: any) => (typeof b.text === 'string' ? b.text : ''))
      .join('')

    return text.trim()
  }
}

/**
 * Render a ComputeResult-derived context snapshot for the model.
 *
 * Module 2 has richer per-trade context than the legacy path (cycle
 * stage names, behavioral attribution, sequence state), so this
 * builder produces a more granular session summary than the
 * Phase-1 helper while keeping output prose stable across both paths.
 */
export function buildCoachingPrompt(ctx: CoachingContext): string {
  const m = ctx.metrics
  const wrPct = Number.isFinite(m.winRate)
    ? Math.round(m.winRate * 100)
    : 0

  const pnlLine = m.totalPnl >= 0
    ? `net +₹${Math.round(m.totalPnl).toLocaleString('en-IN')}`
    : `net -₹${Math.round(Math.abs(m.totalPnl)).toLocaleString('en-IN')}`

  const tally: Record<string, number> = {}
  for (const t of ctx.trades) {
    if (t.detectedTag && t.detectedTag !== 'win') {
      tally[t.detectedTag] = (tally[t.detectedTag] ?? 0) + 1
    }
  }
  const flagsLine = Object.keys(tally).length > 0
    ? Object.entries(tally).map(([k, v]) => `${k} x${v}`).join(', ')
    : 'none flagged'

  const cycleLine = ctx.cycles.length > 0
    ? `Vicious cycle DETECTED — "${ctx.cycles[0].description}" (severity: ${ctx.cycles[0].severity}, ${ctx.cycles[0].stages.length} stages).`
    : 'No vicious-cycle cascade detected.'

  const drag = ctx.dqs.biggestDrag?.factorName || 'none'
  const dragLine = drag !== 'none'
    ? `Lowest DQS sub-score: ${drag} (room for ${Math.round(ctx.dqs.biggestDrag?.potentialImprovement ?? 0)} pt overall lift).`
    : ''

  const highlights = pickTradeHighlights(ctx.trades)
  const highlightsBlock = highlights.length > 0
    ? highlights.map(h => `- ${h}`).join('\n')
    : '- (no specific trade-level highlights surfaced)'

  return `Session pattern data (Module 2 pipeline):

Trades: ${m.totalTrades} total (${m.winCount} wins, ${m.lossCount} losses, ${wrPct}% win rate)
P&L: ${pnlLine}
DQS: ${ctx.dqs.overall}/100 (grade ${ctx.dqs.grade})
Trading style this session: ${m.tradingStyle}
Behavioral flags: ${flagsLine}
${cycleLine}
${dragLine}

Session narrative (code-generated, for context):
${ctx.narrative}

Notable trade-level observations:
${highlightsBlock}

Write the coaching note per the output format defined in your instructions.`
}

/**
 * Pull the 3 highest-signal per-trade observations to give the model
 * concrete evidence to cite — without overwhelming the prompt.
 *
 * Priority order:
 *   1. Trades that fired a vicious-cycle stage
 *   2. Tagged behavioral patterns (revenge, fomo, oversize, etc.)
 *   3. Streak breaks (winStreakBroken, lossStreakExtended)
 */
function pickTradeHighlights(trades: EnrichedTrade[]): string[] {
  const out: string[] = []

  for (const t of trades) {
    if (out.length >= 3) break
    if (t.cycleStageName && t.cycleStageNumber) {
      out.push(
        `Trade #${t.tradeNumberInSession} (${t.symbol || '—'}): vicious-cycle stage ${t.cycleStageNumber} (${t.cycleStageName}), ${formatPnlShort(t.pnl)}`
      )
    }
  }

  if (out.length < 3) {
    for (const t of trades) {
      if (out.length >= 3) break
      if (t.detectedTag && t.detectedTag !== 'win' && t.detectedTag !== 'disciplined' && !t.cycleStageName) {
        const cost = t.tagCost > 0 ? ` (leak: ₹${Math.round(t.tagCost).toLocaleString('en-IN')})` : ''
        const conf = t.tagConfidence ? ` [${t.tagConfidence} confidence]` : ''
        out.push(
          `Trade #${t.tradeNumberInSession} (${t.symbol || '—'}): ${t.detectedTag}${conf}, ${formatPnlShort(t.pnl)}${cost}`
        )
      }
    }
  }

  if (out.length < 3) {
    for (const t of trades) {
      if (out.length >= 3) break
      if (t.winStreakBroken) {
        out.push(
          `Trade #${t.tradeNumberInSession} broke a winning streak (${formatPnlShort(t.pnl)})`
        )
      } else if (t.lossStreakExtended && t.consecutiveLosses >= 3) {
        out.push(
          `Trade #${t.tradeNumberInSession} extended a losing streak to ${t.consecutiveLosses} (${formatPnlShort(t.pnl)})`
        )
      }
    }
  }

  return out.slice(0, 3)
}

function formatPnlShort(pnl: unknown): string {
  const n = Number(pnl) || 0
  if (n === 0) return 'breakeven'
  return n > 0
    ? `+₹${Math.round(n).toLocaleString('en-IN')}`
    : `-₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`
}
