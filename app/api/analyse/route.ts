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

/* ─── Unified AI caller — Claude only ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callAI(content: any[], maxTokens: number, startTime: number): Promise<AIResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return { ok: false, error: 'No AI API key configured', code: 'NO_KEY' };
  }

  // Vercel Hobby = 90s max. Total AI budget = 60s max.
  // Claude gets the FULL budget now (no Gemini fallback)
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(60000 - elapsed, 8000);
  const claudeTimeout = Math.min(remaining - 2000, 55000); // Full budget, up to 55s

  console.log(`Time budget: elapsed=${Math.round(elapsed/1000)}s, remaining=${Math.round(remaining/1000)}s, Claude=${Math.round(claudeTimeout/1000)}s`);

  const result = await callClaude(anthropicKey, content, maxTokens, claudeTimeout);

  // Provide user-friendly error messages for billing/limit errors
  if (!result.ok && result.error) {
    if (result.error.includes('usage limits') || result.error.includes('spending') || result.code === 'RATE_LIMIT') {
      return {
        ...result,
        error: 'AI service temporarily unavailable — usage limit reached. Please try again later or contact support.',
        code: 'BILLING_LIMIT',
      };
    }
    if (result.code === 'OVERLOADED') {
      return {
        ...result,
        error: 'AI service is busy right now. Please wait a moment and try again.',
      };
    }
  }

  return result;
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

/* ─── Build psychology AI prompt — V12 spec compliant ─── */
function buildPsychologyPrompt(parsed: ParseResult, contextStr: string): string {
  const tradesJson = JSON.stringify(parsed.trades);
  const isOptions = /NIFTY|BANKNIFTY|CE|PE|FINNIFTY/i.test(JSON.stringify(parsed.trades).slice(0, 2000));
  return `You are TradeSaath, a personal trading mentor who watched the trader's screen all day. You are empathetic but direct. You never give generic advice.

TRADE DATA (already extracted and calculated):
Broker: ${parsed.broker} | Market: ${parsed.market} | Date: ${parsed.trade_date} | Currency: ${parsed.currency}
${contextStr ? `User context: ${contextStr}` : ''}

KPIs: Net P&L ${parsed.kpis.net_pnl}, ${parsed.kpis.total_trades} trades, ${parsed.kpis.wins} wins, ${parsed.kpis.losses} losses, Win rate ${parsed.kpis.win_rate}%, Profit Factor ${parsed.kpis.profit_factor}
Gross Profit: ${parsed.kpis.gross_profit}, Gross Loss: ${parsed.kpis.gross_loss}, Avg Win: ${parsed.kpis.avg_win}, Avg Loss: ${parsed.kpis.avg_loss}
Best Trade: ${parsed.kpis.best_trade_pnl}, Worst Trade: ${parsed.kpis.worst_trade_pnl}
Time: Avg gap ${parsed.time_analysis.avg_time_gap_minutes}m, Duration ${parsed.time_analysis.trading_duration_minutes}m
${isOptions ? 'This is an OPTIONS session — include options-specific analysis (CE/PE, moneyness, theta risk, VIX).' : ''}

Trades (sorted by time):
${tradesJson}

TONE — Write like a mentor who watched their screen all day:
- Use "you" and "your" — speak directly to the trader
- Reference actual trade times, prices, symbols from the data above
- Say WHAT emotion, WHEN, and WHAT it cost in rupees
- Be empathetic but honest. Tell the STORY of the trading day.
- Every insight must include a specific ₹ amount or trade index from the data.

════════════════════════════════════════════════════════
THE 10-STAGE VICIOUS CYCLE (canonical — use these EXACT names and order):
 1. Disciplined Win        — clean execution, rules followed
 2. Overconfidence         — win streak creating false confidence
 3. Larger Position        — size/lots increased on next entry
 4. Market Goes Against    — position underwater, mental stop breached
 5. Hope & Hold            — "it will come back" thinking, no exit
 6. Averaging Down         — adding to loser, deepening the trap
 7. Panic Exit             — capitulation at worst price
 8. Revenge Trade          — immediate re-entry to recover losses (within 5 min)
 9. Decision Fatigue       — too many trades, random entries after 2 PM
10. FOMO Re-entry          — chasing a move already in progress

DETECTION RULES:
- After 2+ wins → Stages 2-3 risk (Overconfidence, Larger Position)
- Loss followed by re-entry < 5 min → Stage 8 (Revenge Trade)
- 2+ losses in a row → Stages 5-7 (Hope, Averaging, Panic)
- Trades after 2 PM with prior losses = highest revenge risk
- >15 trades in one session → Stage 9 (Decision Fatigue)
- Entry near intraday high after a rally → Stage 10 (FOMO)

Every trade must be assigned to exactly ONE of these 10 stages (cycle_position_index 0-9).
════════════════════════════════════════════════════════

Return ONLY valid JSON (no backticks, no markdown):
{
  "summary": "2-3 paragraph narrative of the trading day — morning vs afternoon, emotional pattern, one key recommendation",
  "fi_summary": "One sentence summarising free technical insights",

  "momentum": [
    {"name": "Win Rate",        "score": 0-100, "color": "green|red|gold|accent", "desc": "specific one-liner"},
    {"name": "Profit Factor",   "score": 0-100, "color": "green|red|gold|accent", "desc": "specific one-liner"},
    {"name": "Discipline Score","score": 0-100, "color": "green|red|gold|accent", "desc": "specific one-liner"},
    {"name": "Risk:Reward",     "score": 0-100, "color": "green|red|gold|accent", "desc": "specific one-liner"}
  ],

  "vicious_cycle": [
    {"stage": "Disciplined Win",     "count": N, "icon": "check",   "desc": "text", "index": 0},
    {"stage": "Overconfidence",      "count": N, "icon": "flame",   "desc": "text", "index": 1},
    {"stage": "Larger Position",     "count": N, "icon": "expand",  "desc": "text", "index": 2},
    {"stage": "Market Goes Against", "count": N, "icon": "arrow",   "desc": "text", "index": 3},
    {"stage": "Hope & Hold",         "count": N, "icon": "pray",    "desc": "text", "index": 4},
    {"stage": "Averaging Down",      "count": N, "icon": "down",    "desc": "text", "index": 5},
    {"stage": "Panic Exit",          "count": N, "icon": "wind",    "desc": "text", "index": 6},
    {"stage": "Revenge Trade",       "count": N, "icon": "sword",   "desc": "text", "index": 7},
    {"stage": "Decision Fatigue",    "count": N, "icon": "dizzy",   "desc": "text", "index": 8},
    {"stage": "FOMO Re-entry",       "count": N, "icon": "zap",     "desc": "text", "index": 9}
  ],

  "technical_insights": [
    {"name": "Entry Quality",    "score": 0-100, "color": "green|red|gold", "desc": "specific one-liner"},
    {"name": "Trend Alignment",  "score": 0-100, "color": "green|red|gold", "desc": "specific one-liner"},
    {"name": "Volume Analysis",  "score": 0-100, "color": "green|red|gold", "desc": "specific one-liner"},
    {"name": "Setup Quality",    "score": 0-100, "color": "green|red|gold", "desc": "specific one-liner"}
  ],

  "dqs": {
    "score": 0-100,
    "factors": [
      {"name": "Entry Timing",      "score": 0-100, "color": "green|blue|gold|red"},
      {"name": "Risk Management",   "score": 0-100, "color": "green|blue|gold|red"},
      {"name": "Position Sizing",   "score": 0-100, "color": "green|blue|gold|red"},
      {"name": "Emotional Control", "score": 0-100, "color": "green|blue|gold|red"},
      {"name": "Exit Discipline",   "score": 0-100, "color": "green|blue|gold|red"}
    ]
  },

  "financial_impact": {
    "total_lost_to_mistakes": N,
    "potential_pnl_without_mistakes": N,
    "message": "One sentence about disciplined trading"
  },

  "mistake_patterns": [
    {"name": "pattern", "icon": "emoji", "count": N, "cost": N, "frequency": "X of Y"}
  ],

  "rules_for_next_session": ["rule 1 referencing real data", "rule 2", "rule 3"],

  "trade_tags": {${parsed.trades.map((_t, i) => `"${i}": "win|fomo|revenge|averaging|panic|against_trend|hope_hold|decision_fatigue|overconfidence|larger_position"`).slice(0, 3).join(', ')}},

  "cross_user_insight": "From 847 traders: one anonymised insight referencing this trader's biggest pattern (e.g. FOMO, revenge) and a concrete improvement stat",

  "trades_deep": [
    // One entry per trade — ALL trades. The UI will gate behind paywall but needs data for all of them.
    {
      "index": 0,
      "market_context": {
        "nifty": "e.g. 22,850 ▲",
        "vix": "e.g. 14.2",
        "news": "optional headline or session mood",
        "session_label": "Morning|Midday|Afternoon"
      },
      "previous_trades": [
        {"pnl": N, "result": "win|loss", "symbol": "..."},
        {"pnl": N, "result": "win|loss", "symbol": "..."},
        {"pnl": N, "result": "win|loss", "symbol": "..."}
      ],
      "fills_note": "If the trade had multiple fills, note the weighted average and any slippage",
      "quick_summary": "2-3 sentences tying this trade to the cycle stage",
      "vicious_cycle_stage": "Exact stage name from the 10",
      "cycle_position_index": 0,
      "psychology_coaching": "3-4 sentences mentor advice — reference the exact emotion and timestamp",
      "counterfactual": "What-if: if you had followed your rule, you would have saved ₹X / captured ₹Y more",
      "technical_analysis": "3-4 sentences with price levels and structure call",
      "setup_grade": "A|B|C|D|F",
      "options_specific": ${isOptions ? `{
        "type": "CE|PE",
        "moneyness": "ITM|ATM|OTM",
        "theta_risk": "MODERATE|HIGH|EXTREME",
        "vix_env": "low|normal|high",
        "time_to_expiry": "e.g. 2h 15m",
        "avg_fill": "weighted avg fill price"
      }` : 'null'},
      "entry_exit_efficiency": {
        "entry_score": 0-100,
        "exit_score": 0-100,
        "risk_reward": "e.g. 1.5x",
        "optimal_rr": "e.g. 2x"
      },
      "entry_timing_candle_position": "first-minute high vol|middle stabilization|last-minute breakout|mid-candle drift",
      "entry_timing": {"description": "entry at HH:MM — what was happening", "risk_level": "High|Medium|Low"},
      "in_trade_behavior": {
        "discipline": "DISCIPLINED|IMPULSIVE|PANIC",
        "description": "what happened after entry",
        "during_trade": "patience|premature exit|held too long|added to loser",
        "flags": ["REVENGE", "AVERAGING", "PANIC", "FOMO", "AGAINST_TREND", "DISCIPLINED", "OVERSIZED"]
      },
      "what_you_did_vs_should_have": {
        "what_you_did": "2-3 sentences — the actual action",
        "what_to_do_instead": "2-3 sentences — the rule-based alternative",
        "key_lesson": "one sentence takeaway"
      }
    }
    // ... repeat for every trade index. Keep each trade concise but complete.
  ],

  "first_trade_detail": {
    // Legacy field — mirror the first entry of trades_deep for backwards compatibility
    "time_gap_from_last": "first trade",
    "quick_summary": "copy of trades_deep[0].quick_summary",
    "vicious_cycle_stage": "copy of trades_deep[0].vicious_cycle_stage",
    "entry_exit_efficiency": {"entry_score": 0-100, "exit_score": 0-100, "risk_reward": "1.5x", "optimal_rr": "optimal"},
    "entry_timing": {"description": "entry at specific time", "risk_level": "High|Medium|Low"},
    "in_trade_behavior": {"discipline": "DISCIPLINED|IMPULSIVE|PANIC", "description": "what happened", "during_trade": "patience|premature|etc"},
    "what_you_did_vs_should_have": {"what_you_did": "2-3 sentences", "what_to_do_instead": "2-3 sentences", "key_lesson": "one sentence"},
    "last_5_trades_context": "Opening mindset for trade #1",
    "psychology_coaching": "3-4 sentences mentor advice",
    "technical_analysis": "3-4 sentences with price levels",
    "counterfactual": "What-if scenario"
  }
}

CRITICAL: Return ALL fields. trades_deep must contain one entry per trade. The first trade's detail is shown for free and must be impressive. Use ONLY the 10 cycle stages listed above.`;
}

