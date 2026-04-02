export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';

/* ─── Types ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIResult = { ok: boolean; data?: any; error?: string; code?: string; stop_reason?: string; provider?: string };

/* ─── Helper: call Claude (Anthropic) with retry on 529 ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(apiKey: string, content: any[], maxTokens: number, maxRetries = 1): Promise<AIResult> {
  try {
    let response: Response | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 70000); // 70s — single call gets more time
        response = await fetch('https://api.anthropic.com/v1/messages', {
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
      } catch (fetchErr: unknown) {
        const msg = fetchErr instanceof Error ? fetchErr.message : 'fetch failed';
        console.error(`Claude fetch error (attempt ${attempt + 1}):`, msg);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        return { ok: false, error: `Claude network error: ${msg}`, code: 'NETWORK', provider: 'claude' };
      }

      if (response.status === 529) {
        console.log(`Claude overloaded, retry ${attempt + 1}/${maxRetries} in ${(attempt + 1) * 3}s...`);
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
          continue;
        }
      }
      break;
    }

    if (!response) {
      return { ok: false, error: 'Failed to connect to Claude.', code: 'NETWORK', provider: 'claude' };
    }

    console.log('Claude API response status:', response.status);

    if (response.status === 529) {
      return { ok: false, error: 'Claude is currently busy (529).', code: 'OVERLOADED', provider: 'claude' };
    }
    if (response.status === 429) {
      return { ok: false, error: 'Claude rate/usage limit reached (429).', code: 'RATE_LIMIT', provider: 'claude' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = await response.json();
    } catch {
      return { ok: false, error: `Claude HTTP ${response.status} — non-JSON response`, code: 'PARSE', provider: 'claude' };
    }

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${response.status}`;
      console.error('Claude API error:', JSON.stringify(data.error || data));
      return { ok: false, error: `Claude: ${errMsg}`, code: data.error?.type || `HTTP_${response.status}`, provider: 'claude' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
    console.log('Claude response length:', text.length, 'Stop:', data.stop_reason);

    return { ok: true, data: text, stop_reason: data.stop_reason, provider: 'claude' };

  } catch (outerErr: unknown) {
    const msg = outerErr instanceof Error ? outerErr.message : 'Unknown Claude error';
    console.error('Claude unexpected error:', msg);
    return { ok: false, error: `Claude crashed: ${msg}`, code: 'CRASH', provider: 'claude' };
  }
}

/* ─── Helper: call Gemini (Google) ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(apiKey: string, content: any[], maxTokens: number): Promise<AIResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  for (const item of content) {
    if (item.type === 'text') {
      parts.push({ text: item.text });
    } else if (item.type === 'document' && item.source) {
      parts.push({ inlineData: { mimeType: item.source.media_type, data: item.source.data } });
    } else if (item.type === 'image' && item.source) {
      parts.push({ inlineData: { mimeType: item.source.media_type, data: item.source.data } });
    }
  }

  try {
    const model = 'gemini-2.5-flash-preview-05-20';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75000); // 75s for single call
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3,
        }
      })
    });
    clearTimeout(timeout);

    console.log('Gemini API response status:', response.status);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;

    if (data.error) {
      console.error('Gemini API error:', JSON.stringify(data.error));
      return { ok: false, error: `Gemini: ${data.error.message || 'Unknown error'}`, code: 'GEMINI_ERROR', provider: 'gemini' };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = data.candidates?.[0]?.finishReason || '';
    console.log('Gemini response length:', text.length, 'Finish:', finishReason);

    if (!text) {
      return { ok: false, error: 'Gemini returned empty response', code: 'EMPTY', provider: 'gemini' };
    }

    return { ok: true, data: text, stop_reason: finishReason === 'STOP' ? 'end_turn' : finishReason, provider: 'gemini' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown Gemini error';
    console.error('Gemini call failed:', msg);
    return { ok: false, error: `Gemini: ${msg}`, code: 'GEMINI_NETWORK', provider: 'gemini' };
  }
}

/* ─── Helper: get Gemini API key ─── */
function getGeminiKey(): string | undefined {
  return process.env.Gemini_API_Key
    || process.env.GEMINI_API_KEY
    || process.env.Gemini_Api_Key
    || process.env.GEMINI_API_key
    || process.env.gemini_api_key;
}

