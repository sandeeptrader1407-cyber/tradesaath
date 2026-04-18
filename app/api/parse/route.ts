export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { parseTradeFile } from '@/lib/trade-parser';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

/* ═══════════════════════════════════════════
   STEP 1: Local Parse Only — NO AI, instant response
   Returns parsed trades, KPIs, time analysis.
   User sees preview, then clicks "Analyze" for AI.
═══════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  // Rate limit: 20 per IP per 15 min (local parse, cheaper)
  const ip = getClientIp(req);
  const rl = rateLimit(`parse:${ip}`, 20, 15 * 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetIn);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('=== PARSE: Local parsing (no AI) ===');
    console.log('File:', file.name, 'Size:', bytes.byteLength);

    const parsed = await parseTradeFile(buffer, file.name);

    console.log(`Parse result: success=${parsed.success}, trades=${parsed.trades.length}, broker=${parsed.broker}`);
    if (parsed.error) console.log(`Parse note: ${parsed.error}`);

    if (!parsed.success || parsed.trades.length === 0) {
      return NextResponse.json({
        error: parsed.error || 'Could not extract trades from this file. Please check the format.',
        code: 'PARSE_FAILED',
      }, { status: 422 });
    }

    return NextResponse.json({
      broker: parsed.broker,
      market: parsed.market,
      trade_date: parsed.trade_date,
      currency: parsed.currency,
      total_trades_in_file: parsed.total_trades_in_file,
      trades_shown: parsed.trades.length,
      kpis: parsed.kpis,
      trades: parsed.trades,
      time_analysis: parsed.time_analysis,
      summary: `${parsed.trades.length} trades extracted from ${parsed.broker}. Net P&L: ${parsed.kpis.net_pnl} ${parsed.currency}. Win rate: ${parsed.kpis.win_rate}% (${parsed.kpis.wins}W/${parsed.kpis.losses}L). Profit factor: ${parsed.kpis.profit_factor}. Best: ${parsed.kpis.best_trade_pnl}, Worst: ${parsed.kpis.worst_trade_pnl}.`,
      _parsed_locally: true,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Parse failed';
    console.error('Parse error:', msg);
    return NextResponse.json({ error: 'Failed to parse file. Please try again.', code: 'PARSE_ERROR' }, { status: 500 });
  }
}
