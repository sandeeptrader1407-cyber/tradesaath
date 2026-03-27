export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';

/* ─── Helper: call Claude with retry on 529 ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaude(apiKey: string, content: any[], maxTokens: number): Promise<{ ok: boolean; data?: any; error?: string; code?: string; stop_reason?: string }> {
  let response: Response | undefined;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }]
      })
    });

    if (response.status === 529) {
      console.log(`API overloaded, retry ${attempt + 1}/${maxRetries} in ${(attempt + 1) * 3}s...`);
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
        continue;
      }
    }
    break;
  }

  if (!response) {
    return { ok: false, error: 'Failed to connect to AI service.', code: 'NETWORK' };
  }
  if (response.status === 529) {
    return { ok: false, error: 'Our AI is currently busy. Please try again in 30 seconds.', code: 'OVERLOADED' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as any;

  if (data.error) {
    if (data.error.type === 'overloaded_error') {
      return { ok: false, error: 'Our AI is currently busy. Please try again in 30 seconds.', code: 'OVERLOADED' };
    }
    return { ok: false, error: 'Analysis failed. Please try again.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
  console.log('Response length:', text.length, 'Stop:', data.stop_reason);

  return { ok: true, data: text, stop_reason: data.stop_reason };
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
   MAIN HANDLER
═══════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const context = formData.get('context') as string || '{}';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
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

    console.log('=== CALL 1: Extract & pair all trades ===');
    console.log('File:', file.name, 'Size:', bytes.byteLength, 'Type:', mediaType);

    /* ═══════════════════════════════════════════
       CALL 1: Extract & pair ALL trades (lean)
    ═══════════════════════════════════════════ */
    const call1Content = [
      ...fileContent,
      {
        type: 'text',
        text: `Extract ALL trades from this file and pair buy/sell orders for the same instrument.

ABSOLUTE RULE — RETURN EVERY SINGLE TRADE:
- Do NOT skip any trades. Do NOT limit to 30 or 50 or any number.
- If there are 74 trades, return 74. If there are 200, return 200.
- I need the COMPLETE picture. Every single paired trade must be in the output.

SORT ALL TRADES CHRONOLOGICALLY BY TRADE TIME (earliest first):
- The sequence matters — a trader's psychology cascades from one trade to the next.
- Trade index 0 should be the first trade of the day.
- If two trades have the same time, keep their file order.

CALCULATION ACCURACY IS CRITICAL:
- You are a professional trading analyst. Every number must be precise.
- Match BUY and SELL orders for the SAME instrument (same strike, same expiry, same CE/PE type)
- P&L per paired trade = (Sell Price - Buy Price) x Quantity
- For options: if lot size is embedded in the quantity, account for it
- If multiple fills for same instrument, use average buy price and average sell price
- If the contract note shows a Net Amount or Net P&L column, use those exact figures
- cum_pnl is the running cumulative total: trade 0 cum_pnl = trade 0 pnl, trade 1 cum_pnl = trade 0 pnl + trade 1 pnl, etc.
- If entry price equals exit price, P&L MUST be 0
- Cross-verify: sum of all individual trade P&Ls must approximately equal the net P&L you report in KPIs
- Win Rate = Winners / Total Trades x 100
- Profit Factor = Gross Profit / |Gross Loss|
- Double-check every calculation before returning

PSYCHOLOGY TAG ASSIGNMENT — think like a trading psychologist:
For EACH trade, look at the PREVIOUS 5 trades to determine the psychological state:
- After 2+ consecutive wins → check for overconfidence (bigger position sizes, looser stops)
- After a loss → check if next trade came within 5 minutes (revenge) or with larger size (tilt)
- After 2+ consecutive losses → check for panic exits, desperate averaging, decision fatigue
- After a big loss → the next 3 trades are almost always emotionally compromised
- Time of day matters: trades after 2 PM with losses before them = highest risk of revenge

Tags:
- "win" — clean entry and exit, followed the plan, good R:R
- "fomo" — entered AFTER a big move already happened, chasing price
- "revenge" — entered within 5 minutes of a losing trade, larger size or same instrument
- "averaging" — added to a losing position
- "panic" — exited at the worst possible price after holding through drawdown
- "against_trend" — traded opposite to the clear market direction that day
- "hope_hold" — held a losing position much longer than the plan would suggest
- "decision_fatigue" — trade quality deteriorated late in the session, random entries

The SEQUENCE tells the story:
- Morning wins → midday overconfidence → first loss → revenge → averaging → panic → more revenge → fatigue
- This is the classic retail trader vicious cycle. Map EACH trade to where it falls in this cycle.

SESSION CLASSIFICATION:
- "morning" = before 11:00 AM
- "midday" = 11:00 AM to 1:30 PM
- "afternoon" = after 1:30 PM

Return ONLY valid JSON, NO markdown backticks, NO explanation:
{
  "broker":"detected broker name",
  "market":"NSE/NYSE/Forex/Crypto",
  "trade_date":"YYYY-MM-DD",
  "currency":"INR or USD etc",
  "total_trades_in_file": number,
  "kpis":{
    "net_pnl":number,"total_trades":number,"wins":number,"losses":number,
    "win_rate":number,"profit_factor":number,"best_trade_pnl":number,"worst_trade_pnl":number
  },
  "trades":[
    {"index":0,"time":"HH:MM","symbol":"name","side":"BUY/SELL","qty":number,"entry":number,"exit":number,"pnl":number,"cum_pnl":number,"tag":"win/fomo/revenge/averaging/panic/against_trend/hope_hold/decision_fatigue","label":"Disciplined Win/FOMO Entry/etc","session":"morning/midday/afternoon"}
  ]
}

RETURN EVERY SINGLE PAIRED TRADE — NO LIMIT. The per-trade data is small so this will fit.`
      }
    ];

    const call1 = await callClaude(apiKey, call1Content, 16000);
    if (!call1.ok) {
      return NextResponse.json({ error: call1.error, code: call1.code }, { status: call1.code === 'OVERLOADED' ? 529 : 500 });
    }

    const parsed1 = safeParseJSON(call1.data);
    if (!parsed1.ok || !parsed1.data) {
      return NextResponse.json({ error: 'Could not parse trade data. Please try a smaller file.', code: 'TRUNCATED' }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tradesData = parsed1.data as any;
    const extractedCount = tradesData.trades?.length || 0;
    const expectedCount = tradesData.total_trades_in_file || 0;
    console.log(`Call 1 done: ${extractedCount} trades extracted, ${expectedCount} expected`);

    /* ═══════════════════════════════════════════
       CALL 1B: Continuation if trades were truncated
    ═══════════════════════════════════════════ */
    if (parsed1.truncated && expectedCount > extractedCount && extractedCount > 0) {
      console.log(`=== CALL 1B: Fetching remaining trades from index ${extractedCount} ===`);
      const call1bContent = [
        ...fileContent,
        {
          type: 'text',
          text: `I already extracted trades 0 through ${extractedCount - 1} from this file. There should be ${expectedCount} total trades.

Continue extracting the REMAINING trades starting from index ${extractedCount}. Use the exact same format.

Return ONLY valid JSON, NO markdown backticks:
{
  "trades":[
    {"index":${extractedCount},"time":"HH:MM","symbol":"name","side":"BUY/SELL","qty":number,"entry":number,"exit":number,"pnl":number,"cum_pnl":number,"tag":"tag","label":"label","session":"session"}
  ]
}

Sort by time. Return ALL remaining trades.`
        }
      ];

      const call1b = await callClaude(apiKey, call1bContent, 8000);
      if (call1b.ok) {
        const parsed1b = safeParseJSON(call1b.data);
        if (parsed1b.ok && parsed1b.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extraTrades = (parsed1b.data as any).trades || [];
          if (extraTrades.length > 0) {
            tradesData.trades = [...(tradesData.trades || []), ...extraTrades];
            // Recalculate cum_pnl for the continuation trades
            for (let i = extractedCount; i < tradesData.trades.length; i++) {
              tradesData.trades[i].cum_pnl = (i > 0 ? tradesData.trades[i - 1].cum_pnl : 0) + tradesData.trades[i].pnl;
            }
            console.log(`Call 1B: added ${extraTrades.length} more trades, total now ${tradesData.trades.length}`);
          }
        }
      }
    }

    // Sort trades chronologically by time (ensure correct order)
    if (tradesData.trades && tradesData.trades.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tradesData.trades.sort((a: any, b: any) => {
        const timeA = (a.time || '00:00').replace(/:/g, '');
        const timeB = (b.time || '00:00').replace(/:/g, '');
        return parseInt(timeA) - parseInt(timeB);
      });
      // Re-index and recalculate cum_pnl after sorting
      let cumPnl = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tradesData.trades.forEach((t: any, i: number) => {
        t.index = i;
        cumPnl += t.pnl || 0;
        t.cum_pnl = cumPnl;
      });
    }

    /* ═══════════════════════════════════════════
       CALL 2: Deep analysis (session + trade #1)
    ═══════════════════════════════════════════ */
    console.log('=== CALL 2: Deep analysis ===');

    // Build last-5-trades context for the first trade (it's the first, so it has no prior trades)
    const first5Trades = (tradesData.trades || []).slice(0, 5);
    const first5Summary = first5Trades.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => `#${t.index + 1} ${t.time} ${t.symbol} ${t.pnl >= 0 ? '+' : ''}${t.pnl}`
    ).join(', ');

    const tradesJson = JSON.stringify(tradesData.trades || []);
    const call2Content = [
      {
        type: 'text',
        text: `You are TradeSaath, a personal trading mentor who has been watching the trader's screen all day. Here is their trade data:

Broker: ${tradesData.broker || 'unknown'}
Market: ${tradesData.market || 'unknown'}
Date: ${tradesData.trade_date || 'unknown'}
User context: ${contextStr || 'none provided'}
KPIs: Net P&L ${tradesData.kpis?.net_pnl}, ${tradesData.kpis?.total_trades} trades, ${tradesData.kpis?.wins} wins, ${tradesData.kpis?.losses} losses, Win rate ${tradesData.kpis?.win_rate}%

First 5 trades summary: ${first5Summary}

Trades (sorted chronologically):
${tradesJson}

TONE AND STYLE — THIS IS CRITICAL:
- Write like a personal trading mentor who has been watching the trader's screen all day
- Use "you" and "your" — speak directly to the trader
- Be specific — reference actual trade times, actual prices, actual symbols from the data above
- Don't say generic things like "emotional decision-making" — say exactly WHAT emotion, WHEN it happened, and WHAT it cost them in rupees
- For psychology coaching: be empathetic but honest. Acknowledge what went right before pointing out what went wrong
- For the session summary: tell the STORY of the trading day — the arc from morning to afternoon, the turning points, the emotional shifts
- Sound like a human mentor, not an AI report generator
- Good examples of tone:
  "Your first 3 trades were sharp — you were in the zone. But that trade at 14:32? That wasn't a trade, that was frustration talking."
  "You know that feeling when you take a loss and immediately want to make it back? That's exactly what happened next."
  "Here's what I want you to remember: your morning session proves you CAN trade well. The problem isn't skill — it's what happens after 2pm."

VICIOUS CYCLE DETECTION — THIS IS THE CORE OF TRADESAATH:
For EACH trade, look at the PREVIOUS 5 trades to determine the psychological state:
- After 2+ consecutive wins → check for overconfidence (bigger position sizes, looser stops)
- After a loss → check if next trade came within 5 minutes (revenge) or with larger size (tilt)
- After 2+ consecutive losses → check for panic exits, desperate averaging, decision fatigue
- After a big loss → the next 3 trades are almost always emotionally compromised
- Time of day matters: trades after 2 PM with losses before them = highest risk of revenge
The SEQUENCE tells the story. Map EACH trade to where it falls in the vicious cycle.

Now provide the deep analysis. Return ONLY valid JSON, no backticks:
{
  "summary": "2-3 paragraph narrative telling the STORY of this trading day. Reference specific trades by time and symbol. Describe the emotional arc. What went right in the morning? Where did things go wrong? What was the turning point?",
  "momentum": [
    {"name": "Rule Following", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation referencing their trades"},
    {"name": "Staying Calm", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"},
    {"name": "Entry Timing", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"},
    {"name": "Exit Discipline", "score": 0-100, "color": "green/red/gold/accent", "desc": "specific explanation"}
  ],
  "vicious_cycle": [
    {"stage": "Disciplined Win", "count": number, "icon": "check", "desc": "text"},
    {"stage": "FOMO Re-entry", "count": number, "icon": "zap", "desc": "text"},
    {"stage": "Against Trend", "count": number, "icon": "arrow", "desc": "text"},
    {"stage": "Hope & Hold", "count": number, "icon": "pray", "desc": "text"},
    {"stage": "Averaging Down", "count": number, "icon": "down", "desc": "text"},
    {"stage": "Panic Exit", "count": number, "icon": "wind", "desc": "text"},
    {"stage": "Revenge Trade", "count": number, "icon": "sword", "desc": "text"},
    {"stage": "Decision Fatigue", "count": number, "icon": "dizzy", "desc": "text"}
  ],
  "technical_insights": [
    {"name": "Trend Alignment", "score": 0-100, "color": "green/red/gold", "desc": "text"},
    {"name": "Entry Structure", "score": 0-100, "color": "green/red/gold", "desc": "text"},
    {"name": "Exit Quality", "score": 0-100, "color": "green/red/gold", "desc": "text"},
    {"name": "Entry Timing", "score": 0-100, "color": "green/red/gold", "desc": "text"}
  ],
  "first_trade_detail": {
    "time_gap_from_last": "first trade",
    "quick_summary": "2-3 sentences about THIS specific trade — what happened, why, and the psychology behind it. Reference the actual symbol, prices, and time.",
    "vicious_cycle_stage": "Which stage and why, in one sentence",
    "entry_exit_efficiency": {
      "entry_score": 0-100,
      "exit_score": 0-100,
      "risk_reward": "1.5x etc",
      "optimal_rr": "what optimal could have been"
    },
    "entry_timing": {
      "description": "Entry at the specific time — describe where in the price action",
      "risk_level": "High/Medium/Low"
    },
    "in_trade_behavior": {
      "discipline": "DISCIPLINED/IMPULSIVE/PANIC",
      "description": "what likely happened during the trade",
      "during_trade": "patience/premature exit/held too long/etc"
    },
    "what_you_did_vs_should_have": {
      "what_you_did": "2-3 sentences about their actual behavior in plain English",
      "what_to_do_instead": "2-3 sentences of specific, actionable behavioral advice",
      "key_lesson": "One sentence takeaway"
    },
    "last_5_trades_context": "Recent momentum going into this trade. Since it's trade #1, describe the opening mindset. For later trades, show the P&L of the last 5 and the emotional momentum.",
    "psychology_coaching": "3-4 sentences. Be a mentor. Reference their exact entry at X, exit at Y, the P&L of Z. Acknowledge what they did right. Then point out the ONE thing to change. Make it personal and specific.",
    "technical_analysis": "3-4 sentences. Reference actual price levels from the trade. Discuss support/resistance, trend direction, where the entry was relative to key levels.",
    "counterfactual": "What-if scenario with specific behavioral changes and estimated impact. Not fake numbers — real behavioral advice."
  }
}

IMPORTANT: Provide ALL fields in first_trade_detail. Every single one including last_5_trades_context. The user sees this for free and it must be impressive enough to make them upgrade.`
      }
    ];

    const call2 = await callClaude(apiKey, call2Content, 8000);
    if (!call2.ok) {
      console.error('Call 2 failed, returning basic results:', call2.error);
      return NextResponse.json({
        ...tradesData,
        trades_shown: tradesData.trades?.length || 0,
        summary: 'Analysis is temporarily limited. Your trade data has been extracted successfully.',
        momentum: [],
        vicious_cycle: [],
        technical_insights: [],
      });
    }

    const parsed2 = safeParseJSON(call2.data);
    if (!parsed2.ok || !parsed2.data) {
      console.error('Call 2 parse failed, returning basic results');
      return NextResponse.json({
        ...tradesData,
        trades_shown: tradesData.trades?.length || 0,
        summary: 'Detailed analysis could not be generated. Your trade data is shown below.',
        momentum: [],
        vicious_cycle: [],
        technical_insights: [],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysis = parsed2.data as any;
    console.log('Call 2 done: analysis complete');

    // Merge Call 1 trades with Call 2 analysis + first trade detail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades = (tradesData.trades || []).map((t: any, i: number) => {
      if (i === 0 && analysis.first_trade_detail) {
        return { ...t, ...analysis.first_trade_detail };
      }
      return t;
    });

    const result = {
      broker: tradesData.broker,
      market: tradesData.market,
      trade_date: tradesData.trade_date,
      currency: tradesData.currency,
      total_trades_in_file: tradesData.total_trades_in_file || trades.length,
      trades_shown: trades.length,
      kpis: tradesData.kpis,
      summary: analysis.summary || '',
      momentum: analysis.momentum || [],
      vicious_cycle: analysis.vicious_cycle || [],
      technical_insights: analysis.technical_insights || [],
      trades,
      _truncated: parsed1.truncated || false,
    };

    return NextResponse.json(result);

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