/* ─── Unified AI caller: Claude first, Gemini fallback ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callAI(content: any[], maxTokens: number): Promise<AIResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = getGeminiKey();

  const geminiEnvNames = Object.keys(process.env).filter(k => k.toLowerCase().includes('gemini'));
  console.log('AI keys — Claude:', !!anthropicKey, 'Gemini:', !!geminiKey, 'Gemini env vars found:', geminiEnvNames);

  if (anthropicKey && geminiKey) {
    console.log('Trying Claude (primary, fast-fail with Gemini fallback)...');
    const result = await callClaude(anthropicKey, content, maxTokens);
    if (result.ok) return result;
    console.warn('Claude failed:', result.error, '— switching to Gemini');

    console.log('Using Gemini (fallback)...');
    const geminiResult = await callGemini(geminiKey, content, maxTokens);
    if (geminiResult.ok) return geminiResult;
    console.error('Gemini fallback also failed:', geminiResult.error);
    return { ...result, error: `Claude: ${result.error} | Gemini: ${geminiResult.error}` };
  }

  if (anthropicKey) {
    console.log('Using Claude (only provider)...');
    return callClaude(anthropicKey, content, maxTokens);
  }

  if (geminiKey) {
    console.log('Using Gemini (primary — no Claude key)...');
    return callGemini(geminiKey, content, maxTokens);
  }

  return { ok: false, error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.', code: 'NO_KEY' };
}

/* ─── Helper: parse JSON with truncation recovery ─── */
function safeParseJSON(raw: string): { ok: boolean; data?: Record<string, unknown>; truncated?: boolean } {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return { ok: true, data: JSON.parse(cleaned) };
  } catch {
    console.error('JSON parse failed, attempting truncation recovery...');

    const lastBrace = cleaned.lastIndexOf('}]');
    const lastComma = cleaned.lastIndexOf('},');

    if (lastBrace > 0 && lastBrace > lastComma) {
      cleaned = cleaned.substring(0, lastBrace + 2);
    } else if (lastComma > 0) {
      cleaned = cleaned.substring(0, lastComma + 1);
    }

    const openBraces = (cleaned.match(/{/g) || []).length - (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets; i++) cleaned += ']';
    for (let i = 0; i < openBraces; i++) cleaned += '}';

    try {
      const data = JSON.parse(cleaned);
      console.log('Truncation recovery succeeded');
      return { ok: true, data, truncated: true };
    } catch (e2: unknown) {
      console.error('Recovery failed:', e2 instanceof Error ? e2.message : 'unknown');
      return { ok: false };
    }
  }
}

