export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { intakeFile, toLegacyTrade, toLegacyKPIs, toLegacyTimeAnalysis, computeFileHash, saveRawData } from '@/lib/intake';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE_MESSAGE } from '@/lib/config/uploadLimits';

/* ═══════════════════════════════════════════
   STEP 1: Local Parse Only — NO AI, instant response
   Uses Module 1 raw-first intake pipeline.
   Returns parsed trades, KPIs, time analysis.
   User sees preview, then clicks "Analyze" for AI.
═══════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  // Rate limit: 20 per IP per 15 min (local parse, cheaper)
  const ip = getClientIp(req);
  const rl = await rateLimit(`parse:${ip}`, 20, 15 * 60 * 1000);
  if (!rl.success) return rateLimitResponse(rl.resetIn);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // PR 2d (audit Finding E): central MAX_UPLOAD_BYTES + 413 status
    // (was inline `10 * 1024 * 1024` literal returning 400).
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: UPLOAD_TOO_LARGE_MESSAGE }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('=== PARSE: Module 1 intake pipeline (no AI) ===');
    console.log('File:', file.name, 'Size:', bytes.byteLength);

    // Compute file hash for dedup (passed to /api/analyse later)
    const fileHash = computeFileHash(buffer);

    // Note: /parse persists to raw_files but NOT to trade_sessions (that
    // happens in /api/analyse). result.parserMetadata is therefore not
    // forwarded from here. If we ever want parser_* columns to survive the
    // /parse → /analyse JSON hop, thread parserMetadata through the response
    // body and into /api/analyse's handleJSON.
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
      // Hard-reject specific upload shapes (missing-time export,
      // missing-symbol-or-date) with a stable code + actionable hint,
      // rather than the generic PARSE_FAILED. The client uses the code
      // to render a targeted error banner instead of falling through to
      // AI extract. Orderbook-shape detection is now handled by the AI
      // parser via row-level Status filtering (no hard reject).
      if (result.errorCode === 'MISSING_SYMBOL_OR_DATE') {
        return NextResponse.json({
          error: 'MISSING_SYMBOL_OR_DATE',
          code: 'MISSING_SYMBOL_OR_DATE',
          message: 'We could not read the symbol name or trade date from your file. The broker export may be missing required columns.',
          hint: 'In FYERS: download "Trade Book" not "Order Book". In Zerodha: download "Tradebook" CSV from Console → Reports. The file must have columns for trading symbol (e.g. NIFTY24MAR22000CE) and trade date.',
          warnings: result.rawFile?.warnings ?? [],
        }, { status: 422 });
      }
      if (result.errorCode === 'MISSING_TIME_DATA') {
        return NextResponse.json({
          error: 'MISSING_TIME_DATA',
          code: 'MISSING_TIME_DATA',
          message: 'Your file is missing time data for most trades. Please ensure you exported the full Trade Book with timestamps.',
          hint: 'Daily P&L summaries do not include execution times. Re-export the full executed-trades report from your broker — it must include entry/exit timestamps per trade.',
          warnings: result.rawFile?.warnings ?? [],
        }, { status: 422 });
      }
      return NextResponse.json({
        error: result.error || 'Could not extract trades from this file. Please check the format.',
        code: 'PARSE_FAILED',
        warnings: result.rawFile?.warnings ?? [],
      }, { status: 422 });
    }

    // Persist the raw file for authenticated users. This is the ONLY place in the
    // upload flow that has the original file bytes + parsed rows together — analyse
    // receives only trades[] via JSON and cannot rebuild the raw.
    let rawFileId: string | undefined;
    try {
      const { userId } = await auth();
      if (userId) {
        // Cap rows to prevent JSONB bloat on huge multi-day statements
        const MAX_RAW_ROWS = 5000;
        const trimmed = result.rawFile.rows.length > MAX_RAW_ROWS
          ? {
              ...result.rawFile,
              rows: result.rawFile.rows.slice(0, MAX_RAW_ROWS),
              warnings: [
                ...(result.rawFile.warnings || []),
                `raw_data truncated from ${result.rawFile.rows.length} to ${MAX_RAW_ROWS} rows for storage`,
              ],
            }
          : result.rawFile;
        // PR 2d (audit Finding E): pass buffer as 4th arg so saveRawData
        // archives to Supabase Storage and writes storage_path on the
        // same row. sessionId stays undefined — /parse is the preview
        // step; session linking happens later in /analyse.
        const saved = await saveRawData(trimmed, userId, undefined, buffer);
        if ('id' in saved) {
          rawFileId = saved.id;
          console.log(`[Parse] raw_files row saved: ${rawFileId} (${trimmed.rows.length} rows, user=${userId}, storagePath=${saved.storagePath ?? 'null'})`);
        } else {
          console.error(`[Parse] raw_files save FAILED: ${saved.error} | file=${file.name} rows=${result.rawFile.rows.length} user=${userId}`);
        }
      } else {
        console.log('[Parse] anonymous upload — skipping raw_files persistence');
      }
    } catch (rawErr) {
      console.error('[Parse] raw_files save THREW:', rawErr);
    }

    return NextResponse.json({
      broker,
      market,
      trade_date: tradeDate,
      currency,
      file_hash: fileHash,
      file_size_bytes: bytes.byteLength,
      raw_file_id: rawFileId,
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
