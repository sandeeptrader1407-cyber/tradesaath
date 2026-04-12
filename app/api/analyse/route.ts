export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveTradeSession } from '@/lib/supabase/saveTrades';
import { saveRawFile } from '@/lib/supabase/saveFile';
import { saveTradeAnalysis } from '@/lib/supabase/saveTradeAnalysis';
import { getOrCreateAnonId } from '@/lib/anonId';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

type AIResult = { ok: boolean; data?: unknown; error?: string; code?: string };

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
    return { ok: true, data: text };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
    const msg = isAbort ? `Claude timed out (${Math.round(timeoutMs / 1000)}s)` : (err instanceof Error ? err.message : 'Claude error');
    return { ok: false, error: msg, code: isAbort ? 'TIMEOUT' : 'NETWORK' };
  }
}

/* ─── JSON parser with truncation recovery ─── */
function safeParseJSON(raw: string): { ok: boolean; data?: unknown; truncated?: boolean } {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return { ok: true, data: JSON.parse(cleaned) }; } catch { /* fall through */ }
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
{"trades":[{"symbol":"...","side":"BUY"|"SELL","entry_price":N,"exit_price":N,"quantity":N,"entry_time":"HH:MM","exit_time":"HH:MM","pnl":N}],"detected_market":"NSE"|"NYSE"|"Forex"|"Crypto"|"Unknown","detected_currency":"INR"|"USD"|"EUR","detected_broker":"Zerodha"|"Angel One"|"Unknown","trade_date":"YYYY-MM-DD"}
Rules: P&L for BUY=(exit-entry)*qty, SELL=(entry-exit)*qty. If only one leg, set missing to null. Parse ALL trades. 24h times. Return ONLY valid JSON.`
}

function buildAnalysePrompt(context: Record<string, string | number | null | undefined>): string {
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

export async function POST(req: NextRequest) {
  // Rate limit: 5 per IP per 15 min (Claude API cost protection)
  const ip = getClientIp(req);
  const rl = rateLimit(`analyse:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetIn);

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

  console.log(`=== ANALYSE: ${files.length} file(s) via FormData ===`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Anthropic SDK content blocks
  const userContent: any[] = [];
  for (const file of files) {
    const mediaType = getMediaType(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (mediaType === 'text/csv') {
      userContent.push({ type: 'text', text: `File: ${file.name}\n\n${buffer.toString('utf-8')}` });
    } else if (mediaType.startsWith('image/')) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
    } else {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
    }
  }
  const brokerHint = context?.detected_broker || context?.broker || '';
  userContent.push({ type: 'text', text: brokerHint ? `Extract all trades from these files. Broker: ${brokerHint}` : 'Extract all trades from these files.' });

  console.log(`Call 1: Extracting trades... (broker hint: ${brokerHint || 'none'})`);
  const c1Start = Date.now();
  const extractResult = await callClaude(apiKey, buildExtractPrompt(brokerHint), userContent, 4096, 55000);
  console.log(`Call 1 took ${Date.now() - c1Start}ms`);

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
  if (!extractParsed.ok || !extractParsed.data) {
    return NextResponse.json({ error: 'Could not parse trades from file. Try a different format.' }, { status: 422 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic extracted shape
  const extracted = extractParsed.data as any;
  const trades = extracted.trades || [];
  if (trades.length === 0) {
    return NextResponse.json({ error: 'No trades found in the uploaded file(s).' }, { status: 422 });
  }

  console.log(`Call 2: Analysing ${trades.length} trades...`);
  const c2Start = Date.now();
  const elapsed = Date.now() - startTime;
  const c2Timeout = Math.min(Math.max(70000 - elapsed, 10000) - 2000, 55000);
  const netPnl = trades.reduce((s: number, t: { pnl?: number }) => s + (t.pnl || 0), 0);

  const analyseResult = await callClaude(
    apiKey, buildAnalysePrompt(context),
    [{ type: 'text', text: `Extracted trades:\n${JSON.stringify(trades, null, 2)}\nTotal: ${trades.length}, Net P&L: ${netPnl}` }],
    8192, c2Timeout,
  );
  console.log(`Call 2 took ${Date.now() - c2Start}ms`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI response shape varies
  let analysis: any = null;
  if (analyseResult.ok) {
    const ap = safeParseJSON(analyseResult.data as string);
    if (ap.ok && ap.data) analysis = ap.data;
  }

  const response = {
    success: true, trades,
    analysis: analysis || { session_summary: 'AI analysis unavailable --- showing extracted trades.', momentum_indicators: [], vicious_cycle: [], technical_insights: [], trade_analyses: [] },
    metadata: {
      detected_market: extracted.detected_market || 'Unknown', detected_currency: extracted.detected_currency || 'INR',
      detected_broker: extracted.detected_broker || 'Unknown', trade_date: extracted.trade_date || '',
      trade_count: trades.length, net_pnl: Math.round(netPnl * 100) / 100,
      processing_time_ms: Date.now() - startTime,
    },
  };

  let savedSessionId: string | undefined;
  try {
    const { userId } = await auth();
    const anonId = userId ? undefined : await getOrCreateAnonId();
    const owner = userId || anonId;

    if (owner) {
      const saved = await saveTradeSession({
        userId: userId || undefined,
        anonId,
        trades,
        analysis: response.analysis,
        context,
        metadata: {
          detected_market: extracted.detected_market || 'Unknown',
          detected_currency: extracted.detected_currency || 'INR',
          detected_broker: extracted.detected_broker || 'Unknown',
          trade_date: extracted.trade_date || '',
        },
        plan: 'free',
      });
      savedSessionId = saved?.id;
      console.log(`Session saved to Supabase for ${userId ? 'user ' + userId : 'anon ' + anonId}`);

      if (savedSessionId && response.analysis?.trade_analyses) {
        /* eslint-disable @typescript-eslint/no-explicit-any -- dynamic trade/AI shapes */
        const mergedTrades = trades.map((t: any, i: number) => {
          const ai = (response.analysis.trade_analyses as any[])?.find((a: any) => a.trade_index === i);
          return ai ? { ...t, ...ai } : t;
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */
        saveTradeAnalysis(savedSessionId, mergedTrades, anonId).catch(err =>
          console.error('Background trade analysis save error:', err)
        );
      }

      for (const file of files) {
        saveRawFile({
          userId: userId || undefined,
          anonId,
          fileName: file.name,
          fileType: file.type || getMediaType(file.name),
          fileSize: file.size,
          fileBuffer: Buffer.from(await file.arrayBuffer()),
          sessionId: savedSessionId,
          brokerDetected: extracted.detected_broker || 'Unknown',
          tradesCount: trades.length,
        }).catch(err => console.error('Background file save error:', err));
      }
    }
  } catch (e) {
    console.error('Session save failed (non-blocking):', e);
  }

  console.log(`Total: ${Date.now() - startTime}ms | ${trades.length} trades | Net P&L: ${netPnl}`);
  return NextResponse.json(response);
}

async function handleJSON(req: NextRequest, apiKey: string, startTime: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed JSON body
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { trades, kpis, broker, market, trade_date, currency, time_analysis, context } = body;

  if (!trades || !Array.isArray(trades) || trades.length === 0) {
    return NextResponse.json({ error: 'No trades provided. Please upload a broker statement.' }, { status: 400 });
  }

  let contextStr = '';
  if (context && typeof context === 'object') {
    contextStr = Object.entries(context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
  }

  console.log(`=== ANALYSE: ${trades.length} pre-parsed trades via JSON ===`);

  const promptText = `Trade data: Broker=${broker || 'Unknown'}, Market=${market || 'NSE'}, Date=${trade_date || ''}, Currency=${currency || 'INR'}
${contextStr ? `Context: ${contextStr}` : ''}
KPIs: ${JSON.stringify(kpis || {})}
Time: ${JSON.stringify(time_analysis || {})}
Trades: ${JSON.stringify(trades)}
Analyse EVERY trade.`;

  const elapsed = Date.now() - startTime;
  const claudeTimeout = Math.min(Math.max(60000 - elapsed, 8000) - 2000, 55000);

  const aiResult = await callClaude(apiKey, buildAnalysePrompt(context || {}), [{ type: 'text', text: promptText }], 8192, claudeTimeout);

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

  const saveSession = async (responseObj: ReturnType<typeof buildResponse>) => {
    try {
      const { userId } = await auth();
      const anonId = userId ? undefined : await getOrCreateAnonId();
      const owner = userId || anonId;

      if (owner) {
        const saved = await saveTradeSession({
          userId: userId || undefined,
          anonId,
          trades,
          analysis: responseObj.analysis,
          context: context || {},
          metadata: {
            detected_market: market || 'Unknown',
            detected_currency: currency || 'INR',
            detected_broker: broker || 'Unknown',
            trade_date: trade_date || '',
          },
          plan: 'free',
        });
        console.log(`Session saved to Supabase for ${userId ? 'user ' + userId : 'anon ' + anonId}`);

        if (saved?.id && responseObj.analysis?.trade_analyses) {
          /* eslint-disable @typescript-eslint/no-explicit-any -- dynamic trade/AI shapes */
          const mergedTrades = trades.map((t: any, i: number) => {
            const ai = (responseObj.analysis.trade_analyses as any[])?.find((a: any) => a.trade_index === i);
            return ai ? { ...t, ...ai } : t;
          });
          /* eslint-enable @typescript-eslint/no-explicit-any */
          saveTradeAnalysis(saved.id, mergedTrades, anonId).catch(err =>
            console.error('Background trade analysis save error:', err)
          );
        }
      }
    } catch (e) {
      console.error('Session save failed (non-blocking):', e);
    }
  };

  if (!aiResult.ok) {
    console.warn('AI failed:', aiResult.error);
    const resp = buildResponse(undefined, aiResult.error);
    await saveSession(resp);
    return NextResponse.json(resp);
  }

  const aiParsed = safeParseJSON(aiResult.data as string);
  if (!aiParsed.ok || !aiParsed.data) {
    const resp = buildResponse(undefined, 'Failed to parse AI response');
    await saveSession(resp);
    return NextResponse.json(resp);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI response shape
  const analysis = aiParsed.data as any;

  if (analysis.trade_tags) {
    for (const [idx, tag] of Object.entries(analysis.trade_tags)) {
      const i = parseInt(idx);

      if (trades[i]) { trades[i].tag = tag as string; trades[i].label = (tag as string).replace(/_/g, ' '); }
    }
  }
  if (Array.isArray(analysis.trades_deep)) {
    for (const deep of analysis.trades_deep) {
      const i = typeof deep?.index === 'number' ? deep.index : -1;
      if (i >= 0 && trades[i]) trades[i] = { ...trades[i], ...deep };
    }
  }
  if (analysis.first_trade_detail && trades.length > 0) {
    trades[0] = { ...trades[0], ...analysis.first_trade_detail };
  }

  const finalResponse = buildResponse(analysis);
  await saveSession(finalResponse);

  console.log(`Analysis complete: ${Date.now() - startTime}ms`);
  return NextResponse.json(finalResponse);
}