/* ═══════════════════════════════════════════════════
   MAIN HANDLER — SINGLE API CALL (fits in 90s Vercel timeout)
═══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const context = formData.get('context') as string || '{}';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasGeminiKey = !!getGeminiKey();
    if (!hasAnthropicKey && !hasGeminiKey) {
      return NextResponse.json({ error: 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.' }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const name = file.name.toLowerCase();
    let mediaType = 'application/pdf';
    if (name.endsWith('.csv') || name.endsWith('.tsv')) mediaType = 'text/csv';
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) mediaType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (name.endsWith('.png')) mediaType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mediaType = 'image/jpeg';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fileContent: any[];
    if (mediaType === 'text/csv') {
      const text = Buffer.from(bytes).toString('utf-8');
      fileContent = [{ type: 'text', text: 'Here is a trade file in CSV format:\n\n' + text }];
    } else if (mediaType.startsWith('image/')) {
      fileContent = [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }];
    } else {
      fileContent = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }];
    }

    let ctx: Record<string, string> = {};
    try { ctx = JSON.parse(context); } catch { /* ignore */ }
    const contextStr = Object.entries(ctx).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');

    console.log('=== SINGLE COMBINED CALL: Extract trades + Deep analysis ===');
    console.log('File:', file.name, 'Size:', bytes.byteLength, 'Type:', mediaType);

    /* ═══════════════════════════════════════════
       SINGLE COMBINED CALL: Extract + Analyse
    ═══════════════════════════════════════════ */
    const combinedContent = [
      ...fileContent,
      {
        type: 'text',
        text: `You are TradeSaath, a personal trading mentor. Analyse this trade file completely.

STEP 1 — EXTRACT ALL TRADES:
- Pair BUY+SELL for same instrument (same strike/expiry/CE/PE)
- P&L = (Sell Price - Buy Price) x Qty. Use net amounts if shown.
- cum_pnl = running total. Win Rate = wins/total*100. Profit Factor = gross profit/|gross loss|.
- Tag each: "win","fomo","revenge","averaging","panic","against_trend","hope_hold","decision_fatigue"
- Session: "morning" (<11AM), "midday" (11AM-1:30PM), "afternoon" (>1:30PM)
- Sort by time. Return ALL trades.

STEP 2 — DEEP PSYCHOLOGY ANALYSIS (using the trades you just extracted):
${contextStr ? `User context: ${contextStr}` : ''}

TONE — Write like a mentor who watched their screen all day:
- Use "you" and "your" — speak directly to the trader
- Reference actual trade times, prices, symbols
- Don't say generic things — say WHAT emotion, WHEN, and WHAT it cost in rupees
- Be empathetic but honest. Acknowledge what went right before pointing out what went wrong
- Tell the STORY of the trading day — morning to afternoon, turning points, emotional shifts

VICIOUS CYCLE DETECTION:
- After 2+ wins → check overconfidence (bigger sizes, looser stops)
- After a loss → check if next trade came within 5 min (revenge) or larger size (tilt)
- After 2+ losses → check panic exits, desperate averaging, decision fatigue
- After a big loss → next 3 trades are almost always emotionally compromised
- Trades after 2 PM with prior losses = highest revenge risk

Return ONLY valid JSON, no backticks:
{
  "broker": "name",
  "market": "NSE/NYSE",
  "trade_date": "YYYY-MM-DD",
  "currency": "INR",
  "total_trades_in_file": N,
  "kpis": {
    "net_pnl": N, "total_trades": N, "wins": N, "losses": N,
    "win_rate": N, "profit_factor": N, "best_trade_pnl": N, "worst_trade_pnl": N
  },
  "trades": [
    {"index": 0, "time": "HH:MM", "symbol": "name", "side": "BUY/SELL", "qty": N, "entry": N, "exit": N, "pnl": N, "cum_pnl": N, "tag": "tag", "label": "label", "session": "session"}
  ],
  "summary": "2-3 paragraph narrative of the trading day. Reference specific trades by time and symbol. Describe the emotional arc.",
  "momentum": [
    {"name": "Rule Following", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"},
    {"name": "Staying Calm", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"},
    {"name": "Entry Timing", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"},
    {"name": "Exit Discipline", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"}
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
    "message": "One sentence about what disciplined trading would have looked like"
  },
  "mistake_patterns": [
    {"name": "pattern name", "icon": "emoji", "count": N, "cost": N, "frequency": "X of Y trades"}
  ],
  "rules_for_next_session": ["rule 1", "rule 2", "rule 3"],
  "first_trade_detail": {
    "time_gap_from_last": "first trade",
    "quick_summary": "2-3 sentences about THIS specific trade — what happened, why, and the psychology behind it.",
    "vicious_cycle_stage": "Which stage and why",
    "entry_exit_efficiency": {
      "entry_score": 0-100,
      "exit_score": 0-100,
      "risk_reward": "1.5x etc",
      "optimal_rr": "what optimal could have been"
    },
    "entry_timing": {
      "description": "Entry at the specific time — where in the price action",
      "risk_level": "High/Medium/Low"
    },
    "in_trade_behavior": {
      "discipline": "DISCIPLINED/IMPULSIVE/PANIC",
      "description": "what likely happened during the trade",
      "during_trade": "patience/premature exit/held too long/etc"
    },
    "what_you_did_vs_should_have": {
      "what_you_did": "2-3 sentences about their actual behavior",
      "what_to_do_instead": "2-3 sentences of specific, actionable advice",
      "key_lesson": "One sentence takeaway"
    },
    "last_5_trades_context": "Since it's trade #1, describe the opening mindset.",
    "psychology_coaching": "3-4 sentences. Be a mentor. Reference exact entry, exit, P&L. Acknowledge what they did right, then the ONE thing to change.",
    "technical_analysis": "3-4 sentences. Reference actual price levels. Discuss support/resistance, trend direction.",
    "counterfactual": "What-if scenario with specific behavioral changes and estimated impact."
  }
}

IMPORTANT: Return ALL fields. Every single one. The first_trade_detail is shown for free and must be impressive enough to make traders upgrade.`
      }
    ];

    const result = await callAI(combinedContent, 16000);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.code === 'OVERLOADED' ? 529 : 500 });
    }

    const parsed = safeParseJSON(result.data);
    if (!parsed.ok || !parsed.data) {
      return NextResponse.json({ error: 'Could not parse analysis. Please try a smaller file.', code: 'TRUNCATED' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = parsed.data as any;
    console.log(`Analysis done: ${data.trades?.length || 0} trades extracted, provider: ${result.provider}`);

    // Sort trades chronologically and fix indices/cum_pnl
    if (data.trades && data.trades.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.trades.sort((a: any, b: any) => {
        const timeA = (a.time || '00:00').replace(/:/g, '');
        const timeB = (b.time || '00:00').replace(/:/g, '');
        return parseInt(timeA) - parseInt(timeB);
      });
      let cumPnl = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.trades.forEach((t: any, i: number) => {
        t.index = i;
        cumPnl += t.pnl || 0;
        t.cum_pnl = cumPnl;
      });
    }

    // Merge first_trade_detail into the first trade object
    if (data.first_trade_detail && data.trades?.length > 0) {
      data.trades[0] = { ...data.trades[0], ...data.first_trade_detail };
    }

    const response = {
      broker: data.broker,
      market: data.market,
      trade_date: data.trade_date,
      currency: data.currency,
      total_trades_in_file: data.total_trades_in_file || data.trades?.length || 0,
      trades_shown: data.trades?.length || 0,
      kpis: data.kpis,
      summary: data.summary || '',
      momentum: data.momentum || [],
      vicious_cycle: data.vicious_cycle || [],
      technical_insights: data.technical_insights || [],
      dqs: data.dqs || null,
      financial_impact: data.financial_impact || null,
      mistake_patterns: data.mistake_patterns || [],
      rules_for_next_session: data.rules_for_next_session || [],
      trades: data.trades || [],
      _truncated: parsed.truncated || false,
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    console.error('Analysis error:', msg);
    let userMsg = 'Analysis failed. Please try again.';
    if (msg.includes('JSON')) {
      userMsg = 'Your file has too many trades and the response was cut off. Please try a smaller file.';
    } else if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
      userMsg = 'Analysis took too long. Please try a smaller file or try again.';
    }
    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