/* ═══════════════════════════════════════════════════
   MAIN HANDLER
   Accepts JSON body with pre-parsed trade data from /api/parse.
   Only does AI psychology analysis — no file parsing.
═══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const requestStartTime = Date.now();

    if (!process.env.ANTHROPIC_API_KEY) {
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
      kpis: kpis || { net_pnl: 0, total_trades: trades.length, wins: 0, losses: 0, win_rate: 0, profit_factor: 0, gross_profit: 0, gross_loss: 0, avg_win: 0, avg_loss: 0, best_trade_pnl: 0, worst_trade_pnl: 0, gross_buy_value: 0, gross_sell_value: 0 },
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

          // Merge first trade detail (legacy)
          if (analysis.first_trade_detail && parsed.trades.length > 0) {
            parsed.trades[0] = { ...parsed.trades[0], ...analysis.first_trade_detail };
          }

          // Merge trades_deep[] V12 rich per-trade data
          if (Array.isArray(analysis.trades_deep)) {
            for (const deep of analysis.trades_deep) {
              const i = typeof deep?.index === 'number' ? deep.index : -1;
              if (i >= 0 && parsed.trades[i]) {
                parsed.trades[i] = { ...parsed.trades[i], ...deep };
              }
            }
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
            fi_summary: analysis.fi_summary || null,
            cross_user_insight: analysis.cross_user_insight || null,
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
