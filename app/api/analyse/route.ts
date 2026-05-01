export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveTradeSession, DedupStats } from '@/lib/supabase/saveTrades';
import { saveRawFile } from '@/lib/supabase/saveFile';
import { saveTradeAnalysis } from '@/lib/supabase/saveTradeAnalysis';
import { bustDashboardCache } from '@/lib/dashboardCache';
import { getOrCreateAnonId } from '@/lib/anonId';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { detectPatterns } from '@/lib/analysis/patternDetector';
import { buildAnalysisJSON, generateAICoaching } from '@/lib/analysis/sessionSummarizer';
import { createBatch } from '@/lib/analysis/analysisQueue';
import { sendEmail } from '@/lib/email';
import { analysisCompleteHtml, analysisCompleteText } from '@/emails/analysisComplete';
import { clerkClient } from '@clerk/nextjs/server';
import { intakeFile, toLegacyTrade, saveRawData, saveClaudeFallbackRawData, computeFileHash } from '@/lib/intake';
import type { RawFileData } from '@/lib/intake';
import { tradesNeedPairing, pairClaudeTrades } from '@/lib/intake/claudeTradePairer';
import { logAiUsage } from '@/lib/admin/logAiUsage';

type AIResult = { ok: boolean; data?: unknown; error?: string; code?: string; usage?: { inputTokens: number; outputTokens: number } };

/* ─── Call Claude API ─── */
async function callClaude(
  apiKey: string, systemPrompt: string,
  userContent: unknown[], maxTokens: number, timeoutMs = 55000,
): Promise<AIResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    clearTimeout(timeout);
    if (response.status === 529) return { ok: false, error: 'Claude busy (529)', code: 'OVERLOADED' };
    if (response.status === 429) return { ok: false, error: 'Claude rate limit (429)', code: 'RATE_LIMIT' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Claude API response shape varies
    let data: any;
    try { data = await response.json(); } catch { return { ok: false, error: `Claude HTTP ${response.status}`, code: 'PARSE' }; }
    if (!response.ok || data.error) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${response.status}`;
      console.error('Claude API error:', JSON.stringify(data.error || data));
      return { ok: false, error: `Claude: ${errMsg}`, code: data.error?.type || `HTTP_${response.status}` };
    }
    const text = (data.content as Array<{ type: string; text?: string }> | undefined)?.find((c) => c.type === 'text')?.text || '';
    const usage = data.usage ? { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 } : undefined;
    return { ok: true, data: text, usage };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
    const msg = isAbort ? `Claude timed out (${Math.round(timeoutMs / 1000)}s)` : (err instanceof Error ? err.message : 'Claude error');
    return { ok: false, error: msg, code: isAbort ? 'TIMEOUT' : 'NETWORK' };
  }
}

/* ─── JSON parser with truncation recovery ─── */
function safeParseJSON(raw: string): { ok: boolean; data?: unknown; truncated?: boolean } {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Try direct parse first
  try { return { ok: true, data: JSON.parse(cleaned) }; } catch { /* fall through */ }
  // Claude sometimes wraps JSON in prose text — extract the JSON object
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const extracted = cleaned.substring(jsonStart, jsonEnd + 1);
    try { return { ok: true, data: JSON.parse(extracted) }; } catch { /* fall through */ }
  }
  // Truncation recovery: find the last complete array element and balance braces
  const lastBrace = cleaned.lastIndexOf('}]');
  const lastComma = cleaned.lastIndexOf('},');
  if (lastBrace > 0 && lastBrace > lastComma) cleaned = cleaned.substring(0, lastBrace + 2);
  else if (lastComma > 0) cleaned = cleaned.substring(0, lastComma + 1);
  const openBraces = (cleaned.match(/{/g) || []).length - (cleaned.match(/}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets; i++) cleaned += ']';
  for (let i = 0; i < openBraces; i++) cleaned += '}';
  try { return { ok: true, data: JSON.parse(cleaned), truncated: true }; } catch { return { ok: false }; }
}

/* ─── Media type helpers ─── */
function getMediaType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf', csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  };
  return map[ext] || 'application/octet-stream';
}

/* ─── System prompts ─── */
function buildExtractPrompt(brokerHint?: string): string {
  const brokerLine = brokerHint && brokerHint !== 'Unknown'
    ? `
IMPORTANT: This file is from "${brokerHint}". Parse using that broker's specific format and column naming conventions.`
    : ''
  return `You are a trade extraction engine. Extract ALL trades from this broker statement/file.${brokerLine}
For each trade return EXACTLY this JSON:
{"trades":[{"symbol":"...","side":"BUY"|"SELL","entry_price":N,"exit_price":N,"quantity":N,"entry_time":"HH:MM","exit_time":"HH:MM","pnl":N,"trade_date":"YYYY-MM-DD"}],"detected_market":"NSE"|"NYSE"|"Forex"|"Crypto"|"Unknown","detected_currency":"INR"|"USD"|"EUR","detected_broker":"Zerodha"|"Angel One"|"Unknown","trade_date":"YYYY-MM-DD"}
Rules: P&L for BUY=(exit-entry)*qty, SELL=(entry-exit)*qty. If only one leg, set missing to null. Parse ALL trades. 24h times. IMPORTANT: include trade_date on EACH trade if the file contains trades from multiple days. Return ONLY valid JSON.`
}

