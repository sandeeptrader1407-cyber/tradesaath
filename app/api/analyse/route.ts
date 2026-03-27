export const runtime = 'nodejs';
export const maxDuration = 90;

import { NextRequest, NextResponse } from 'next/server';

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

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Detect mime type
    const name = file.name.toLowerCase();
    let mediaType = 'application/pdf';
    if (name.endsWith('.csv') || name.endsWith('.tsv')) mediaType = 'text/csv';
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) mediaType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (name.endsWith('.png')) mediaType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mediaType = 'image/jpeg';

    // For CSV/text files, send as text instead of document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any[];
    if (mediaType === 'text/csv') {
      const text = Buffer.from(bytes).toString('utf-8');
      content = [
        { type: 'text', text: 'Here is a trade file in CSV format:\n\n' + text },
      ];
    } else if (mediaType.startsWith('image/')) {
      content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      ];
    } else {
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      ];
    }

    // Parse user context
    let ctx: Record<string, string> = {};
    try { ctx = JSON.parse(context); } catch { /* ignore */ }

    const contextStr = Object.entries(ctx)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    // Add the analysis prompt
    content.push({
      type: 'text',
      text: `You are TradeSaath, an elite AI trading psychology engine used by professional traders. Analyse this trade file with EXTREME depth and detail.

User context: ${contextStr || 'none provided'}

CRITICAL P&L CALCULATION RULES:
- This is a broker contract note with individual BUY and SELL orders
- You must PAIR buy and sell orders for the SAME instrument (same strike, same expiry, same CE/PE type)
- Group all orders for the same instrument: calculate average buy price, average sell price, total quantity
- P&L per paired trade = (Avg Sell Price - Avg Buy Price) x Quantity
- If entry and exit price are the same, P&L is 0 — NEVER show profit for identical prices
- Return PAIRED trades (one row per instrument), NOT individual orders
- Calculate cumulative P&L (cum_pnl) as running total across all paired trades in chronological order
- Use the Net Amount column from the contract note if available for accurate calculation
- Account for brokerage/charges if visible in the document

INSTRUCTIONS:
1. Extract ALL trades from the file. For broker contract notes, use the Trade Annexure section.
2. Pair buy and sell orders for the same instrument to calculate P&L per trade pair.
3. Calculate cumulative P&L (running total) across all trades in chronological order.
4. Assign each trade pair a psychology tag: win, fomo, revenge, averaging, panic, against_trend, hope_hold, decision_fatigue
5. Map each trade to a stage in the Vicious Cycle of retail traders.
6. Generate session analysis including momentum scores and vicious cycle detection.

RESPONSE SIZE RULES — CRITICAL FOR AVOIDING TRUNCATION:
- If the file has MORE than 30 paired trades, return ONLY the top 30 most significant trades (largest absolute P&L, most problematic patterns like revenge/fomo/panic). Include "total_trades_in_file" and "trades_shown" fields.
- If the file has 30 or fewer paired trades, return ALL of them. Set "total_trades_in_file" and "trades_shown" to the same number.
- For the FIRST trade (index 0): provide ALL detail fields (quick_summary, psychology_coaching, technical_analysis, etc.)
- For trades index 1+: provide ONLY: index, time, symbol, side, qty, entry, exit, pnl, cum_pnl, tag, label, session
- Do NOT include quick_summary, psychology_coaching, technical_analysis, what_you_did_vs_should_have, entry_exit_efficiency, entry_timing, in_trade_behavior, vicious_cycle_stage, or counterfactual for trades index 1+

Return ONLY valid JSON with NO markdown backticks, NO explanation before or after:
{
  "broker": "detected broker name",
  "market": "NSE/NYSE/Forex/Crypto",
  "trade_date": "YYYY-MM-DD",
  "currency": "INR or USD etc",
  "total_trades_in_file": number,
  "trades_shown": number,
  "kpis": {
    "net_pnl": number,
    "total_trades": number,
    "wins": number,
    "losses": number,
    "win_rate": number,
    "profit_factor": number,
    "best_trade_pnl": number,
    "worst_trade_pnl": number
  },
  "summary": "2-3 paragraph narrative about the session - what went well, what went wrong, the emotional arc",
  "momentum": [
    {"name": "Rule Following", "score": 0-100, "color": "green/red/gold/accent", "desc": "explanation"},
    {"name": "Staying Calm", "score": 0-100, "color": "green/red/gold/accent", "desc": "explanation"},
    {"name": "Entry Timing", "score": 0-100, "color": "green/red/gold/accent", "desc": "explanation"},
    {"name": "Exit Discipline", "score": 0-100, "color": "green/red/gold/accent", "desc": "explanation"}
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
  "trades": [
    {
      "index": 0,
      "time": "HH:MM",
      "symbol": "instrument name",
      "side": "BUY or SELL",
      "qty": number,
      "entry": number,
      "exit": number,
      "pnl": number,
      "cum_pnl": number,
      "tag": "win/fomo/revenge/averaging/panic/against_trend/hope_hold/decision_fatigue",
      "label": "Disciplined Win / FOMO Entry / Revenge Trade / Averaging Down / Panic Exit / Against Trend / Hope & Hold / Decision Fatigue",
      "session": "morning/midday/afternoon",
      "time_gap_from_last": "first trade",
      "quick_summary": "2-3 sentence summary of what happened in this trade and WHY psychologically. Be very specific about THIS trade.",
      "vicious_cycle_stage": "Which of the 8 vicious cycle stages this trade maps to and a 1-sentence explanation of why",
      "entry_exit_efficiency": {
        "entry_score": 0-100,
        "exit_score": 0-100,
        "risk_reward": "1.5x or 0.3x etc",
        "optimal_rr": "What the optimal R:R could have been with better execution"
      },
      "entry_timing": {
        "description": "Entry at HH:MM — describe where in the candle/price action the entry happened",
        "risk_level": "High/Medium/Low"
      },
      "in_trade_behavior": {
        "discipline": "DISCIPLINED/IMPULSIVE/PANIC",
        "description": "What the trader likely did during the trade based on entry/exit patterns",
        "during_trade": "patience/premature exit/held too long/moved stop loss/averaged down"
      },
      "what_you_did_vs_should_have": {
        "what_you_did": "Plain English description of actual behavior — entry logic, hold behavior, exit decision. 2-3 sentences.",
        "what_to_do_instead": "Actionable behavioral advice — e.g. wait for confirmation, set hard SL at support, exit at first reversal sign, avoid trading against trend, follow 15-min cool-down rule after loss. 2-3 sentences.",
        "key_lesson": "One sentence takeaway for this specific trade"
      },
      "psychology_coaching": "Detailed 3-4 sentence coaching paragraph. Be specific about THIS trade. Reference the exact entry/exit prices, the psychology tag, and give actionable advice. Make it impressive enough that the user wants to unlock all trades.",
      "technical_analysis": "Detailed 3-4 sentence TA paragraph. Discuss the price action, where support/resistance likely was, whether the entry was with or against the trend.",
      "counterfactual": "What-if scenario: If you had done X instead of Y, your P&L would have been Z. Be specific with behavioral changes, not fake price numbers."
    },
    {"index":1,"time":"HH:MM","symbol":"name","side":"BUY","qty":1,"entry":100,"exit":105,"pnl":5,"cum_pnl":10,"tag":"win","label":"Disciplined Win","session":"morning"}
  ]
}

IMPORTANT RULES:
- KPIs must reflect ALL trades in the file, even if you only return 30 in the trades array
- cum_pnl is the running cumulative P&L. Trade 0 cum_pnl = trade 0 pnl. Trade 1 cum_pnl = trade 0 pnl + trade 1 pnl. etc.
- session: morning = before 10:30, midday = 10:30-13:30, afternoon = after 13:30 (adjust for market timezone)
- time_gap_from_last: first trade says "first trade", others show gap like "2m 30s" or "45m"
- entry_score/exit_score: 100 = perfect timing, 0 = worst possible timing relative to the candle/session
- Be brutally honest in psychology_coaching. This is for the trader's growth.
- what_you_did_vs_should_have: use plain English behavioral descriptions, NOT fabricated price numbers
- counterfactual must describe behavioral changes, not made-up price targets`
    });

    console.log('Sending to Claude API...');
    console.log('File:', file.name, 'Size:', bytes.byteLength, 'Type:', mediaType);

    // Call Claude API with retry logic for overload (529)
    let response: Response | undefined;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{ role: 'user', content }]
        })
      });

      if (response.status === 529) {
        retries++;
        console.log(`API overloaded, retry ${retries}/${maxRetries} in ${retries * 3} seconds...`);
        if (retries < maxRetries) {
          await new Promise(r => setTimeout(r, retries * 3000));
          continue;
        }
      }
      break;
    }

    if (!response) {
      return NextResponse.json({ error: 'Failed to connect to AI service. Please try again.' }, { status: 500 });
    }

    if (response.status === 529) {
      return NextResponse.json(
        { error: 'Our AI is currently busy. Please try again in 30 seconds.', code: 'OVERLOADED' },
        { status: 529 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    console.log('Claude API status:', response.status);

    if (data.error) {
      console.error('Claude API error:', data.error);
      // Friendly messages for common errors
      if (data.error.type === 'overloaded_error') {
        return NextResponse.json(
          { error: 'Our AI is currently busy. Please try again in 30 seconds.', code: 'OVERLOADED' },
          { status: 529 }
        );
      }
      return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
    }

    // Extract text response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
    console.log('Raw response length:', text.length);
    console.log('Stop reason:', data.stop_reason);

    // Clean markdown wrappers
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON — with truncation recovery
    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed, attempting to fix truncated response...');

      // Remove any trailing incomplete element (partial object/string)
      // Find the last complete object ending with }
      const lastCompleteComma = cleaned.lastIndexOf('},');
      const lastCompleteBrace = cleaned.lastIndexOf('}]');

      if (lastCompleteBrace > 0 && lastCompleteBrace > lastCompleteComma) {
        // The trades array was almost complete, just needs closing braces
        cleaned = cleaned.substring(0, lastCompleteBrace + 2);
      } else if (lastCompleteComma > 0) {
        // Cut at the last complete trade object
        cleaned = cleaned.substring(0, lastCompleteComma + 1);
      }

      // Recount and close remaining brackets
      const openBraces = (cleaned.match(/{/g) || []).length - (cleaned.match(/}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets; i++) cleaned += ']';
      for (let i = 0; i < openBraces; i++) cleaned += '}';

      try {
        result = JSON.parse(cleaned);
        console.log('Fixed truncated JSON successfully, trades recovered:', result.trades?.length || 0);
        // Mark as truncated so frontend can show a notice
        result._truncated = true;
      } catch (e2: unknown) {
        const parseMsg = e2 instanceof Error ? e2.message : 'unknown';
        console.error('Could not fix JSON:', parseMsg);
        console.error('First 500 chars:', cleaned.substring(0, 500));
        console.error('Last 500 chars:', cleaned.substring(cleaned.length - 500));
        return NextResponse.json(
          { error: 'Your file has too many trades for a single analysis. Please try uploading a smaller file or a single day\'s trades.', code: 'TRUNCATED' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    console.error('Analysis error:', msg);
    // Never expose raw error messages to user
    let userMsg = 'Analysis failed. Please try again.';
    if (msg.includes('JSON')) {
      userMsg = 'Your file has too many trades and the response was cut off. Please try a smaller file.';
    } else if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
      userMsg = 'Analysis took too long. Please try a smaller file or try again.';
    }
    return NextResponse.json({ error: userMsg }, { status: 500 });
  }
}
