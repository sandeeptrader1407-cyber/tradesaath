export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';
import { parseTradeFile, ParseResult } from '@/lib/trade-parser';

/* ─── Types ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIResult = { ok: boolean; data?: any; error?: string; code?: string; provider?: string };

/* ─── Helper: call Claude ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(apiKey: string, content: any[], maxTokens: number): Promise<AIResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 80000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }]
      })
    });
    clearTimeout(timeout);

    if (response.status === 529) return { ok: false, error: 'Claude busy (529)', code: 'OVERLOADED', provider: 'claude' };
    if (response.status === 429) return { ok: false, error: 'Claude rate limit (429)', code: 'RATE_LIMIT', provider: 'claude' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try { data = await response.json(); } catch { return { ok: false, error: `Claude HTTP ${response.status}`, code: 'PARSE', provider: 'claude' }; }

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${response.status}`;
      console.error('Claude API error:', JSON.stringify(data.error || data));
      return { ok: false, error: `Claude: ${errMsg}`, code: data.error?.type || `HTTP_${response.status}`, provider: 'claude' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
    return { ok: true, data: text, provider: 'claude' };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
    const msg = isAbort ? 'Claude timed out (80s)' : (err instanceof Error ? err.message : 'Claude error');
    console.error('Claude error:', msg);
    return { ok: false, error: msg, code: isAbort ? 'TIMEOUT' : 'NETWORK', provider: 'claude' };
  }
}

/* ─── Helper: call Gemini ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(apiKey: string, content: any[], maxTokens: number): Promise<AIResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  for (const item of content) {
    if (item.type === 'text') parts.push({ text: item.text });
    else if (item.type === 'document' && item.source) parts.push({ inlineData: { mimeType: item.source.media_type, data: item.source.data } });
    else if (item.type === 'image' && item.source) parts.push({ inlineData: { mimeType: item.source.media_type, data: item.source.data } });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 80000);
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 } })
    });
    clearTimeout(timeout);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    if (data.error) return { ok: false, error: `Gemini: ${data.error.message}`, code: 'GEMINI_ERROR', provider: 'gemini' };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return { ok: false, error: 'Gemini empty response', code: 'EMPTY', provider: 'gemini' };
    return { ok: true, data: text, provider: 'gemini' };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
    const msg = isAbort ? 'Gemini timed out (80s)' : (err instanceof Error ? err.message : 'Gemini error');
    return { ok: false, error: msg, code: isAbort ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK', provider: 'gemini' };
  }
}

/* ─── Get Gemini key ─── */
function getGeminiKey(): string | undefined {
  return process.env.Gemini_API_Key || process.env.GEMINI_API_KEY || process.env.Gemini_Api_Key || process.env.GEMINI_API_key || process.env.gemini_api_key;
}

/* ─── Unified AI caller ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callAI(content: any[], maxTokens: number): Promise<AIResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = getGeminiKey();

  console.log('AI keys — Claude:', !!anthropicKey, 'Gemini:', !!geminiKey);

  if (anthropicKey && geminiKey) {
    const result = await callClaude(anthropicKey, content, maxTokens);
    if (result.ok) return result;
    console.warn('Claude failed, trying Gemini:', result.error);
    const gemResult = await callGemini(geminiKey, content, maxTokens);
    if (gemResult.ok) return gemResult;
    return { ...result, error: `Claude: ${result.error} | Gemini: ${gemResult.error}` };
  }
  if (anthropicKey) return callClaude(anthropicKey, content, maxTokens);
  if (geminiKey) return callGemini(geminiKey, content, maxTokens);
  return { ok: false, error: 'No AI API key configured', code: 'NO_KEY' };
}

/* ─── JSON parser with recovery ─── */
function safeParseJSON(raw: string): { ok: boolean; data?: Record<string, unknown>; truncated?: boolean } {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return { ok: true, data: JSON.parse(cleaned) }; } catch { /* fall through */ }

  // Truncation recovery
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