// Retained only as historical reference — no longer invoked.
// The pure-code pattern detector (lib/analysis) replaced this AI prompt.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _buildAnalysePromptLegacy(context: Record<string, string | number | null | undefined>): string {
  const ctxLines = context ? Object.entries(context).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'No additional context.';
  return `You are TradeSaath --- a brutally honest yet deeply empathetic AI trading psychology coach. You talk like a senior trader mentoring a junior: direct, specific, no sugarcoating, but always rooting for them. Think of yourself as the trader's inner voice that tells the truth they already know but avoid.

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
- Para 1: Paint the session story as a narrative arc. "You started disciplined at 9:18 with Trade #1..." Reference exact trade numbers, times, P&L amounts.
- Para 2: Identify THE turning point --- the single trade where discipline broke. "Everything changed at Trade #4 --- that Rs 1,200 loss triggered a cascade..." Quantify the damage from that point forward.
- Para 3: Name the SINGLE most costly behavioral pattern with its exact cost: "Your revenge trading after 11:00 AM cost you Rs 4,500 --- that's 3x your best win today."
- Para 4: End with one specific, printable rule for tomorrow. Not generic. "Tomorrow's rule: After any loss > Rs 500, close the terminal for 10 minutes. No exceptions."

**momentum_indicators** (4 items, scores 0-100):
[{"name":"Rule Following","score":N,"description":"..."}, {"name":"Staying Calm","score":N,"description":"..."}, {"name":"Entry Timing","score":N,"description":"..."}, {"name":"Exit Discipline","score":N,"description":"..."}]
- Descriptions must reference actual trades: "You broke your own sizing rule on trades #5 and #7, doubling position after losses"

**vicious_cycle** (all 10 stages, count how many trades fall in each):
[{"stage":"Disciplined Win","count":N,"icon":"(check)","description":"..."},{"stage":"Overconfidence","count":N,"icon":"(lightning)","description":"..."},{"stage":"Larger Position","count":N,"icon":"(chart)","description":"..."},{"stage":"Market Goes Against","count":N,"icon":"(down)","description":"..."},{"stage":"Hope & Hold","count":N,"icon":"(pray)","description":"..."},{"stage":"Averaging Down","count":N,"icon":"(decline)","description":"..."},{"stage":"Panic Exit","count":N,"icon":"(fear)","description":"..."},{"stage":"Revenge Trade","count":N,"icon":"(sword)","description":"..."},{"stage":"Decision Fatigue","count":N,"icon":"(dizzy)","description":"..."},{"stage":"FOMO Re-entry","count":N,"icon":"(cycle)","description":"..."}]
- For each stage with count > 0, the description MUST name the specific trades and show the chain: "Trades #6→#7: After the Rs 800 loss on #6, you re-entered within 2 minutes on the same symbol --- classic revenge. This cost an additional Rs 1,100."
- Show the CHAIN REACTION: how one stage triggered the next. "The panic exit on #5 (Rs -900) led to revenge trade #6 (Rs -1,100), then decision fatigue on #7-#9 (Rs -2,300 combined). Total cycle cost: Rs 4,300."

**technical_insights** (4 items, scores 0-100):
[{"name":"Trend Alignment","score":N,"description":"..."}, {"name":"Entry Structure","score":N,"description":"..."}, {"name":"Exit Quality","score":N,"description":"..."}, {"name":"Entry Timing","score":N,"description":"..."}]
- Trend Alignment: Were entries with or against the prevailing trend? "3 of 5 losing trades were counter-trend shorts during an uptrend morning."
- Entry Structure: Did entries respect key levels or chase momentum? "Trade #3 entered long at the day high --- chasing, not structure-based."
- Exit Quality: Did exits capture the move or leave money/hold too long? "You exited Trade #1 at Rs 245 --- it ran to Rs 258. That's Rs 1,300 left on the table."
- Entry Timing: Were entries at good times or during choppy/low-volume periods? "Trades after 2:00 PM had 0% win rate --- afternoon trading destroyed your P&L."

**dqs** (Decision Quality Score, 0-100):
{"score":N,"factors":[{"name":"Entry Timing","score":N,"color":"green|blue|gold|red"}, {"name":"Risk Management","score":N,"color":"..."}, {"name":"Position Sizing","score":N,"color":"..."}, {"name":"Emotional Control","score":N,"color":"..."}, {"name":"Exit Discipline","score":N,"color":"..."}]}
- Color rules: green=80-100, blue=60-79, gold=40-59, red=0-39

**financial_impact**:
{"total_lost_to_mistakes":N,"potential_pnl_without_mistakes":N,"message":"..."}
- Calculate what P&L would have been if mistake trades (revenge, FOMO, panic, averaging) were skipped entirely.
- message: "You lost Rs 3,200 to emotional trades. Without them, your session P&L would be +Rs 1,800 instead of -Rs 1,400. Discipline alone is worth Rs 3,200 to you."

**mistake_patterns** (array of patterns found):
[{"name":"...","icon":"emoji","count":N,"cost":N,"frequency":"X of Y trades"}]
- Possible names: "Revenge Trading", "FOMO Entry", "Averaging Down", "Panic Exit", "Overtrading", "Position Sizing Violation", "Chasing Momentum", "Hope & Hold"
- cost: exact Rs lost to this pattern in this session

**rules_for_next_session** (exactly 3 rules):
- Each rule must be specific and measurable, not generic. BAD: "Manage risk better." GOOD: "Maximum 2 trades before 10:30 AM. If both lose, stop trading for the day."
- At least one rule must be an IF-THEN rule: "IF you take a loss > Rs 500, THEN set a 10-minute phone timer before the next trade."
- Rules should directly address the mistakes found in THIS session.

**cross_user_insight** (one anonymized community insight):
"From 847 traders: Those who set a hard 3-trade loss limit per day reduced weekly drawdowns by 34%."

**trade_analyses** (one entry PER trade --- analyse EVERY trade):
[{"trade_index":0,"tag":"win|fomo|rvg|avg|pnc|vs","tag_label":"...","quick_summary":"...","technical_analysis":"...","psychology_coaching":"...","counterfactual":"...","cycle_stage":"win|overconf|large|vs|hope|avg|pnc|rvg|fatigue|fomo"}]

For EACH trade's fields:
- tag: win (clean win), fomo (FOMO entry), rvg (revenge trade), avg (averaging down), pnc (panic exit), vs (vicious cycle trade)
- tag_label: Human-readable label, e.g. "Clean Win", "Revenge Trade", "FOMO Entry"
- quick_summary: 1 line. "Disciplined BUY at support, exited at target. +Rs 800." or "Revenge SHORT 3 min after previous loss. Chased entry. -Rs 1,100."
- technical_analysis: Comment on entry/exit timing vs market structure. "Entry was 15 points above VWAP after a 3-candle rally --- chasing, not waiting for pullback. Exit hit stop at the exact low before a 40-point bounce --- stop was too tight for the volatility."
- psychology_coaching: Name the COGNITIVE BIAS, not just the emotion. Use "I know..." empathetic language.
  * "I know that loss stung --- and the urge to make it back immediately is your **loss aversion bias** talking. Your brain values the pain of losing Rs 800 twice as much as the joy of gaining Rs 800. That's why you jumped back in 2 minutes later without a setup. The fix: feel the loss, name it as loss aversion, and wait 10 minutes."
  * Reference SPECIFIC cognitive biases: loss aversion, sunk cost fallacy, recency bias, confirmation bias, anchoring, overconfidence bias, gambler's fallacy, disposition effect, FOMO (social proof), endowment effect.
  * Connect to patterns: "This is the 3rd revenge trade this session. The first one cost Rs 600, this one Rs 1,100. Each revenge trade gets bigger --- that's the sunk cost fallacy compounding."
- counterfactual: Be specific with amounts and alternatives. "If you had waited for the 5-min candle close at 10:45, your entry at Rs 245 instead of Rs 252 would have saved Rs 700 on this position. Better yet --- skipping this revenge trade entirely saves Rs 1,100 and keeps your risk:reward intact."
- cycle_stage: Map to the vicious cycle stage this trade belongs to.

=== THE 10-STAGE VICIOUS CYCLE ===
1. Disciplined Win (win) --- Following the plan, proper sizing, clean entry/exit
2. Overconfidence (overconf) --- After wins, feeling invincible, "I can read the market"
3. Larger Position (large) --- Increasing size because "I'm on a roll"
4. Market Goes Against (vs) --- The inflated position moves against you
5. Hope & Hold (hope) --- Refusing to exit, moving stop loss, "it'll come back"
6. Averaging Down (avg) --- Adding to a losing position to lower average
7. Panic Exit (pnc) --- Exiting at the worst possible moment after maximum pain
8. Revenge Trade (rvg) --- Immediate re-entry to "win back" losses, no setup
9. Decision Fatigue (fatigue) --- Too many trades, brain is fried, random entries
10. FOMO Re-entry (fomo) --- Seeing a move you missed, jumping in late

DETECTION RULES:
- After 2+ consecutive wins => next trade is Overconfidence risk
- Position size increase after wins => Larger Position
- Loss + re-entry within 5 minutes on same/correlated symbol => Revenge Trade
- 2+ consecutive losses without stopping => Hope/Averaging/Panic zone
- Trades after 2:00 PM following morning losses => highest revenge risk
- >15 trades in session => Decision Fatigue (cognitive capacity depleted)
- Entry near day high after a rally => FOMO
- Adding to a losing position => Averaging Down
- Exit at the session low after holding through drawdown => Panic Exit
- Show the CHAIN: how each stage led to the next, and quantify the TOTAL COST of the cycle

Context about the trader:
${ctxLines}

=== CRITICAL RULES ===
- Analyse EVERY trade --- trade_analyses array must have one entry per trade
- Tags must be one of: win, fomo, rvg, avg, pnc, vs
- Psychology coaching must name specific cognitive biases, use "I know..." empathetic language
- Counterfactuals must include specific Rs amounts and what the RIGHT action would have been
- Reference exact trade numbers, times, and amounts everywhere
- Return ONLY valid JSON --- no markdown, no backticks, no extra text`;
}


