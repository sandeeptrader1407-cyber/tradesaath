export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { intakeFile, toLegacyTrade, toLegacyKPIs, toLegacyTimeAnalysis, computeFileHash } from '@/lib/intake';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

/* ═══════════════════════════════════════════
   STEP 1: Local Parse Only — NO AI, instant response
   Uses Module 1 raw-first intake pipeline.
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

    console.log('=== PARSE: Module 1 intake pipeline (no AI) ===');
    console.log('File:', file.name, 'Size:', bytes.byteLength);

    // Compute file hash for dedup (passed to /api/analyse later)
    const fileHash = computeFileHash(buffer);

    const result = await intakeFile(buffer, file.name);

    // Convert to legacy format for backward compat with frontend + detectPatterns
    const legacyTrades = result.trades.map(toLegacyTrade);
    const legacyKPIs = toLegacyKPIs(result.kpis);
    const legacyTime = toLegacyTimeAnalysis(result.timeAnalysis);
    const broker = result.rawFile.broker;
    const market = result.rawFile.market;
    const currency = result.rawFile.currency;
    const tradeDate = result.rawFile.tradeDate;

    console.log(`Parse result: success=${result.success}, trades=${result.trades.length}, broker=${broker}, confidence=${result.rawFile.confidence} (${result.rawFile.confidenceScore}/100)`);
    if (result.error) console.log(`Parse note: ${result.error}`);
    if (result.validationWarnings.length > 0) console.log(`Validation warnings: ${result.validationWarnings.join('; ')}`);

    if (!result.success || result.trades.length === 0) {
      return NextResponse.json({
        error: result.error || 'Could not extract trades from this file. Please check the format.',
        code: 'PARSE_FAILED',
      }, { status: 422 });
    }

    return NextResponse.json({
      broker,
      market,
      trade_date: tradeDate,
      currency,
      file_hash: fileHash,
      file_size_bytes: bytes.byteLength,
      total_trades_in_file: result.trades.length,
      trades_shown: result.trades.length,
      kpis: legacyKPIs,
      trades: legacyTrades,
      time_analysis: legacyTime,
      confidence: result.rawFile.confidence,
      confidence_score: result.rawFile.confidenceScore,
      warnings: result.validationWarnings,
      summary: `${result.trades.length} trades extracted from ${broker}. Net P&L: ${legacyKPIs.net_pnl} ${currency}. Win rate: ${legacyKPIs.win_rate}% (${legacyKPIs.wins}W/${legacyKPIs.losses}L). Profit factor: ${legacyKPIs.profit_factor}. Best: ${legacyKPIs.best_trade_pnl}, Worst: ${legacyKPIs.worst_trade_pnl}.`,
      _parsed_locally: true,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Parse failed';
    console.error('Parse error:', msg);
    return NextResponse.json({ error: 'Failed to parse file. Please try again.', code: 'PARSE_ERROR' }, { status: 500 });
  }
}
