export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';
import { DEMO_RESPONSE } from '@/lib/demoData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIResult = { ok: boolean; data?: any; error?: string; code?: string };

/* ─── Call Claude API ─── */
async function callClaude(
  apiKey: string, systemPrompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userContent: any[], maxTokens: number, timeoutMs = 55000,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try { data = await response.json(); } catch { return { ok: false, error: `Claude HTTP ${response.status}`, code: 'PARSE' }; }
    if (!response.ok || data.error) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${response.status}`;
      console.error('Claude API error:', JSON.stringify(data.error || data));
      return { ok: false, error: `Claude: ${errMsg}`, code: data.error?.type || `HTTP_${response.status}` };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
    return { ok: true, data: text };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
    const msg = isAbort ? `Claude timed out (${Math.round(timeoutMs / 1000)}s)` : (err instanceof Error ? err.message : 'Claude error');
    return { ok: false, error: msg, code: isAbort ? 'TIMEOUT' : 'NETWORK' };
  }
}

/* ─── JSON parser with truncation recovery ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseJSON(raw: string): { ok: boolean; data?: any; truncated?: boolean } {
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
const EXTRACT_SYSTEM = `You are a trade extraction engine. Extract ALL trades from this broker statement/file.
For each trade return EXACTLY this JSON:
{"trades":[{"symbol":"...","side":"BUY"|"SELL","entry_price":N,"exit_price":N,"quantity":N,"entry_time":"HH:MM","exit_time":"HH:MM","pnl":N}],"detected_market":"NSE"|"NYSE"|"Forex"|"Crypto"|"Unknown","detected_currency":"INR"|"USD"|"EUR","detected_broker":"Zerodha"|"Angel One"|"Unknown","trade_date":"YYYY-MM-DD"}
Rules: P&L for BUY=(exit-entry)*qty, SELL=(entry-exit)*qty. If only one leg, set missing to null. Parse ALL trades. 24h times. Return ONLY valid JSON.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAnalysePrompt(context: any): string {
  const ctxLines = context ? Object.entries(context).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'No additional context.';
  return `You are TradeSaath, an AI trading psychology coach. Analyse trades with brutal honesty, deep empathy, and specific actionable coaching.

Return this JSON structure:
{
  "session_summary": "3-4 paragraph narrative. Use 'you' language. Reference exact trade numbers, times, amounts. Bold key phrases with **bold**.",
  "momentum_indicators": [{"name":"Rule Following","score":0-100,"description":"..."},{"name":"Staying Calm","score":0-100,"description":"..."},{"name":"Entry Timing","score":0-100,"description":"..."},{"name":"Exit Discipline","score":0-100,"description":"..."}],
  "vicious_cycle": [{"stage":"Disciplined Win","count":N,"icon":"✓","description":"..."},{"stage":"Overconfidence","count":N,"icon":"⚡","description":"..."},{"stage":"Larger Position","count":N,"icon":"📈","description":"..."},{"stage":"Market Goes Against","count":N,"icon":"↘","description":"..."},{"stage":"Hope & Hold","count":N,"icon":"🙏","description":"..."},{"stage":"Averaging Down","count":N,"icon":"📉","description":"..."},{"stage":"Panic Exit","count":N,"icon":"💨","description":"..."},{"stage":"Revenge Trade","count":N,"icon":"⚔","description":"..."},{"stage":"Decision Fatigue","count":N,"icon":"😵","description":"..."},{"stage":"FOMO Re-entry","count":N,"icon":"🔄","description":"..."}],
  "technical_insights": [{"name":"Trend Alignment","score":0-100,"description":"..."},{"name":"Entry Structure","score":0-100,"description":"..."},{"name":"Exit Quality","score":0-100,"description":"..."},{"name":"Entry Timing","score":0-100,"description":"..."}],
  "dqs": {"score":0-100,"factors":[{"name":"Entry Timing","score":0-100,"color":"green|blue|gold|red"},{"name":"Risk Management","score":0-100,"color":"..."},{"name":"Position Sizing","score":0-100,"color":"..."},{"name":"Emotional Control","score":0-100,"color":"..."},{"name":"Exit Discipline","score":0-100,"color":"..."}]},
  "financial_impact": {"total_lost_to_mistakes":N,"potential_pnl_without_mistakes":N,"message":"..."},
  "mistake_patterns": [{"name":"...","icon":"emoji","count":N,"cost":N,"frequency":"X of Y"}],
  "rules_for_next_session": ["rule 1","rule 2","rule 3"],
  "cross_user_insight": "From 847 traders: one anonymised insight",
  "trade_analyses": [{"trade_index":0,"tag":"win|fomo|rvg|avg|pnc|vs","tag_label":"...","quick_summary":"...","technical_analysis":"...","psychology_coaching":"...","counterfactual":"...","cycle_stage":"win|overconf|large|vs|hope|avg|pnc|rvg|fatigue|fomo"}]
}

THE 10-STAGE VICIOUS CYCLE: 1.Disciplined Win 2.Overconfidence 3.Larger Position 4.Market Goes Against 5.Hope & Hold 6.Averaging Down 7.Panic Exit 8.Revenge Trade 9.Decision Fatigue 10.FOMO Re-entry
DETECTION: After 2+ wins→Overconfidence risk. Loss+re-entry<5min→Revenge. 2+ losses→Hope/Averaging/Panic. Trades after 2PM with losses→highest revenge risk. >15 trades→Decision Fatigue. Entry near high after rally→FOMO.

Context about the trader:
${ctxLines}

CRITICAL: Analyse EVERY trade. Tags must be: win,fomo,rvg,avg,pnc,vs. Psychology coaching uses "I know..." language. Counterfactuals include specific amounts. Return ONLY valid JSON.`;
}

/* ═══════════════════════════════════════════════════
   MAIN HANDLER
═══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Analysis failed. Please try again.', details: msg }, { status: 500 });
  }
}

/* ─── FORMDATA HANDLER — Two-Call Approach ─── */
async function handleFormData(req: NextRequest, apiKey: string, startTime: number) {
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  const contextRaw = formData.get('context') as string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let context: any = {};
  if (contextRaw) { try { context = JSON.parse(contextRaw); } catch { /* ignore */ } }

  if (!files || files.length === 0) {
    console.log('No files — returning demo response');
    return NextResponse.json({ ...DEMO_RESPONSE, metadata: { ...DEMO_RESPONSE.metadata, processing_time_ms: Date.now() - startTime } });
  }

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: `File too large: ${file.name}. Maximum 10MB per file.` }, { status: 400 });
    }
  }

  console.log(`=== ANALYSE: ${files.length} file(s) via FormData ===`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  userContent.push({ type: 'text', text: 'Extract all trades from these files.' });

  /* CALL 1: Extract */
  console.log('Call 1: Extracting trades...');
  const c1Start = Date.now();
  const extractResult = await callClaude(apiKey, EXTRACT_SYSTEM, userContent, 4096, 55000);
  console.log(`Call 1 took ${Date.now() - c1Start}ms`);

  if (!extractResult.ok) {
    return NextResponse.json({ error: 'Trade extraction failed. Please try again.', details: extractResult.error }, { status: 502 });
  }
  const extractParsed = safeParseJSON(extractResult.data);
  if (!extractParsed.ok || !extractParsed.data) {
    return NextResponse.json({ error: 'Could not parse trades from file. Try a different format.' }, { status: 422 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extracted = extractParsed.data as any;
  const trades = extracted.trades || [];
  if (trades.length === 0) {
    return NextResponse.json({ error: 'No trades found in the uploaded file(s).' }, { status: 422 });
  }

  /* CALL 2: Analyse */
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let analysis: any = null;
  if (analyseResult.ok) {
    const ap = safeParseJSON(analyseResult.data);
    if (ap.ok && ap.data) analysis = ap.data;
  }

  const response = {
    success: true, trades,
    analysis: analysis || { session_summary: 'AI analysis unavailable — showing extracted trades.', momentum_indicators: [], vicious_cycle: [], technical_insights: [], trade_analyses: [] },
    metadata: {
      detected_market: extracted.detected_market || 'Unknown', detected_currency: extracted.detected_currency || 'INR',
      detected_broker: extracted.detected_broker || 'Unknown', trade_date: extracted.trade_date || '',
      trade_count: trades.length, net_pnl: Math.round(netPnl * 100) / 100,
      processing_time_ms: Date.now() - startTime,
    },
  };
  console.log(`Total: ${Date.now() - startTime}ms | ${trades.length} trades | Net P&L: ${netPnl}`);
  return NextResponse.json(response);
}

/* ─── JSON HANDLER — Legacy pre-parsed trades ─── */
async function handleJSON(req: NextRequest, apiKey: string, startTime: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ...DEMO_RESPONSE, metadata: { ...DEMO_RESPONSE.metadata, processing_time_ms: Date.now() - startTime } });
  }

  const { trades, kpis, broker, market, trade_date, currency, total_trades_in_file, time_analysis, context } = body;

  if (!trades || !Array.isArray(trades) || trades.length === 0) {
    return NextResponse.json({ ...DEMO_RESPONSE, metadata: { ...DEMO_RESPONSE.metadata, processing_time_ms: Date.now() - startTime } });
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

  const buildFallback = (summary?: string) => ({
    broker: broker || 'Unknown', market: market || 'NSE', trade_date: trade_date || '',
    currency: currency || 'INR', total_trades_in_file: total_trades_in_file || trades.length,
    trades_shown: trades.length, kpis: kpis || {},
    summary: summary || `${trades.length} trades from ${broker || 'Unknown'}. AI analysis unavailable.`,
    momentum: [], vicious_cycle: [], technical_insights: [],
    dqs: null, financial_impact: null, mistake_patterns: [], rules_for_next_session: [],
    trades, time_analysis: time_analysis || {}, _ai_failed: true,
  });

  if (!aiResult.ok) {
    console.warn('AI failed:', aiResult.error);
    if (aiResult.code === 'RATE_LIMIT' || aiResult.error?.includes('usage limits')) {
      return NextResponse.json({ ...buildFallback(), _ai_error: 'AI service temporarily unavailable — usage limit reached.' });
    }
    if (aiResult.code === 'OVERLOADED') {
      return NextResponse.json({ ...buildFallback(), _ai_error: 'AI service is busy. Please try again.' });
    }
    return NextResponse.json({ ...buildFallback(), _ai_error: aiResult.error });
  }

  const aiParsed = safeParseJSON(aiResult.data);
  if (!aiParsed.ok || !aiParsed.data) {
    return NextResponse.json({ ...buildFallback(), _ai_error: 'Failed to parse AI response' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  console.log(`Analysis complete: ${Date.now() - startTime}ms`);
  return NextResponse.json({
    ...buildFallback(analysis.summary),
    momentum: analysis.momentum || [], vicious_cycle: analysis.vicious_cycle || [],
    technical_insights: analysis.technical_insights || [], dqs: analysis.dqs || null,
    financial_impact: analysis.financial_impact || null, mistake_patterns: analysis.mistake_patterns || [],
    rules_for_next_session: analysis.rules_for_next_session || [],
    fi_summary: analysis.fi_summary || null, cross_user_insight: analysis.cross_user_insight || null,
    _ai_failed: false,
  });
}
