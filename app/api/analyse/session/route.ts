export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { saveTradeAnalysis } from '@/lib/supabase/saveTradeAnalysis'
import { updateSessionAnalysis } from '@/lib/supabase/saveTrades'
import { bustDashboardCache } from '@/lib/dashboardCache'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit'

/* ─── Inlined helpers (kept local to avoid touching the 598-line parent route) ─── */

type AIResult = { ok: boolean; data?: unknown; error?: string; code?: string }

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userContent: unknown[],
  maxTokens: number,
  timeoutMs = 55000,
): Promise<AIResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    clearTimeout(timeout)
    if (response.status === 529) return { ok: false, error: 'Claude busy (529)', code: 'OVERLOADED' }
    if (response.status === 429) return { ok: false, error: 'Claude rate limit (429)', code: 'RATE_LIMIT' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any
    try { data = await response.json() } catch { return { ok: false, error: `Claude HTTP ${response.status}`, code: 'PARSE' } }
    if (!response.ok || data.error) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${response.status}`
      console.error('Claude API error:', JSON.stringify(data.error || data))
      return { ok: false, error: `Claude: ${errMsg}`, code: data.error?.type || `HTTP_${response.status}` }
    }
    const text = (data.content as Array<{ type: string; text?: string }> | undefined)?.find((c) => c.type === 'text')?.text || ''
    return { ok: true, data: text }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))
    const msg = isAbort ? `Claude timed out (${Math.round(timeoutMs / 1000)}s)` : (err instanceof Error ? err.message : 'Claude error')
    return { ok: false, error: msg, code: isAbort ? 'TIMEOUT' : 'NETWORK' }
  }
}

function safeParseJSON(raw: string): { ok: boolean; data?: unknown; truncated?: boolean } {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try { return { ok: true, data: JSON.parse(cleaned) } } catch { /* fall through */ }
  const lastBrace = cleaned.lastIndexOf('}]')
  const lastComma = cleaned.lastIndexOf('},')
  if (lastBrace > 0 && lastBrace > lastComma) cleaned = cleaned.substring(0, lastBrace + 2)
  else if (lastComma > 0) cleaned = cleaned.substring(0, lastComma + 1)
  const openBraces = (cleaned.match(/{/g) || []).length - (cleaned.match(/}/g) || []).length
  const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length
  for (let i = 0; i < openBrackets; i++) cleaned += ']'
  for (let i = 0; i < openBraces; i++) cleaned += '}'
  try { return { ok: true, data: JSON.parse(cleaned), truncated: true } } catch { return { ok: false } }
}

function buildPerTradeOnlyPrompt(): string {
  return `You are TradeSaath --- a brutally honest yet empathetic trading psychology coach. For EACH trade in the input list, produce one entry in trade_analyses.

Return ONLY this exact JSON (no markdown, no backticks, no extra text):
{"trade_analyses":[{"trade_index":N,"tag":"win|fomo|rvg|avg|pnc|vs","tag_label":"...","quick_summary":"...","technical_analysis":"...","psychology_coaching":"...","counterfactual":"...","cycle_stage":"win|overconf|large|vs|hope|avg|pnc|rvg|fatigue|fomo"}]}

CRITICAL: The trade_index of each entry MUST equal the _trade_index field of the corresponding input trade (absolute position in the whole session, not chunk-relative).

For each trade:
- tag: one of win, fomo, rvg, avg, pnc, vs
- quick_summary: 1 line with Rs amount
- technical_analysis: entry/exit vs structure
- psychology_coaching: name a specific cognitive bias (loss aversion, sunk cost, recency, anchoring, overconfidence, gambler's fallacy, disposition effect, FOMO, etc.) using "I know..." empathetic language
- counterfactual: specific Rs amounts and the right action
- cycle_stage: one of win, overconf, large, vs, hope, avg, pnc, rvg, fatigue, fomo`
}

function buildAnalysePrompt(context: Record<string, string | number | null | undefined>): string {
  const ctxLines = context ? Object.entries(context).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'No additional context.'
  return `You are TradeSaath --- a brutally honest yet deeply empathetic AI trading psychology coach. You talk like a senior trader mentoring a junior: direct, specific, no sugarcoating, but always rooting for them.

=== RESPONSE JSON STRUCTURE ===
Return this exact JSON (no markdown, no backticks):
{
  "session_summary": "...",
  "momentum_indicators": [...],
  "vicious_cycle": [...],
  "technical_insights": [...],
  "dqs": {...},
  "financial_impact": {...},
  "mistake_patterns": [...],
  "rules_for_next_session": [...],
  "cross_user_insight": "...",
  "trade_analyses": [...]
}

=== FIELD-BY-FIELD INSTRUCTIONS ===

**session_summary** (3-4 paragraphs, use "you" language, bold **key phrases**):
- Para 1: Paint the session story as a narrative arc with exact trade numbers, times, P&L amounts.
- Para 2: Identify THE turning point --- the single trade where discipline broke. Quantify damage from that point.
- Para 3: Name the SINGLE most costly behavioral pattern with its exact cost.
- Para 4: End with one specific, printable rule for tomorrow. Not generic.

**momentum_indicators** (4 items, scores 0-100):
[{"name":"Rule Following","score":N,"description":"..."},{"name":"Staying Calm","score":N,"description":"..."},{"name":"Entry Timing","score":N,"description":"..."},{"name":"Exit Discipline","score":N,"description":"..."}]

**vicious_cycle** (all 10 stages, count how many trades fall in each):
[{"stage":"Disciplined Win","count":N,"icon":"(check)","description":"..."},{"stage":"Overconfidence","count":N,"icon":"(lightning)","description":"..."},{"stage":"Larger Position","count":N,"icon":"(chart)","description":"..."},{"stage":"Market Goes Against","count":N,"icon":"(down)","description":"..."},{"stage":"Hope & Hold","count":N,"icon":"(pray)","description":"..."},{"stage":"Averaging Down","count":N,"icon":"(decline)","description":"..."},{"stage":"Panic Exit","count":N,"icon":"(fear)","description":"..."},{"stage":"Revenge Trade","count":N,"icon":"(sword)","description":"..."},{"stage":"Decision Fatigue","count":N,"icon":"(dizzy)","description":"..."},{"stage":"FOMO Re-entry","count":N,"icon":"(cycle)","description":"..."}]

**technical_insights** (4 items, scores 0-100):
[{"name":"Trend Alignment","score":N,"description":"..."},{"name":"Entry Structure","score":N,"description":"..."},{"name":"Exit Quality","score":N,"description":"..."},{"name":"Entry Timing","score":N,"description":"..."}]

**dqs**: {"score":N,"factors":[{"name":"Entry Timing","score":N,"color":"green|blue|gold|red"},{"name":"Risk Management","score":N,"color":"..."},{"name":"Position Sizing","score":N,"color":"..."},{"name":"Emotional Control","score":N,"color":"..."},{"name":"Exit Discipline","score":N,"color":"..."}]}
- Color rules: green=80-100, blue=60-79, gold=40-59, red=0-39

**financial_impact**: {"total_lost_to_mistakes":N,"potential_pnl_without_mistakes":N,"message":"..."}

**mistake_patterns**: [{"name":"...","icon":"emoji","count":N,"cost":N,"frequency":"X of Y trades"}]

**rules_for_next_session** (exactly 3 rules, at least one IF-THEN)

**cross_user_insight**: one anonymized community insight line.

**trade_analyses** (one entry PER trade --- analyse EVERY trade):
[{"trade_index":0,"tag":"win|fomo|rvg|avg|pnc|vs","tag_label":"...","quick_summary":"...","technical_analysis":"...","psychology_coaching":"...","counterfactual":"...","cycle_stage":"win|overconf|large|vs|hope|avg|pnc|rvg|fatigue|fomo"}]

For EACH trade:
- tag: win, fomo, rvg, avg, pnc, vs
- quick_summary: 1 line with Rs amount
- technical_analysis: entry/exit vs structure
- psychology_coaching: name the specific COGNITIVE BIAS (loss aversion, sunk cost, recency, anchoring, overconfidence, gambler's fallacy, disposition effect, FOMO, etc.) with "I know..." empathetic language
- counterfactual: specific Rs amounts and what the RIGHT action would have been
- cycle_stage: map to one of the 10 stages

=== THE 10-STAGE VICIOUS CYCLE ===
1. Disciplined Win (win) 2. Overconfidence (overconf) 3. Larger Position (large) 4. Market Goes Against (vs) 5. Hope & Hold (hope) 6. Averaging Down (avg) 7. Panic Exit (pnc) 8. Revenge Trade (rvg) 9. Decision Fatigue (fatigue) 10. FOMO Re-entry (fomo)

DETECTION RULES:
- Loss + re-entry within 5 minutes => Revenge Trade
- 2+ consecutive losses without stopping => Hope/Averaging/Panic zone
- >15 trades in session => Decision Fatigue
- Entry near day high after rally => FOMO
- Adding to a losing position => Averaging Down

Context about the trader:
${ctxLines}

=== CRITICAL RULES ===
- Analyse EVERY trade --- trade_analyses must have one entry per trade
- Tags must be one of: win, fomo, rvg, avg, pnc, vs
- Psychology coaching MUST name specific cognitive biases, use "I know..." empathetic language
- Counterfactuals MUST include specific Rs amounts
- Reference exact trade numbers, times, amounts
- Return ONLY valid JSON --- no markdown, no backticks, no extra text`
}

function parseTrades(raw: unknown): unknown[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch { return [] }
  }
  if (typeof raw === 'object') return Object.values(raw as Record<string, unknown>)
  return []
}

/* ─── POST /api/analyse/session — analyse a single saved session ─── */
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Rate-limit per user: 30 per 15min (lets batch analysis through)
    const ip = getClientIp(request as unknown as Request)
    const rl = rateLimit(`analyse-session:${userId}:${ip}`, 30, 15 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    const force = !!body?.force
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const supabase = getSupabaseAdmin()

    // 1. Fetch session and verify ownership
    const { data: session, error: fetchErr } = await supabase
      .from('trade_sessions')
      .select('id, user_id, anon_id, trades, analysis, context, trade_date, trade_count, net_pnl')
      .eq('id', sessionId)
      .maybeSingle()

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. Parse trades
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTrades = parseTrades(session.trades) as any[]
    if (!allTrades.length) {
      return NextResponse.json({ error: 'No trades on this session', tradesAnalysed: 0 }, { status: 400 })
    }

    // 3. Skip if already analysed (unless force=true)
    if (!force) {
      const { count } = await supabase
        .from('trade_analysis')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
      if ((count || 0) > 0) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'already_analysed',
          tradesAnalysed: count || 0,
        })
      }
    } else {
      // force=true: wipe previous per-trade rows so we don't get duplicates
      await supabase.from('trade_analysis').delete().eq('session_id', sessionId)
    }

    // 4. Cap very large sessions
    const MAX_TRADES = 300
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades = allTrades.slice(0, MAX_TRADES) as any[]
    const truncated = allTrades.length > MAX_TRADES

    // 5. Build prompts + chunk trades for parallel Claude calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = (session.context as Record<string, any>) || {}
    const systemPromptFull = buildAnalysePrompt({
      market: context.market,
      trading_style: context.trading_style,
      risk_per_trade: context.risk_per_trade,
      capital: context.capital,
      goals: context.goals,
    })
    const systemPromptPerTrade = buildPerTradeOnlyPrompt()

    const CHUNK_SIZE = 30
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunks: { startIdx: number; trades: any[] }[] = []
    for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
      chunks.push({ startIdx: i, trades: trades.slice(i, i + CHUNK_SIZE) })
    }

    // Call Claude for each chunk SERIALLY to avoid tripping per-minute rate limits.
    // First chunk gets the full prompt (session-level + per-trade for its slice).
    // Remaining chunks get only the compact per-trade prompt.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunkResults: AIResult[] = []
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx]
      const isFirst = chunkIdx === 0
      // Inject absolute _trade_index into each trade so Claude returns correct indices
      const stampedTrades = chunk.trades.map((t, i) => ({ _trade_index: chunk.startIdx + i, ...t }))
      const payload = isFirst
        ? {
            trade_date: session.trade_date,
            trade_count: trades.length,
            net_pnl: session.net_pnl,
            chunk_index: chunkIdx,
            total_chunks: chunks.length,
            note_for_ai: 'Use the _trade_index field as trade_index in your per-trade output. This chunk contains the first set of trades; provide session-level fields based on the full session context (count/date/pnl given above).',
            trades: stampedTrades,
          }
        : {
            chunk_index: chunkIdx,
            total_chunks: chunks.length,
            trade_index_offset: chunk.startIdx,
            trades: stampedTrades,
          }
      const res = await callClaude(
        apiKey,
        isFirst ? systemPromptFull : systemPromptPerTrade,
        [{ type: 'text', text: isFirst
          ? `Analyse this trading session. Return the JSON structure described in the system prompt. For trade_analyses use the _trade_index field as trade_index.\n\n${JSON.stringify(payload, null, 2)}`
          : `Produce trade_analyses for each trade below (use _trade_index as trade_index). Return only the JSON.\n\n${JSON.stringify(payload, null, 2)}`
        }],
        isFirst ? 8192 : 5000,
        55000,
      )
      chunkResults.push(res)
      // If first chunk is rate-limited, fail fast so the batch runner can retry the whole session with backoff
      if (isFirst && !res.ok && (res.code === 'RATE_LIMIT' || res.code === 'OVERLOADED')) {
        return NextResponse.json(
          { error: 'rate_limited', retryAfter: 30, code: 'RATE_LIMIT' },
          { status: 429 },
        )
      }
      // Small gap between chunks to spread token usage across the minute
      if (chunkIdx < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    // If the FIRST chunk fails (we need its session-level analysis), abort
    const firstResult = chunkResults[0]
    if (!firstResult?.ok) {
      const status = firstResult?.code === 'TIMEOUT' ? 504 : 500
      return NextResponse.json(
        { error: firstResult?.error || 'Claude call failed on first chunk', code: firstResult?.code },
        { status },
      )
    }

    const firstParsed = safeParseJSON(String(firstResult.data || ''))
    if (!firstParsed.ok || !firstParsed.data) {
      return NextResponse.json({ error: 'Could not parse AI response (first chunk)' }, { status: 502 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysis = firstParsed.data as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tradeAnalyses: any[] = Array.isArray(analysis?.trade_analyses) ? [...analysis.trade_analyses] : []

    // Merge trade_analyses from remaining chunks (per-trade only chunks). Skip failed
    // chunks silently -- merged array will just be missing those trades.
    for (let i = 1; i < chunkResults.length; i++) {
      const r = chunkResults[i]
      if (!r.ok) {
        console.warn(`Chunk ${i} failed:`, r.error, r.code)
        continue
      }
      const p = safeParseJSON(String(r.data || ''))
      if (!p.ok || !p.data) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extra = (p.data as any)?.trade_analyses
      if (Array.isArray(extra)) tradeAnalyses.push(...extra)
    }

    // Make sure session-level analysis object carries the FULL merged trade list
    analysis.trade_analyses = tradeAnalyses

    // 6. Merge per-trade analysis back into each trade row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = trades.map((t: any, i: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ai = tradeAnalyses.find((a: any) => a.trade_index === i)
      return ai ? { ...t, ...ai } : t
    })

    // 7. Persist per-trade analysis and session-level analysis
    await saveTradeAnalysis(sessionId, merged, session.anon_id || undefined)
    await updateSessionAnalysis(sessionId, analysis)

    // 8. Bust dashboard cache for this user
    bustDashboardCache(userId)

    return NextResponse.json({
      success: true,
      sessionId,
      tradesAnalysed: merged.length,
      totalTrades: allTrades.length,
      truncated,
      chunks: chunks.length,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('analyse/session error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
