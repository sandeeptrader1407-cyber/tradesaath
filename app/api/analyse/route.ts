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
      text: `You are TradeSaath, an AI trading psychology engine. Analyse this trade file.

User context: ${contextStr || 'none provided'}

INSTRUCTIONS:
1. Extract ALL trades from the file. For broker contract notes, use the Trade Annexure section.
2. Pair buy and sell orders for the same instrument to calculate P&L per trade pair.
3. Assign each trade pair a psychology tag: win, fomo, revenge, averaging, panic, against_trend, hope_hold, decision_fatigue
4. Generate session analysis including momentum scores and vicious cycle detection.
5. For the first trade only, provide detailed psychology coaching and technical analysis.

Return ONLY valid JSON with NO markdown backticks, NO explanation before or after:
{
  "broker": "detected broker name",
  "market": "NSE/NYSE/Forex/Crypto",
  "trade_date": "YYYY-MM-DD",
  "currency": "INR or USD etc",
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
    {"stage": "Disciplined Win", "count": number, "icon": "✓", "desc": "text"},
    {"stage": "FOMO Re-entry", "count": number, "icon": "⚡", "desc": "text"},
    {"stage": "Against Trend", "count": number, "icon": "↙", "desc": "text"},
    {"stage": "Hope & Hold", "count": number, "icon": "🙏", "desc": "text"},
    {"stage": "Averaging Down", "count": number, "icon": "📉", "desc": "text"},
    {"stage": "Panic Exit", "count": number, "icon": "💨", "desc": "text"},
    {"stage": "Revenge Trade", "count": number, "icon": "⚔", "desc": "text"},
    {"stage": "Decision Fatigue", "count": number, "icon": "😵", "desc": "text"}
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
      "tag": "win/fomo/revenge/averaging/panic/against_trend",
      "label": "Disciplined Win / FOMO Entry / etc",
      "quick_summary": "1-2 sentence summary",
      "psychology_coaching": "detailed coaching paragraph (only for first trade in free tier)",
      "technical_analysis": "technical analysis paragraph (only for first trade in free tier)"
    }
  ]
}`
    });

    console.log('Sending to Claude API...');
    console.log('File:', file.name, 'Size:', bytes.byteLength, 'Type:', mediaType);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await response.json() as any;
    console.log('Claude API status:', response.status);

    if (data.error) {
      console.error('Claude API error:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    // Extract text response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '';
    console.log('Raw response length:', text.length);
    console.log('Stop reason:', data.stop_reason);

    // Clean and parse JSON
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    console.error('Analysis error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
