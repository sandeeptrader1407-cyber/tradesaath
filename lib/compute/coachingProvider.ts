/**
 * Module 2, Step 8B — Haiku coaching provider.
 *
 * Wraps the Anthropic Haiku call as a `CoachingProvider` that can be
 * injected into `analyseSession()`. This is the single place where
 * the AI coaching prompt lives for Module 2.
 *
 * Reference prompt: lib/analysis/sessionSummarizer.ts :: generateAICoaching
 *   - brutally honest but empathetic trading psychology coach
 *   - EXACTLY 2 sentences, max ~50 words
 *   - "I know..." empathetic opener, then one concrete action
 *
 * Missing API key / missing SDK / network errors → caller (analyseSession)
 * catches the failure and turns it into a non-fatal warning + empty
 * aiCoaching string.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import Anthropic from '@anthropic-ai/sdk'
import type { CoachingProvider, CoachingContext } from './analyse'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_MAX_TOKENS = 200

export interface HaikuCoachingOptions {
  /** Override the model — defaults to Haiku. */
  model?: string
  /** Override max_tokens. Default 200. */
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

    const prompt = buildCoachingPrompt(ctx)

    const response = await client.messages.create({
      model: options.model ?? HAIKU_MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      system:
        'You are TradeSaath, a brutally honest but empathetic trading ' +
        'psychology coach. Write EXACTLY 2 sentences of coaching (max 50 ' +
        'words total). First sentence uses "I know..." empathetic phrasing. ' +
        'Second sentence is one concrete action. No markdown, no preamble.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (response.content || [])
      .filter((b: any) => b && b.type === 'text')
      .map((b: any) => (typeof b.text === 'string' ? b.text : ''))
      .join('')

    return text.trim()
  }
}

/**
 * Render a ComputeResult-derived context snapshot for the model.
 * Intentionally short — Haiku doesn't need the full trade list.
 */
export function buildCoachingPrompt(ctx: CoachingContext): string {
  const m = ctx.metrics
  const wrPct = Number.isFinite(m.winRate)
    ? (m.winRate * 100).toFixed(0)
    : '0'
  const drag = ctx.dqs.biggestDrag?.factorName || 'none'
  const cycleLine =
    ctx.cycles.length > 0
      ? `Vicious cycle: ${ctx.cycles[0].description} (severity ${ctx.cycles[0].severity})`
      : 'No vicious cycle detected'

  const sessionSummary = [
    `Session P&L: ${m.totalPnl}`,
    `Trades: ${m.totalTrades}, Win Rate: ${wrPct}%`,
    `DQS: ${ctx.dqs.overall} (${ctx.dqs.grade})`,
    `Biggest drag: ${drag}`,
    cycleLine,
    ctx.narrative,
  ].join('\n')

  return [
    "Today's session:",
    sessionSummary,
    '',
    'Write the 2-sentence coaching note.',
  ].join('\n')
}
