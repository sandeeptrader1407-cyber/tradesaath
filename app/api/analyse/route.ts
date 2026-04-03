export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';
import type { ParseResult } from '@/lib/trade-parser';

/* ─── Types ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIResult = { ok: boolean; data?: any; error?: string; code?: string; provider?: string };

/* ─── Helper: call Claude ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(apiKey: string, content: any[], maxTokens: number, timeoutMs = 55000): Promise<AIResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
    const msg = isAbort ? `Claude timed out (${Math.round(timeoutMs/1000)}s)` : (err instanceof Error ? err.message : 'Claude error');
    console.error('Claude error:', msg);
    return { ok: false, error: msg, code: isAbort ? 'TIMEOUT' : 'NETWORK', provider: 'claude' };
  }
}

/* ─── Helper: call Gemini ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(apiKey: string, content: any[], maxTokens: number, timeoutMs = 55000): Promise<AIResult> {
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
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
    const msg = isAbort ? `Gemini timed out (${Math.round(timeoutMs/1000)}s)` : (err instanceof Error ? err.message : 'Gemini error');
    return { ok: false, error: msg, code: isAbort ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK', provider: 'gemini' };
  }
}

/* ─── Get Gemini key ─── */
function getGeminiKey(): string | undefined {
  return process.env.Gemini_API_Key || process.env.GEMINI_API_KEY || process.env.Gemini_Api_Key || process.env.GEMINI_API_key || process.env.gemini_api_key;
}

/* ─── Unified AI caller with time budget ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callAI(content: any[], maxTokens: number, startTime: number): Promise<AIResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = getGeminiKey();

  console.log('AI keys — Claude:', !!anthropicKey, 'Gemini:', !!geminiKey);

  // Vercel Hobby = 90s max. We MUST finish well before 90s so local data can return.
  // Total AI budget = 60s max. This leaves 30s for parsing + response + buffer.
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(60000 - elapsed, 8000); // 60s total budget, min 8s
  // Claude gets 35s max, Gemini gets 20s max — NEVER exceed these
  const claudeTimeout = Math.min(Math.round(remaining * 0.6), 35000);
  const geminiTimeout = Math.min(remaining - claudeTimeout - 2000, 20000);

  console.log(`Time budget: elapsed=${Math.round(elapsed/1000)}s, remaining=${Math.round(remaining/1000)}s, Claude=${Math.round(claudeTimeout/1000)}s, Gemini=${Math.round(geminiTimeout/1000)}s`);

  if (anthropicKey && geminiKey) {
    const result = await callClaude(anthropicKey, content, maxTokens, claudeTimeout);
    if (result.ok) return result;
    console.warn('Claude failed, trying Gemini:', result.error);
    // Check if we still have time for Gemini (hard stop at 65s from request start)
    const now = Date.now() - startTime;
    if (now > 65000) {
      console.warn('No time left for Gemini fallback, skipping');
      return result;
    }
    const actualGeminiTimeout = Math.min(geminiTimeout, 70000 - now);
    if (actualGeminiTimeout < 5000) {
      console.warn('Gemini budget too small, skipping');
      return result;
    }
    const gemResult = await callGemini(geminiKey, content, maxTokens, actualGeminiTimeout);
    if (gemResult.ok) return gemResult;
    return { ...result, error: `Claude: ${result.error} | Gemini: ${gemResult.error}` };
  }
  if (anthropicKey) return callClaude(anthropicKey, content, maxTokens, Math.min(remaining - 2000, 35000));
  if (geminiKey) return callGemini(geminiKey, content, maxTokens, Math.min(remaining - 2000, 20000));
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
   Accepts JSON body with pre-parsed trade data from /api/parse.
   Only does AI psychology analysis — no file parsing.
═══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const requestStartTime = Date.now();

    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasGeminiKey = !!getGeminiKey();
    if (!hasAnthropicKey && !hasGeminiKey) {
      return NextResponse.json({ error: 'No AI API key configured.' }, { status: 500 });
    }

    // Accept JSON body with pre-parsed data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body. Send parsed trade data.' }, { status: 400 });
    }

    const { trades, kpis, broker, market, trade_date, currency, total_trades_in_file, time_analysis, context } = body;

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: 'No trades provided.' }, { status: 400 });
    }

    let contextStr = '';
    if (context && typeof context === 'object') {
      contextStr = Object.entries(context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
    }

    console.log('=== ANALYSE: AI psychology only (no file) ===');
    console.log(`Trades: ${trades.length}, Broker: ${broker}`);

    // Build a ParseResult-like object for the prompt builder
    const parsed: ParseResult = {
      success: true,
      trades,
      kpis: kpis || { net_pnl: 0, total_trades: trades.length, wins: 0, losses: 0, win_rate: 0, profit_factor: 0, gross_profit: 0, gross_loss: 0, avg_win: 0, avg_loss: 0, best_trade_pnl: 0, worst_trade_pnl: 0 },
      broker: broker || 'Unknown',
      market: market || 'NSE',
      trade_date: trade_date || '',
      currency: currency || 'INR',
      total_trades_in_file: total_trades_in_file || trades.length,
      time_analysis: time_analysis || { avg_time_gap_minutes: 0, min_time_gap_minutes: 0, max_time_gap_minutes: 0, trading_duration_minutes: 0 },
    };

    // Helper to build the "parsed data only" response (fallback if AI fails)
    const buildLocalResponse = (summary?: string) => ({
      broker: parsed.broker,
      market: parsed.market,
      trade_date: parsed.trade_date,
      currency: parsed.currency,
      total_trades_in_file: parsed.total_trades_in_file,
      trades_shown: parsed.trades.length,
      kpis: parsed.kpis,
      summary: summary || `${parsed.trades.length} trades from ${parsed.broker}. AI analysis unavailable — showing parsed data only.`,
      momentum: [],
      vicious_cycle: [],
      technical_insights: [],
      dqs: null,
      financial_impact: null,
      mistake_patterns: [],
      rules_for_next_session: [],
      trades: parsed.trades,
      time_analysis: parsed.time_analysis,
      _truncated: false,
      _parsed_locally: true,
      _ai_failed: true,
    });

    try {
      const prompt = buildPsychologyPrompt(parsed, contextStr);
      const aiContent = [{ type: 'text', text: prompt }];

      const aiResult = await callAI(aiContent, 8000, requestStartTime);

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
            _parsed_locally: true,
            _ai_failed: false,
          });
        }
      }
      console.warn('AI psychology failed:', aiResult.error);
      return NextResponse.json({ ...buildLocalResponse(), _ai_error: aiResult.error });
    } catch (aiErr) {
      console.error('AI psychology crashed:', aiErr instanceof Error ? aiErr.message : aiErr);
      return NextResponse.json(buildLocalResponse());
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    console.error('Analysis error:', msg);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