/* ─── Build psychology-only AI prompt (NO file attachment — fast!) ─── */
function buildPsychologyPrompt(parsed: ParseResult, contextStr: string): string {
  const tradesJson = JSON.stringify(parsed.trades);
  return `You are TradeSaath, a personal trading mentor who watched the trader's screen all day.

TRADE DATA (already extracted and calculated):
Broker: ${parsed.broker} | Market: ${parsed.market} | Date: ${parsed.trade_date} | Currency: ${parsed.currency}
${contextStr ? `User context: ${contextStr}` : ''}

KPIs: Net P&L ${parsed.kpis.net_pnl}, ${parsed.kpis.total_trades} trades, ${parsed.kpis.wins} wins, ${parsed.kpis.losses} losses, Win rate ${parsed.kpis.win_rate}%, Profit Factor ${parsed.kpis.profit_factor}
Gross Profit: ${parsed.kpis.gross_profit}, Gross Loss: ${parsed.kpis.gross_loss}, Avg Win: ${parsed.kpis.avg_win}, Avg Loss: ${parsed.kpis.avg_loss}
Best Trade: ${parsed.kpis.best_trade_pnl}, Worst Trade: ${parsed.kpis.worst_trade_pnl}
Time: Avg gap ${parsed.time_analysis.avg_time_gap_minutes}m, Duration ${parsed.time_analysis.trading_duration_minutes}m

Trades (sorted by time):
${tradesJson}

TONE — Write like a mentor who watched their screen all day:
- Use "you" and "your" — speak directly to the trader
- Reference actual trade times, prices, symbols from the data above
- Say WHAT emotion, WHEN, and WHAT it cost in rupees
- Be empathetic but honest. Tell the STORY of the trading day.

VICIOUS CYCLE DETECTION:
- After 2+ wins → overconfidence? After a loss → revenge within 5 min?
- After 2+ losses → panic exits, averaging, decision fatigue?
- Trades after 2 PM with prior losses = highest revenge risk

Return ONLY valid JSON, no backticks:
{
  "summary": "2-3 paragraph narrative of the trading day",
  "momentum": [
    {"name": "Rule Following", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific"},
    {"name": "Staying Calm", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific"},
    {"name": "Entry Timing", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific"},
    {"name": "Exit Discipline", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific"}
  ],
  "vicious_cycle": [
    {"stage": "Disciplined Win", "count": N, "icon": "check", "desc": "text"},
    {"stage": "FOMO Re-entry", "count": N, "icon": "zap", "desc": "text"},
    {"stage": "Against Trend", "count": N, "icon": "arrow", "desc": "text"},
    {"stage": "Hope & Hold", "count": N, "icon": "pray", "desc": "text"},
    {"stage": "Averaging Down", "count": N, "icon": "down", "desc": "text"},
    {"stage": "Panic Exit", "count": N, "icon": "wind", "desc": "text"},
    {"stage": "Revenge Trade", "count": N, "icon": "sword", "desc": "text"},
    {"stage": "Decision Fatigue", "count": N, "icon": "dizzy", "desc": "text"}
  ],
  "technical_insights": [
    {"name": "Trend Alignment", "score": 0-100, "color": "green/red/gold", "desc": "text"},
    {"name": "Entry Structure", "score": 0-100, "color": "green/red/gold", "desc": "text"},
    {"name": "Exit Quality", "score": 0-100, "color": "green/red/gold", "desc": "text"},
    {"name": "Entry Timing", "score": 0-100, "color": "green/red/gold", "desc": "text"}
  ],
  "dqs": {
    "score": 0-100,
    "factors": [
      {"name": "Entry Timing", "score": 0-100, "color": "green/blue/gold/red"},
      {"name": "Risk Management", "score": 0-100, "color": "green/blue/gold/red"},
      {"name": "Position Sizing", "score": 0-100, "color": "green/blue/gold/red"},
      {"name": "Emotional Control", "score": 0-100, "color": "green/blue/gold/red"},
      {"name": "Exit Discipline", "score": 0-100, "color": "green/blue/gold/red"}
    ]
  },
  "financial_impact": {
    "total_lost_to_mistakes": N,
    "potential_pnl_without_mistakes": N,
    "message": "One sentence about disciplined trading"
  },
  "mistake_patterns": [{"name": "pattern", "icon": "emoji", "count": N, "cost": N, "frequency": "X of Y"}],
  "rules_for_next_session": ["rule 1", "rule 2", "rule 3"],
  "trade_tags": {${parsed.trades.map((t, i) => `"${i}": "win/fomo/revenge/averaging/panic/against_trend/hope_hold/decision_fatigue"`).slice(0, 3).join(', ')}},
  "first_trade_detail": {
    "time_gap_from_last": "first trade",
    "quick_summary": "2-3 sentences about this trade",
    "vicious_cycle_stage": "Which stage and why",
    "entry_exit_efficiency": {"entry_score": 0-100, "exit_score": 0-100, "risk_reward": "1.5x", "optimal_rr": "optimal"},
    "entry_timing": {"description": "entry at specific time", "risk_level": "High/Medium/Low"},
    "in_trade_behavior": {"discipline": "DISCIPLINED/IMPULSIVE/PANIC", "description": "what happened", "during_trade": "patience/premature/etc"},
    "what_you_did_vs_should_have": {"what_you_did": "2-3 sentences", "what_to_do_instead": "2-3 sentences", "key_lesson": "one sentence"},
    "last_5_trades_context": "Opening mindset for trade #1",
    "psychology_coaching": "3-4 sentences mentor advice",
    "technical_analysis": "3-4 sentences with price levels",
    "counterfactual": "What-if scenario"
  }
}

IMPORTANT: Return ALL fields. The first_trade_detail is shown for free and must be impressive.`;
}