/* ─── Group trades by date and save each day as a separate session ─── */
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic trade/analysis shapes throughout */
type SaveResult = { sessionId?: string; dedupStats?: { tradesAdded: number; tradesSkipped: number; sessionsMerged: number } }

async function saveSessionsByDay({
  trades, analysis, context, metadata, plan, userId, anonId, files,
}: {
  trades: any[]; analysis: any; context: any; metadata: any; plan: string
  userId?: string; anonId?: string; files?: File[]
}): Promise<SaveResult> {
  if (!userId && !anonId) return {}

  // --- 1. Determine per-trade date ---
  // Each trade may have entry_time like "09:15" (time-only) or "2024-03-20 09:15"
  // The extraction prompt returns a session-level trade_date like "2024-03-20"
  // For multi-day files, Claude may return an array of dates or a comma-separated list,
  // but individual trades might have a trade_date field set by Claude.
  const sessionDate = metadata?.trade_date || ''
  const tradeDateMap: Map<string, { trade: any; originalIndex: number }[]> = new Map()

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    // Try to get date from the trade itself
    let dateKey = ''
    if (t.trade_date && /^\d{4}-\d{2}-\d{2}/.test(t.trade_date)) {
      dateKey = t.trade_date.substring(0, 10)
    } else if (t.entry_time && /^\d{4}-\d{2}-\d{2}/.test(t.entry_time)) {
      dateKey = t.entry_time.substring(0, 10)
    } else if (t.date && /^\d{4}-\d{2}-\d{2}/.test(t.date)) {
      dateKey = t.date.substring(0, 10)
    }
    // Fall back to session-level date
    if (!dateKey) dateKey = sessionDate || 'unknown'
    if (!tradeDateMap.has(dateKey)) tradeDateMap.set(dateKey, [])
    tradeDateMap.get(dateKey)!.push({ trade: t, originalIndex: i })
  }

  // --- 2. If only one date group, use current behavior (single session) ---
  const dateGroups = Array.from(tradeDateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  if (dateGroups.length <= 1) {
    // Single day — save as one session (original behavior)
    const saved = await saveTradeSession({
      userId, anonId, trades, analysis, context, metadata, plan,
    })
    const sid = saved?.id
    const ds: DedupStats | undefined = saved?._dedupStats
    if (sid && analysis?.trade_analyses) {
      const merged = trades.map((t: any, i: number) => {
        const ai = (analysis.trade_analyses as any[])?.find((a: any) => a.trade_index === i)
        return ai ? { ...t, ...ai } : t
      })
      saveTradeAnalysis(sid, merged, anonId).catch(err =>
        console.error('Background trade analysis save error:', err)
      )
    }
    if (sid && files) {
      for (const file of files) {
        saveRawFile({
          userId, anonId,
          fileName: file.name, fileType: file.type || getMediaType(file.name),
          fileSize: file.size, fileBuffer: Buffer.from(await file.arrayBuffer()),
          sessionId: sid, brokerDetected: metadata?.detected_broker || 'Unknown',
          tradesCount: trades.length,
        }).catch(err => console.error('Background file save error:', err))
      }
    }
    if (userId) bustDashboardCache(userId)
    return {
      sessionId: sid,
      dedupStats: ds ? {
        tradesAdded: ds.tradesAdded,
        tradesSkipped: ds.tradesSkipped,
        sessionsMerged: ds.sessionMerged ? 1 : 0,
      } : undefined,
    }
  }

  // --- 3. Multi-day: save each date group as its own session ---
  console.log(`Multi-day upload detected: ${dateGroups.length} trading days`)
  let firstSessionId: string | undefined
  const savedSessionIds: string[] = []
  const tradeAnalyses: any[] = analysis?.trade_analyses || []
  let totalAdded = 0, totalSkipped = 0, totalMerged = 0

  for (const [dateKey, group] of dateGroups) {
    const dayTrades = group.map(g => g.trade)
    const originalIndices = group.map(g => g.originalIndex)

    // Remap trade_analyses for this day's trades
    const dayAnalyses = originalIndices.map((origIdx, newIdx) => {
      const ai = tradeAnalyses.find((a: any) => a.trade_index === origIdx)
      return ai ? { ...ai, trade_index: newIdx } : undefined
    }).filter(Boolean)

    // Recompute per-day analysis using code pattern detector on THIS day's trades only
    const dayDetection = detectPatterns(dayTrades)
    const dayAnalysis = buildAnalysisJSON(
      { trades: dayTrades, trade_date: dateKey !== 'unknown' ? dateKey : metadata?.trade_date || '' },
      dayDetection,
      undefined // skip AI coaching for multi-day; batch analyser will handle it
    )
    // Override trade_analyses with the remapped ones (preserving original tag assignments)
    if (dayAnalyses.length > 0) {
      dayAnalysis.trade_analyses = dayAnalyses
    }

    const dayMetadata = {
      ...metadata,
      trade_date: dateKey !== 'unknown' ? dateKey : metadata?.trade_date || '',
    }

    const saved = await saveTradeSession({
      userId, anonId, trades: dayTrades,
      analysis: dayAnalysis, context, metadata: dayMetadata, plan,
    })
    const sid = saved?.id
    const ds: DedupStats | undefined = saved?._dedupStats
    if (ds) {
      totalAdded += ds.tradesAdded
      totalSkipped += ds.tradesSkipped
      if (ds.sessionMerged) totalMerged++
    }
    if (!firstSessionId) firstSessionId = sid
    if (sid) savedSessionIds.push(sid)

    if (sid && dayAnalyses.length > 0) {
      const merged = dayTrades.map((t: any, i: number) => {
        const ai = dayAnalyses.find((a: any) => a.trade_index === i)
        return ai ? { ...t, ...ai } : t
      })
      saveTradeAnalysis(sid, merged, anonId).catch(err =>
        console.error(`Trade analysis save error (${dateKey}):`, err)
      )
    }

    console.log(`Saved session for ${dateKey}: ${dayTrades.length} trades, ID=${sid}, added=${ds?.tradesAdded ?? dayTrades.length}, skipped=${ds?.tradesSkipped ?? 0}`)
  }

  // Save raw files attached to the first session
  if (firstSessionId && files) {
    for (const file of files) {
      saveRawFile({
        userId, anonId,
        fileName: file.name, fileType: file.type || getMediaType(file.name),
        fileSize: file.size, fileBuffer: Buffer.from(await file.arrayBuffer()),
        sessionId: firstSessionId, brokerDetected: metadata?.detected_broker || 'Unknown',
        tradesCount: trades.length,
      }).catch(err => console.error('Background file save error:', err))
    }
  }

  // Auto-trigger batch re-analysis for multi-day uploads (fire-and-forget).
  if (userId && savedSessionIds.length > 1) {
    try {
      const batchId = `multiday_${userId}_${Date.now()}`
      createBatch(batchId, userId, savedSessionIds)
      console.log(`[MULTI_DAY] Auto-queued ${savedSessionIds.length} sessions for batch re-analysis (${batchId})`)
    } catch (batchErr) {
      console.error('[MULTI_DAY] Auto-batch queue failed (non-blocking):', batchErr)
    }
  }

  if (userId) bustDashboardCache(userId)
  return {
    sessionId: firstSessionId,
    dedupStats: (totalSkipped > 0 || totalMerged > 0) ? {
      tradesAdded: totalAdded,
      tradesSkipped: totalSkipped,
      sessionsMerged: totalMerged,
    } : undefined,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  // Rate limit: 5 per IP per 15 min (Claude API cost protection)
  const ip = getClientIp(req);
  const rl = await rateLimit(`analyse:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetIn);

  if (process.env.DISABLE_AI_ANALYSIS === 'true') {
    return NextResponse.json({ error: 'AI analysis temporarily unavailable', code: 'AI_DISABLED' }, { status: 503 });
  }

  const startTime = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'No AI API key configured.' }, { status: 500 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) return handleFormData(req, apiKey, startTime);
    return handleJSON(req, apiKey, startTime);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    console.error('Analysis error:', msg);
    return NextResponse.json({ error: 'Analysis failed. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}

async function handleFormData(req: NextRequest, apiKey: string, startTime: number) {
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  const contextRaw = formData.get('context') as string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed JSON context
  let context: any = {};
  if (contextRaw) { try { context = JSON.parse(contextRaw); } catch { } }

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded. Please upload at least one broker statement.' }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: `File too large: ${file.name}. Maximum 10MB per file.` }, { status: 400 });
    }
  }

  console.log(`[UPLOAD] === ANALYSE: ${files.length} file(s) via FormData ===`);

  const brokerHint = context?.detected_broker || context?.broker || '';

  // Read all file buffers upfront (needed for both parse attempts and hash)
  const fileBuffers: { file: File; buffer: Buffer }[] = [];
  for (const file of files) {
    fileBuffers.push({ file, buffer: Buffer.from(await file.arrayBuffer()) });
  }

  // ─── LEVEL 1: File-level duplicate detection (SHA-256) ───
  // Check BEFORE any parsing/Claude calls to save cost on known duplicates.
  try {
    const { userId: dupCheckUserId } = await auth();
    if (dupCheckUserId && fileBuffers.length > 0) {
      const firstHash = computeFileHash(fileBuffers[0].buffer);
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const sb = getSupabaseAdmin();
      const { data: existingFile } = await sb
        .from('raw_files')
        .select('id, data_rows, parsed_at, file_name')
        .eq('user_id', dupCheckUserId)
        .eq('file_hash', firstHash)
        .maybeSingle();

      if (existingFile) {
        const uploadedDate = existingFile.parsed_at
          ? new Date(existingFile.parsed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'earlier';
        console.log(`[UPLOAD] DUPLICATE FILE detected: hash=${firstHash.slice(0, 12)}... existingId=${existingFile.id}`);
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: `This file was already uploaded on ${uploadedDate}. We found ${existingFile.data_rows || 0} trades from it. No changes made.`,
          rawFileId: existingFile.id,
          tradeCount: existingFile.data_rows || 0,
        });
      }
    }
  } catch (dupErr) {
    // Non-blocking: if dedup check fails, continue with normal processing
    console.warn('[UPLOAD] Duplicate check failed (non-blocking):', dupErr);
  }

  // ─── Quota check for Single (Starter) plan ───
  let userPlan = 'free';
  try {
    const { userId: quotaUserId } = await auth();
    if (quotaUserId) {
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const sb = getSupabaseAdmin();
      const { data: planRow } = await sb
        .from('user_plans')
        .select('plan, session_quota, sessions_used')
        .eq('user_id', quotaUserId)
        .maybeSingle();

      if (planRow) {
        userPlan = planRow.plan || 'free';
        // Single plan has a finite quota; pro plans have NULL (unlimited)
        if (planRow.session_quota !== null && planRow.sessions_used >= planRow.session_quota) {
          return NextResponse.json({
            error: `You've used all ${planRow.session_quota} analyses in your Starter plan. Upgrade to Pro for unlimited analyses.`,
            code: 'QUOTA_EXHAUSTED',
          }, { status: 403 });
        }
      }
    }
  } catch (quotaErr) {
    console.warn('[UPLOAD] Quota check failed (non-blocking):', quotaErr);
  }

  // ─── Try Module 1 intake pipeline first (free, instant, deterministic) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic trade shape
  let trades: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic extracted metadata
  let extracted: any = {};
  let rawFileData: RawFileData | undefined;
  let usedLocalParse = false;
  // Phase 4 sanity gate: surfaced to the client when Claude's JSON output was
  // truncated by the model's max_tokens ceiling so the UI can warn the user.
  let extractionTruncated = false;

  const localParseStart = Date.now();
  for (const { file, buffer } of fileBuffers) {
    console.log(`[UPLOAD] Module 1 trying: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`);
    const intakeResult = await intakeFile(buffer, file.name);
    if (intakeResult.success && intakeResult.trades.length > 0) {
      const legacyTrades = intakeResult.trades.map(toLegacyTrade);
      trades.push(...legacyTrades);
      rawFileData = intakeResult.rawFile;
      extracted = {
        detected_market: intakeResult.rawFile.market,
        detected_currency: intakeResult.rawFile.currency,
        detected_broker: intakeResult.rawFile.broker,
        trade_date: intakeResult.rawFile.tradeDate,
        trades: legacyTrades,
      };
      usedLocalParse = true;
      console.log(`[UPLOAD] Module 1 OK: ${legacyTrades.length} trades, broker=${intakeResult.rawFile.broker}, confidence=${intakeResult.rawFile.confidence} (${intakeResult.rawFile.confidenceScore}/100)`);
    } else {
      console.log(`[UPLOAD] Module 1 returned 0 trades for ${file.name} (${intakeResult.error || 'no structured data'}), will try Claude AI`);
    }
  }
  console.log(`[UPLOAD] Local parse took ${Date.now() - localParseStart}ms`);

  // ─── Fall back to Claude AI extraction if local parse failed ───
  if (trades.length === 0) {
    // Free-tier users: suggest supported formats instead of calling expensive Claude AI
    if (userPlan === 'free') {
      const knownBroker = brokerHint
        ? `We detected this may be a ${brokerHint} file, but couldn't parse it automatically.`
        : 'We couldn\'t parse this file format automatically.'
      return NextResponse.json(
        {
          error: `${knownBroker} Try exporting as CSV from your broker, or upgrade to unlock AI-powered parsing for any file type.`,
          code: 'PARSE_FAILED_FREE',
          upgradeUrl: '/pricing',
          suggestions: [
            brokerHint
              ? `Export trades as CSV from ${brokerHint} (Settings → Reports → Trade History)`
              : 'Export trades as CSV from your broker platform',
            'Use a supported broker format (Zerodha, Groww, Angel One, etc.)',
            'Upgrade to unlock AI parsing for PDFs, screenshots, and unsupported formats',
          ],
        },
        { status: 422 },
      );
    }
    console.log(`[UPLOAD] Claude AI fallback triggered for ${files.length} file(s)`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Anthropic SDK content blocks
    const userContent: any[] = [];
    for (const { file, buffer } of fileBuffers) {
      const mediaType = getMediaType(file.name);
      if (mediaType === 'text/csv') {
        userContent.push({ type: 'text', text: `File: ${file.name}\n\n${buffer.toString('utf-8')}` });
      } else if (mediaType.startsWith('image/')) {
        userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
      } else {
        userContent.push({ type: 'document', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
      }
    }
    userContent.push({ type: 'text', text: brokerHint ? `Extract all trades from these files. Broker: ${brokerHint}` : 'Extract all trades from these files.' });

    console.log(`Call 1: AI extracting trades... (broker hint: ${brokerHint || 'none'})`);
    const c1Start = Date.now();
    // Max_tokens bumped 4096 → 16000 to handle large Fyers-style contract notes (100+ trades).
    // At 4096 the model truncates around trade 13. Claude Sonnet 4 supports up to 64K output tokens.
    // Timeout extended 55s → 75s (inside maxDuration=90s) to let the longer response stream finish.
    const extractResult = await callClaude(apiKey, buildExtractPrompt(brokerHint), userContent, 16000, 75000);
    console.log(`Call 1 took ${Date.now() - c1Start}ms, ok=${extractResult.ok}`);
    if (extractResult.ok && extractResult.usage) {
      try { const { userId: logUid } = await auth(); if (logUid) logAiUsage({ userId: logUid, route: '/api/analyse', model: 'claude-sonnet-4-20250514', inputTokens: extractResult.usage.inputTokens, outputTokens: extractResult.usage.outputTokens }); } catch { /* non-blocking */ }
    }

    // Log Claude response preview for debugging
    if (extractResult.ok) {
      const responsePreview = typeof extractResult.data === 'string'
        ? extractResult.data.substring(0, 400)
        : JSON.stringify(extractResult.data).substring(0, 400);
      console.log(`[UPLOAD] Claude extract response preview: ${responsePreview}`);
    }

    if (!extractResult.ok) {
      const userMsg = extractResult.code === 'TIMEOUT'
        ? 'Analysis is taking longer than expected. Please try again or upload a smaller file.'
        : extractResult.code === 'RATE_LIMIT' || extractResult.code === 'OVERLOADED'
          ? 'Our AI is experiencing high demand. Please try again in a few minutes.'
          : 'Trade extraction failed. Please try again.';
      console.error('Extract failed:', extractResult.error, extractResult.code);
      return NextResponse.json({ error: userMsg, code: extractResult.code || 'EXTRACT_FAILED' }, { status: 502 });
    }
    const extractParsed = safeParseJSON(extractResult.data as string);
    console.log(`[UPLOAD] safeParseJSON ok=${extractParsed.ok}, hasData=${!!extractParsed.data}, truncated=${!!extractParsed.truncated}`);
    if (extractParsed.truncated) {
      extractionTruncated = true;
      const rawLen = typeof extractResult.data === 'string' ? (extractResult.data as string).length : 0;
      console.warn(`[UPLOAD] Claude response was TRUNCATED (raw length=${rawLen}). Some trades may be missing. Consider splitting the file.`);
    }
    if (!extractParsed.ok || !extractParsed.data) {
      const rawStr = typeof extractResult.data === 'string' ? extractResult.data : '';
      console.error(`[UPLOAD] JSON parse failed. Raw response length=${rawStr.length}, first 300 chars: ${rawStr.substring(0, 300)}`);
      return NextResponse.json({ error: 'Could not parse trades from file. Try a different format.' }, { status: 422 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic extracted shape
    extracted = extractParsed.data as any;
    // Claude may return trades under different keys
    trades = extracted.trades || extracted.trade_list || extracted.orders || [];
    // Ensure every trade has a qty field (Claude uses "quantity", downstream expects "qty" too)
    for (const t of trades) {
      if (t.quantity && !t.qty) t.qty = t.quantity;
      if (t.qty && !t.quantity) t.quantity = t.qty;
    }
    console.log(`[UPLOAD] Extracted trades count: ${trades.length}, keys: ${Object.keys(extracted).join(',')}`);

    // Claude often returns individual BUY/SELL legs from contract notes
    // without computing P&L. Pair them and calculate P&L.
    if (trades.length > 0 && tradesNeedPairing(trades)) {
      const prePairCount = trades.length;
      console.log(`[UPLOAD] Claude trades need pairing (${prePairCount} raw legs with null P&L)`);
      const paired = pairClaudeTrades(trades, extracted.trade_date || '');
      // Safety: don't lose trades if pairing reduces to 0
      if (paired.length > 0) {
        trades = paired;
        extracted.trades = trades;
        console.log(`[UPLOAD] Paired ${prePairCount} legs into ${trades.length} trades`);
      } else {
        console.warn(`[UPLOAD] Pairing returned 0 trades from ${prePairCount} legs — keeping original legs`);
      }
    }
  }

  if (trades.length === 0) {
    return NextResponse.json({ error: 'No trades found in the uploaded file(s).' }, { status: 422 });
  }

  console.log(`Call 2: Code-analysing ${trades.length} trades (pattern detector)...`);
  const c2Start = Date.now();
  const netPnl = trades.reduce((s: number, t: { pnl?: number }) => s + (t.pnl || 0), 0);

  // Run pure-code pattern detection — instant, free, deterministic.
  const detection = detectPatterns(trades);
  // Optional tiny Haiku coaching line (~₹0.10). Non-blocking on failure.
  // Skip coaching for free-tier users to avoid unnecessary Claude API costs.
  const coaching = userPlan === 'free'
    ? undefined
    : await generateAICoaching(apiKey, detection).catch(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- analysis JSONB shape
  const analysis: any = buildAnalysisJSON({ trades, trade_date: extracted.trade_date }, detection, coaching);
  // Stamp per-trade tags onto trades so the client-side UI can render immediately.
  for (const ta of analysis.trade_analyses || []) {
    const i = typeof ta.trade_index === 'number' ? ta.trade_index : -1;
    if (i >= 0 && trades[i]) {
      trades[i].tag = ta.tag;
      trades[i].label = ta.tag_label;
    }
  }
  console.log(`Call 2 took ${Date.now() - c2Start}ms (code analysis)`);

  const response = {
    success: true, trades,
    analysis: analysis || { session_summary: 'AI analysis unavailable --- showing extracted trades.', momentum_indicators: [], vicious_cycle: [], technical_insights: [], trade_analyses: [] },
    metadata: {
      detected_market: extracted.detected_market || 'Unknown', detected_currency: extracted.detected_currency || 'INR',
      detected_broker: extracted.detected_broker || 'Unknown', trade_date: extracted.trade_date || '',
      trade_count: trades.length, net_pnl: Math.round(netPnl * 100) / 100,
      processing_time_ms: Date.now() - startTime,
      ...(extractionTruncated ? {
        extraction_warning: 'Some trades may be missing — the AI response hit its output-token ceiling. Try uploading fewer pages at a time.',
      } : {}),
    },
  };

  let savedSessionId: string | undefined;
  let dedupStats: SaveResult['dedupStats'];
  try {
    const { userId } = await auth();
    const anonId = userId ? undefined : await getOrCreateAnonId();
    console.log(`[UPLOAD] Saving session: userId=${userId ? 'yes' : 'no'}, anonId=${anonId ? 'yes' : 'no'}, trades=${trades.length}, localParse=${usedLocalParse}`);

    // Save raw file data — GUARANTEED path. Tries local-parse save first (if we have
    // rawFileData), then falls back to a Claude-extracted record so every authenticated
    // upload lands a raw_files row. Previous version skipped silently when
    // usedLocalParse=true && rawFileData=null (the Aditya case).
    let rawFileId: string | undefined;
    if (userId) {
      // Cap raw_data JSONB size — Postgres JSONB tolerates large payloads but
      // dashboard reads get slow past a few thousand rows.
      const MAX_RAW_ROWS = 5000;

      // Branch A: Module 1 local parse produced rawFileData → save it.
      if (rawFileData) {
        try {
          const trimmed = rawFileData.rows.length > MAX_RAW_ROWS
            ? {
                ...rawFileData,
                rows: rawFileData.rows.slice(0, MAX_RAW_ROWS),
                warnings: [
                  ...(rawFileData.warnings || []),
                  `raw_data truncated from ${rawFileData.rows.length} to ${MAX_RAW_ROWS} rows for storage`,
                ],
              }
            : rawFileData;
          const rawResult = await saveRawData(trimmed, userId);
          if ('id' in rawResult) {
            rawFileId = rawResult.id;
            console.log(`[UPLOAD] Raw file saved (local parse): ${rawFileId}`);
          } else {
            console.error(`[UPLOAD] Raw save FAILED (local): ${rawResult.error} | file=${rawFileData.filename} rows=${rawFileData.rows.length}`);
          }
        } catch (rawErr) {
          console.error('[UPLOAD] Raw save THREW (local):', rawErr);
        }
      }

      // Branch B: No local row yet (either rawFileData was missing, or Branch A failed)
      // — fall back to a Claude-extracted record so we ALWAYS have a raw_files row.
      if (!rawFileId && fileBuffers.length > 0 && trades.length > 0) {
        try {
          const firstFile = fileBuffers[0];
          const fileHash = computeFileHash(firstFile.buffer);
          const cappedTrades = trades.length > MAX_RAW_ROWS ? trades.slice(0, MAX_RAW_ROWS) : trades;
          const rawResult = await saveClaudeFallbackRawData({
            filename: firstFile.file.name,
            fileHash,
            fileSizeBytes: firstFile.file.size,
            broker: extracted.detected_broker || 'Unknown',
            market: extracted.detected_market || 'Unknown',
            currency: extracted.detected_currency || 'INR',
            tradeDate: extracted.trade_date || '',
            tradeCount: trades.length,
            trades: cappedTrades,
          }, userId);
          if ('id' in rawResult) {
            rawFileId = rawResult.id;
            console.log(`[UPLOAD] Raw file saved (${usedLocalParse ? 'local-parse fallback' : 'Claude fallback'}): ${rawFileId}`);
          } else {
            console.error(`[UPLOAD] Raw save FAILED (fallback): ${rawResult.error} | file=${firstFile.file.name} trades=${trades.length}`);
          }
        } catch (rawErr) {
          console.error('[UPLOAD] Raw save THREW (fallback):', rawErr);
        }
      }

      if (!rawFileId) {
        console.error(`[UPLOAD] CRITICAL: no raw_files row created | userId=${userId} trades=${trades.length} localParse=${usedLocalParse} hasRawFileData=${!!rawFileData} fileBuffers=${fileBuffers.length}`);
      }
    }

    const saveResult = await saveSessionsByDay({
      trades, analysis: response.analysis, context,
      metadata: {
        detected_market: extracted.detected_market || 'Unknown',
        detected_currency: extracted.detected_currency || 'INR',
        detected_broker: extracted.detected_broker || 'Unknown',
        trade_date: extracted.trade_date || '',
        raw_file_id: rawFileId,
        file_name: fileBuffers[0]?.file.name || 'upload',
      },
      plan: userPlan, userId: userId || undefined, anonId, files,
    });
    savedSessionId = saveResult.sessionId;
    dedupStats = saveResult.dedupStats;
    console.log(`[UPLOAD] Session saved: ${savedSessionId || 'none'}, rawFileId: ${rawFileId || 'none'}, dedup: added=${dedupStats?.tradesAdded ?? 'n/a'} skipped=${dedupStats?.tradesSkipped ?? 0} merged=${dedupStats?.sessionsMerged ?? 0}`);

    // Increment session usage for single (starter) plan
    if (savedSessionId && userId && userPlan === 'single') {
      try {
        const { getSupabaseAdmin } = await import('@/lib/supabase');
        const sbQuota = getSupabaseAdmin();
        const { data: curr } = await sbQuota
          .from('user_plans')
          .select('sessions_used')
          .eq('user_id', userId)
          .single();
        await sbQuota
          .from('user_plans')
          .update({ sessions_used: (curr?.sessions_used || 0) + 1 })
          .eq('user_id', userId);
      } catch (quotaErr) {
        console.error('[UPLOAD] Failed to increment session quota (non-blocking):', quotaErr);
      }
    }

    // Link raw_file_id to session (update raw_files row with session_id)
    if (rawFileId && savedSessionId && userId) {
      try {
        const { getSupabaseAdmin } = await import('@/lib/supabase');
        const sb = getSupabaseAdmin();
        await sb.from('raw_files').update({ session_id: savedSessionId }).eq('id', rawFileId);
        console.log('[UPLOAD] Linked raw_file ' + rawFileId + ' to session ' + savedSessionId);
      } catch (linkErr) {
        console.error('[UPLOAD] Failed to link session to raw file:', linkErr);
      }
    }
  } catch (e) {
    console.error('[UPLOAD] Session save failed (non-blocking):', e);
  }

  // Fire-and-forget: send analysis complete email for fresh uploads
  try {
    const { userId: emailUserId } = await auth();
    if (emailUserId && savedSessionId) {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(emailUserId);
      const userEmail = user.emailAddresses?.[0]?.emailAddress;
      if (userEmail) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = response.analysis as any;
        const patterns = a?.mistake_patterns || a?.patterns_detected || [];
        const topPattern = patterns.length > 0 ? patterns.reduce((best: { cost?: number }, p: { cost?: number }) => ((p.cost || 0) > (best.cost || 0) ? p : best), patterns[0]) : null;
        sendEmail({
          to: userEmail,
          subject: `Your ${extracted.trade_date || 'trading'} report is ready`,
          html: analysisCompleteHtml({
            name: user.firstName || userEmail.split('@')[0],
            sessionDate: extracted.trade_date || new Date().toISOString().split('T')[0],
            tradeCount: trades.length,
            netPnl,
            dqsScore: Number(a?.dqs?.score) || 0,
            topIssue: topPattern?.name || topPattern?.label || undefined,
            topIssueCost: topPattern?.cost ? Math.abs(Number(topPattern.cost)) : undefined,
            currency: extracted.detected_currency || 'INR',
          }),
          text: analysisCompleteText({
            name: user.firstName || userEmail.split('@')[0],
            sessionDate: extracted.trade_date || new Date().toISOString().split('T')[0],
            tradeCount: trades.length,
            netPnl,
            dqsScore: Number(a?.dqs?.score) || 0,
            topIssue: topPattern?.name || topPattern?.label || undefined,
            topIssueCost: topPattern?.cost ? Math.abs(Number(topPattern.cost)) : undefined,
            currency: extracted.detected_currency || 'INR',
          }),
        }).catch(err => console.error('[ANALYSIS_EMAIL_FAILED]', err));
      }
    }
  } catch (emailErr) {
    console.error('[ANALYSIS_EMAIL] Non-blocking error:', emailErr);
  }

  console.log(`[UPLOAD] Complete: ${Date.now() - startTime}ms | ${trades.length} trades | Net P&L: ${netPnl} | localParse: ${usedLocalParse} | sessionId: ${savedSessionId || 'none'}`);
  return NextResponse.json({
    ...response,
    sessionId: savedSessionId || null,
    _parsed_locally: usedLocalParse,
    ...(dedupStats ? {
      tradesAdded: dedupStats.tradesAdded,
      tradesSkipped: dedupStats.tradesSkipped,
      sessionsMerged: dedupStats.sessionsMerged,
    } : {}),
  });
}

async function handleJSON(req: NextRequest, apiKey: string, startTime: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed JSON body
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { trades, kpis, broker, market, trade_date, currency, time_analysis, context, file_hash, file_size_bytes, raw_file_id } = body;

  if (!trades || !Array.isArray(trades) || trades.length === 0) {
    return NextResponse.json({ error: 'No trades provided. Please upload a broker statement.' }, { status: 400 });
  }

  let contextStr = '';
  if (context && typeof context === 'object') {
    contextStr = Object.entries(context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
  }

  console.log(`=== ANALYSE: ${trades.length} pre-parsed trades via JSON (code analysis) ===`);

  // Resolve user plan for session save + quota check
  let userPlanJSON = 'free';
  const { userId: quotaUserIdJSON } = await auth();
  if (quotaUserIdJSON) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const sb = getSupabaseAdmin();
      const { data: planRow } = await sb
        .from('user_plans')
        .select('plan, session_quota, sessions_used')
        .eq('user_id', quotaUserIdJSON)
        .maybeSingle();
      if (planRow) {
        userPlanJSON = planRow.plan || 'free';
        if (planRow.session_quota !== null && planRow.sessions_used >= planRow.session_quota) {
          return NextResponse.json({
            error: `You've used all ${planRow.session_quota} analyses in your Starter plan. Upgrade to Pro for unlimited analyses.`,
            code: 'QUOTA_EXHAUSTED',
          }, { status: 403 });
        }
      }
    } catch { /* non-blocking */ }
  }

  // Silence unused warnings while keeping back-compat signature.
  void contextStr; void kpis; void time_analysis;

  // Run pure-code analysis — instant, free.
  const detection = detectPatterns(trades);
  // Skip coaching for free-tier users to avoid unnecessary Claude API costs.
  const coaching = userPlanJSON === 'free'
    ? undefined
    : await generateAICoaching(apiKey, detection).catch(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- full analysis JSONB
  const codeAnalysis: any = buildAnalysisJSON({ trades, trade_date }, detection, coaching);

  const buildResponse = (aiAnalysis?: Record<string, unknown>, aiError?: string) => ({
    success: true,
    trades,
    analysis: aiAnalysis ? {
      session_summary: (aiAnalysis.session_summary || aiAnalysis.summary || '') as string,
      momentum_indicators: (aiAnalysis.momentum_indicators || aiAnalysis.momentum || []) as unknown[],
      vicious_cycle: (aiAnalysis.vicious_cycle || []) as unknown[],
      technical_insights: (aiAnalysis.technical_insights || []) as unknown[],
      dqs: aiAnalysis.dqs || null,
      financial_impact: aiAnalysis.financial_impact || null,
      mistake_patterns: aiAnalysis.mistake_patterns || [],
      rules_for_next_session: aiAnalysis.rules_for_next_session || [],
      cross_user_insight: aiAnalysis.cross_user_insight || null,
      trade_analyses: aiAnalysis.trade_analyses || [],
    } : {
      session_summary: `${trades.length} trades from ${broker || 'Unknown'}. AI coaching unavailable --- showing your locally parsed results.`,
      momentum_indicators: [], vicious_cycle: [], technical_insights: [],
      trade_analyses: [],
    },
    metadata: {
      detected_market: market || 'NSE',
      detected_currency: currency || 'INR',
      detected_broker: broker || 'Unknown',
      trade_date: trade_date || '',
      trade_count: trades.length,
      net_pnl: kpis?.net_pnl || trades.reduce((s: number, t: { pnl?: number }) => s + (t.pnl || 0), 0),
      processing_time_ms: Date.now() - startTime,
    },
    _ai_failed: !aiAnalysis,
    _ai_error: aiError,
    _parsed_locally: true,
  });

  let saveResult: SaveResult = {};

  const saveSession = async (responseObj: ReturnType<typeof buildResponse>) => {
    try {
      const { userId } = await auth();
      const anonId = userId ? undefined : await getOrCreateAnonId();

      // Prefer the raw_file_id that /api/parse already created (authoritative raw data
      // from the actual uploaded file). Fall back to creating a Claude-style record here
      // if parse didn't save one (e.g. anonymous at parse time, then signed in by analyse,
      // or /api/parse was bypassed).
      let effectiveRawFileId: string | undefined = raw_file_id;

      if (!effectiveRawFileId && userId && file_hash) {
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase');
          const sb = getSupabaseAdmin();
          const { data: existing } = await sb
            .from('raw_files')
            .select('id')
            .eq('user_id', userId)
            .eq('file_hash', file_hash)
            .maybeSingle();
          if (existing?.id) {
            effectiveRawFileId = existing.id;
            console.log('[Analyse/JSON] Recovered raw_file_id by hash:', effectiveRawFileId);
          }
        } catch (lookupErr) {
          console.error('[Analyse/JSON] raw_files hash lookup failed:', lookupErr);
        }
      }

      if (!effectiveRawFileId && userId && file_hash) {
        // Last-resort fallback — still create a raw_files row from the pre-parsed trades
        const rawResult = await saveClaudeFallbackRawData({
          filename: `parsed-upload-${trade_date || 'unknown'}.csv`,
          fileHash: file_hash,
          fileSizeBytes: file_size_bytes || 0,
          broker: broker || 'Unknown',
          market: market || 'Unknown',
          currency: currency || 'INR',
          tradeDate: trade_date || '',
          tradeCount: trades.length,
          trades,
        }, userId);
        if ('id' in rawResult) {
          effectiveRawFileId = rawResult.id;
          console.log('[Analyse/JSON] Created fallback raw_files record:', rawResult.id);
        } else {
          console.error(`[Analyse/JSON] raw_files FALLBACK save FAILED: ${rawResult.error} | user=${userId} hash=${file_hash}`);
        }
      }

      if (userId && !effectiveRawFileId) {
        console.error(`[Analyse/JSON] No raw_file_id available for session — raw lineage will be lost | user=${userId} hasHash=${!!file_hash} trades=${trades.length}`);
      }

      saveResult = await saveSessionsByDay({
        trades, analysis: responseObj.analysis, context: context || {},
        metadata: {
          detected_market: market || 'Unknown',
          detected_currency: currency || 'INR',
          detected_broker: broker || 'Unknown',
          trade_date: trade_date || '',
          raw_file_id: effectiveRawFileId,
        },
        plan: userPlanJSON, userId: userId || undefined, anonId,
      });

      // Increment session usage for single (starter) plan — JSON path
      if (saveResult?.sessionId && userId && userPlanJSON === 'single') {
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase');
          const sbQ = getSupabaseAdmin();
          const { data: curr } = await sbQ
            .from('user_plans')
            .select('sessions_used')
            .eq('user_id', userId)
            .single();
          await sbQ
            .from('user_plans')
            .update({ sessions_used: (curr?.sessions_used || 0) + 1 })
            .eq('user_id', userId);
        } catch (qErr) {
          console.error('[Analyse/JSON] Failed to increment session quota:', qErr);
        }
      }

      // Link the raw_files row back to the saved session
      if (effectiveRawFileId && saveResult?.sessionId && userId) {
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase');
          const sb = getSupabaseAdmin();
          await sb.from('raw_files').update({ session_id: saveResult.sessionId }).eq('id', effectiveRawFileId);
          console.log(`[Analyse/JSON] Linked raw_file ${effectiveRawFileId} to session ${saveResult.sessionId}`);
        } catch (linkErr) {
          console.error('[Analyse/JSON] Failed to link raw_file to session:', linkErr);
        }
      }
    } catch (e) {
      console.error('Session save failed (non-blocking):', e);
    }
  };

  // Stamp per-trade tags onto each trade (legacy UI expects trade.tag + trade.label)
  for (const ta of codeAnalysis.trade_analyses || []) {
    const i = typeof ta.trade_index === 'number' ? ta.trade_index : -1;
    if (i >= 0 && trades[i]) {
      trades[i].tag = ta.tag;
      trades[i].label = ta.tag_label;
    }
  }

  const finalResponse = buildResponse(codeAnalysis);
  await saveSession(finalResponse);

  // Fire-and-forget: send analysis complete email for fresh uploads
  try {
    const { userId: emailUserId } = await auth();
    if (emailUserId) {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(emailUserId);
      const userEmail = user.emailAddresses?.[0]?.emailAddress;
      if (userEmail) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = codeAnalysis as any;
        const patterns = a?.mistake_patterns || a?.patterns_detected || [];
        const topPattern = patterns.length > 0 ? patterns.reduce((best: { cost?: number }, p: { cost?: number }) => ((p.cost || 0) > (best.cost || 0) ? p : best), patterns[0]) : null;
        sendEmail({
          to: userEmail,
          subject: `Your ${trade_date || 'trading'} report is ready`,
          html: analysisCompleteHtml({
            name: user.firstName || userEmail.split('@')[0],
            sessionDate: trade_date || new Date().toISOString().split('T')[0],
            tradeCount: trades.length,
            netPnl: trades.reduce((s: number, t: { pnl?: number }) => s + (t.pnl || 0), 0),
            dqsScore: Number(a?.dqs?.score) || 0,
            topIssue: topPattern?.name || topPattern?.label || undefined,
            topIssueCost: topPattern?.cost ? Math.abs(Number(topPattern.cost)) : undefined,
            currency: currency || 'INR',
          }),
          text: analysisCompleteText({
            name: user.firstName || userEmail.split('@')[0],
            sessionDate: trade_date || new Date().toISOString().split('T')[0],
            tradeCount: trades.length,
            netPnl: trades.reduce((s: number, t: { pnl?: number }) => s + (t.pnl || 0), 0),
            dqsScore: Number(a?.dqs?.score) || 0,
            topIssue: topPattern?.name || topPattern?.label || undefined,
            topIssueCost: topPattern?.cost ? Math.abs(Number(topPattern.cost)) : undefined,
            currency: currency || 'INR',
          }),
        }).catch(err => console.error('[ANALYSIS_EMAIL_FAILED]', err));
      }
    }
  } catch (emailErr) {
    console.error('[ANALYSIS_EMAIL] Non-blocking error:', emailErr);
  }

  console.log(`Analysis complete: ${Date.now() - startTime}ms (code)`);
  const ds = saveResult.dedupStats;
  return NextResponse.json({
    ...finalResponse,
    ...(ds ? {
      tradesAdded: ds.tradesAdded,
      tradesSkipped: ds.tradesSkipped,
      sessionsMerged: ds.sessionsMerged,
    } : {}),
  });
}