/* ═══════════════════════════════════════════════════
   MAIN HANDLER
═══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const context = formData.get('context') as string || '{}';

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasGeminiKey = !!getGeminiKey();
    if (!hasAnthropicKey && !hasGeminiKey) {
      return NextResponse.json({ error: 'No AI API key configured.' }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    let ctx: Record<string, string> = {};
    try { ctx = JSON.parse(context); } catch { /* ignore */ }
    const contextStr = Object.entries(ctx).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');

    const name = file.name.toLowerCase();

    console.log('=== STEP 1: Local parsing (no AI) ===');
    console.log('File:', file.name, 'Size:', bytes.byteLength);

    /* ═══════════════════════════════════════════
       STEP 1: Try LOCAL PARSING (fast, no AI)
    ═══════════════════════════════════════════ */
    let parsed: ParseResult | null = null;
    try {
      parsed = await parseTradeFile(buffer, file.name);
      console.log(`Local parser: success=${parsed.success}, trades=${parsed.trades.length}, broker=${parsed.broker}`);
      if (parsed.error) console.log(`Local parser note: ${parsed.error}`);
    } catch (parseErr) {
      console.error('Local parser crashed:', parseErr instanceof Error ? parseErr.stack : parseErr);
      // Don't give up — set parsed to a failure result so we still try AI
      parsed = null;
    }

    /* ═══════════════════════════════════════════
       STEP 2A: If local parsing worked → AI for psychology ONLY (fast! no file attachment)
    ═══════════════════════════════════════════ */
    if (parsed?.success && parsed.trades.length > 0) {
      console.log('=== STEP 2A: AI psychology analysis (text only, no file) ===');

      // Helper to build the "parsed data only" response (used as fallback)
      const buildLocalResponse = (summary?: string) => ({
        broker: parsed!.broker,
        market: parsed!.market,
        trade_date: parsed!.trade_date,
        currency: parsed!.currency,
        total_trades_in_file: parsed!.total_trades_in_file,
        trades_shown: parsed!.trades.length,
        kpis: parsed!.kpis,
        summary: summary || `${parsed!.trades.length} trades extracted from ${parsed!.broker}. Net P&L: ${parsed!.kpis.net_pnl} ${parsed!.currency}. Win rate: ${parsed!.kpis.win_rate}% (${parsed!.kpis.wins}W/${parsed!.kpis.losses}L). Profit factor: ${parsed!.kpis.profit_factor}. Best: ${parsed!.kpis.best_trade_pnl}, Worst: ${parsed!.kpis.worst_trade_pnl}.`,
        momentum: [],
        vicious_cycle: [],
        technical_insights: [],
        dqs: null,
        financial_impact: null,
        mistake_patterns: [],
        rules_for_next_session: [],
        trades: parsed!.trades,
        time_analysis: parsed!.time_analysis,
        _truncated: false,
        _parsed_locally: true,
      });

      try {
        const prompt = buildPsychologyPrompt(parsed, contextStr);
        const aiContent = [{ type: 'text', text: prompt }];

        const aiResult = await callAI(aiContent, 8000);

        if (aiResult.ok) {
          const aiParsed = safeParseJSON(aiResult.data);
          if (aiParsed.ok && aiParsed.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const analysis = aiParsed.data as any;

            // Update trade tags from AI
            if (analysis.trade_tags) {
              for (const [idx, tag] of Object.entries(analysis.trade_tags)) {
                const i = parseInt(idx);
                if (parsed.trades[i]) {
                  parsed.trades[i].tag = tag as string;
                  parsed.trades[i].label = (tag as string).replace(/_/g, ' ');
                }
              }
            }

            // Merge first trade detail
            if (analysis.first_trade_detail && parsed.trades.length > 0) {
              parsed.trades[0] = { ...parsed.trades[0], ...analysis.first_trade_detail };
            }

            console.log(`Analysis complete via ${aiResult.provider} (text-only mode)`);

            return NextResponse.json({
              ...buildLocalResponse(analysis.summary),
              momentum: analysis.momentum || [],
              vicious_cycle: analysis.vicious_cycle || [],
              technical_insights: analysis.technical_insights || [],
              dqs: analysis.dqs || null,
              financial_impact: analysis.financial_impact || null,
              mistake_patterns: analysis.mistake_patterns || [],
              rules_for_next_session: analysis.rules_for_next_session || [],
            });
          }
        }
        console.warn('AI psychology failed:', aiResult.error);
      } catch (aiErr) {
        console.error('AI psychology crashed:', aiErr instanceof Error ? aiErr.message : aiErr);
      }

      // AI failed but local parsing worked → ALWAYS return parsed data
      console.log('Returning locally parsed data without AI psychology');
      return NextResponse.json(buildLocalResponse());
    }

    /* ═══════════════════════════════════════════
       STEP 2B: Local parsing FAILED → AI does EVERYTHING (send file)
       This is the fallback — single combined call
    ═══════════════════════════════════════════ */
    console.log('=== STEP 2B: Full AI analysis (file attached — fallback) ===');

    let mediaType = 'application/pdf';
    if (name.endsWith('.csv') || name.endsWith('.tsv')) mediaType = 'text/csv';
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) mediaType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (name.endsWith('.png')) mediaType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mediaType = 'image/jpeg';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fileContent: any[];
    if (mediaType === 'text/csv') {
      const text = buffer.toString('utf-8');
      fileContent = [{ type: 'text', text: 'Trade file (CSV):\n\n' + text }];
    } else if (mediaType.startsWith('image/')) {
      fileContent = [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }];
    } else if (mediaType.includes('spreadsheet')) {
      // Convert Excel to CSV for AI
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const csvText = wb.SheetNames.map((s: string) => XLSX.utils.sheet_to_csv(wb.Sheets[s])).join('\n\n');
        fileContent = [{ type: 'text', text: 'Trade file (Excel→CSV):\n\n' + csvText }];
      } catch {
        fileContent = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }];
      }
    } else {
      fileContent = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }];
    }

    const combinedContent = [
      ...fileContent,
      {
        type: 'text',
        text: `You are TradeSaath, a personal trading mentor. Extract ALL trades and provide deep analysis.
${contextStr ? `User context: ${contextStr}` : ''}

STEP 1 — EXTRACT ALL TRADES:
- Pair BUY+SELL for same instrument. P&L = (Sell-Buy)*Qty. cum_pnl = running total.
- Tag: "win","fomo","revenge","averaging","panic","against_trend","hope_hold","decision_fatigue"
- Session: "morning" (<11AM), "midday" (11-1:30PM), "afternoon" (>1:30PM)

STEP 2 — PSYCHOLOGY ANALYSIS using trades you extracted.

Return ONLY valid JSON:
{
  "broker":"name","market":"NSE/NYSE","trade_date":"YYYY-MM-DD","currency":"INR","total_trades_in_file":N,
  "kpis":{"net_pnl":N,"total_trades":N,"wins":N,"losses":N,"win_rate":N,"profit_factor":N,"best_trade_pnl":N,"worst_trade_pnl":N},
  "trades":[{"index":0,"time":"HH:MM","symbol":"name","side":"BUY/SELL","qty":N,"entry":N,"exit":N,"pnl":N,"cum_pnl":N,"tag":"tag","label":"label","session":"session"}],
  "summary":"2-3 paragraph narrative","momentum":[{"name":"Rule Following","score":0-100,"color":"green/red/gold/accent","desc":"text"},{"name":"Staying Calm","score":0-100,"color":"green/red/gold/accent","desc":"text"},{"name":"Entry Timing","score":0-100,"color":"green/red/gold/accent","desc":"text"},{"name":"Exit Discipline","score":0-100,"color":"green/red/gold/accent","desc":"text"}],
  "vicious_cycle":[{"stage":"Disciplined Win","count":N,"icon":"check","desc":"text"},{"stage":"FOMO Re-entry","count":N,"icon":"zap","desc":"text"},{"stage":"Against Trend","count":N,"icon":"arrow","desc":"text"},{"stage":"Hope & Hold","count":N,"icon":"pray","desc":"text"},{"stage":"Averaging Down","count":N,"icon":"down","desc":"text"},{"stage":"Panic Exit","count":N,"icon":"wind","desc":"text"},{"stage":"Revenge Trade","count":N,"icon":"sword","desc":"text"},{"stage":"Decision Fatigue","count":N,"icon":"dizzy","desc":"text"}],
  "technical_insights":[{"name":"Trend Alignment","score":0-100,"color":"green/red/gold","desc":"text"},{"name":"Entry Structure","score":0-100,"color":"green/red/gold","desc":"text"},{"name":"Exit Quality","score":0-100,"color":"green/red/gold","desc":"text"},{"name":"Entry Timing","score":0-100,"color":"green/red/gold","desc":"text"}],
  "dqs":{"score":0-100,"factors":[{"name":"Entry Timing","score":0-100,"color":"green/blue/gold/red"},{"name":"Risk Management","score":0-100,"color":"green/blue/gold/red"},{"name":"Position Sizing","score":0-100,"color":"green/blue/gold/red"},{"name":"Emotional Control","score":0-100,"color":"green/blue/gold/red"},{"name":"Exit Discipline","score":0-100,"color":"green/blue/gold/red"}]},
  "financial_impact":{"total_lost_to_mistakes":N,"potential_pnl_without_mistakes":N,"message":"text"},
  "mistake_patterns":[{"name":"name","icon":"emoji","count":N,"cost":N,"frequency":"X of Y"}],
  "rules_for_next_session":["rule1","rule2","rule3"],
  "first_trade_detail":{"time_gap_from_last":"first trade","quick_summary":"text","vicious_cycle_stage":"text","entry_exit_efficiency":{"entry_score":0-100,"exit_score":0-100,"risk_reward":"1.5x","optimal_rr":"text"},"entry_timing":{"description":"text","risk_level":"High/Medium/Low"},"in_trade_behavior":{"discipline":"DISCIPLINED/IMPULSIVE/PANIC","description":"text","during_trade":"text"},"what_you_did_vs_should_have":{"what_you_did":"text","what_to_do_instead":"text","key_lesson":"text"},"last_5_trades_context":"text","psychology_coaching":"text","technical_analysis":"text","counterfactual":"text"}
}`
      }
    ];

    const result = await callAI(combinedContent, 16000);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'OVERLOADED' ? 529 : 500 });
    }

    const aiParsed = safeParseJSON(result.data);
    if (!aiParsed.ok || !aiParsed.data) {
      return NextResponse.json({ error: 'Could not parse analysis. Try a smaller file.', code: 'TRUNCATED' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = aiParsed.data as any;

    // Sort and fix trades
    if (data.trades?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.trades.sort((a: any, b: any) => parseInt((a.time || '0000').replace(/:/g, '')) - parseInt((b.time || '0000').replace(/:/g, '')));
      let cumPnl = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.trades.forEach((t: any, i: number) => { t.index = i; cumPnl += t.pnl || 0; t.cum_pnl = cumPnl; });
    }

    if (data.first_trade_detail && data.trades?.length > 0) {
      data.trades[0] = { ...data.trades[0], ...data.first_trade_detail };
    }

    return NextResponse.json({
      broker: data.broker, market: data.market, trade_date: data.trade_date, currency: data.currency,
      total_trades_in_file: data.total_trades_in_file || data.trades?.length || 0,
      trades_shown: data.trades?.length || 0, kpis: data.kpis,
      summary: data.summary || '', momentum: data.momentum || [],
      vicious_cycle: data.vicious_cycle || [], technical_insights: data.technical_insights || [],
      dqs: data.dqs || null, financial_impact: data.financial_impact || null,
      mistake_patterns: data.mistake_patterns || [], rules_for_next_session: data.rules_for_next_session || [],
      trades: data.trades || [], _truncated: aiParsed.truncated || false, _parsed_locally: false,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    console.error('Analysis error:', msg);
    let userMsg = 'Analysis failed. Please try again.';
    if (msg.includes('JSON')) userMsg = 'Response was cut off. Try a smaller file.';
    else if (msg.includes('timeout') || msg.includes('TIMEOUT')) userMsg = 'Analysis took too long. Try again.';
    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
