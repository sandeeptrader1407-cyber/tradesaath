/**
 * TradeSaath Intake Pipeline — Main Entry Point
 * read file -> extract raw -> (optionally save to Supabase) -> pair trades -> validate -> return
 */

import { IntakeResult, RawFileData } from './types';
import { extractRawFile } from './rawExtractor';
import { pairRawTrades } from './tradePairer';
import { validateTrades } from './tradeValidator';
import { calculateIntakeKPIs, calculateIntakeTimeAnalysis } from './kpiCalculator';
import { saveRawData } from './saveRawData';
import { tryAIExtract } from '@/lib/parsers/ai/orchestrator';
import { aiFirstParser } from '@/lib/config/flags';

export interface IntakeOptions {
  /** If true, save raw data to Supabase (requires userId) */
  saveRaw?: boolean;
  /** User ID for Supabase storage */
  userId?: string;
  /** Session ID to link raw file to */
  sessionId?: string;
}

function emptyRawFile(filename: string, ext: string, sizeBytes: number, error: string): RawFileData {
  return {
    filename, extension: ext, sizeBytes,
    fileHash: '', broker: 'Unknown', market: 'Unknown', currency: '',
    tradeDate: new Date().toISOString().split('T')[0],
    headers: [], columnMapping: {}, rows: [], rawText: '',
    warnings: [error],
    extractedAt: new Date().toISOString(),
    confidence: 'low',
    confidenceScore: 0,
  };
}

/**
 * Parse a trade file through the raw-first intake pipeline.
 * Always returns IntakeResult — never throws.
 */
export async function intakeFile(
  buffer: Buffer,
  filename: string,
  options: IntakeOptions = {},
): Promise<IntakeResult> {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // Shape detection delegated to AI parser. No pre-flight rejection
  // based on filename or title — AI examines actual row Status.

  // Images need AI/OCR — early exit
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return {
      success: false,
      rawFile: emptyRawFile(filename, ext, buffer.length, 'Image files require AI for OCR extraction'),
      trades: [],
      kpis: calculateIntakeKPIs([]),
      timeAnalysis: calculateIntakeTimeAnalysis([]),
      validationWarnings: [],
      error: 'Image files require AI for OCR extraction',
    };
  }

  try {
    console.log(`[Intake] Processing ${filename} (${ext}, ${buffer.length} bytes)`);

    // Step 1: Extract raw data
    // AI-first path when flag enabled. Falls through to legacy extractor on AI failure.
    let rawFile;
    let parserMetadata: IntakeResult['parserMetadata'] = undefined;
    if (aiFirstParser) {
      const aiResult = await tryAIExtract(buffer, filename);
      if (aiResult) {
        rawFile = aiResult.data;
        parserMetadata = {
          parserUsed: aiResult.parserUsed,
          modelName: aiResult.modelName,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
        };
        console.log(`[Intake] AI extraction via ${aiResult.parserUsed} (${aiResult.modelName}), cost: $${aiResult.costUsd.toFixed(6)}, ${aiResult.durationMs}ms`);
      } else {
        console.log(`[Intake] AI extraction returned null, falling through to legacy`);
        rawFile = await extractRawFile(buffer, filename);
      }
    } else {
      rawFile = await extractRawFile(buffer, filename);
    }
    console.log(`[Intake] Extracted ${rawFile.rows.length} raw rows, broker: ${rawFile.broker}, confidence: ${rawFile.confidence} (${rawFile.confidenceScore}/100)`);

    // Step 2: Optionally save raw data to Supabase
    // PR 2d (audit Finding E): pass the file buffer through so saveRawData
    // can archive to Storage on the same row that gets the metadata.
    if (options.saveRaw && options.userId) {
      const saveResult = await saveRawData(rawFile, options.userId, options.sessionId, buffer);
      if ('error' in saveResult) {
        rawFile.warnings.push(`Failed to save raw data: ${saveResult.error}`);
      }
    }

    // Step 3: Check if we got any data
    if (rawFile.rows.length === 0) {
      return {
        success: false,
        rawFile,
        trades: [],
        kpis: calculateIntakeKPIs([]),
        timeAnalysis: calculateIntakeTimeAnalysis([]),
        validationWarnings: [],
        error: `Could not extract structured trades from ${ext.toUpperCase()} file.`,
      };
    }

    // Step 3.5: Validate that required columns were detected.
    // PDF column extraction can produce broken headers (e.g.,
    // ["Symbol Date", "", "& Time", "", ...]) where only some
    // canonical fields get mapped. Pairing on a missing-symbol or
    // missing-date file produces garbage trades. Reject early with
    // a clear error.
    const mappedFields = new Set(Object.values(rawFile.columnMapping));
    const requiredFields = ['symbol', 'date', 'side', 'qty'] as const;
    const missingRequired = requiredFields.filter(f => !mappedFields.has(f));
    const hasPriceOrPnl = mappedFields.has('price') || mappedFields.has('pnl');
    if (missingRequired.length > 0 || !hasPriceOrPnl) {
      const missing = [
        ...missingRequired,
        ...(!hasPriceOrPnl ? ['price or pnl'] : []),
      ];
      const message = `Could not detect required columns: ${missing.join(', ')}. The file format may be unsupported, or the PDF columns extracted incorrectly.`;
      console.warn(`[Intake] INSUFFICIENT_HEADERS: ${message} (mapped: ${Array.from(mappedFields).join(', ') || 'none'})`);
      return {
        success: false,
        rawFile,
        trades: [],
        kpis: calculateIntakeKPIs([]),
        timeAnalysis: calculateIntakeTimeAnalysis([]),
        validationWarnings: [],
        error: message,
        errorCode: 'INSUFFICIENT_HEADERS',
      };
    }

    // Step 4: Pair trades
    const trades = pairRawTrades(rawFile.rows, rawFile.market);
    console.log(`[Intake] ${trades.length} paired trades`);

    // Step 5: Validate
    const validation = validateTrades(trades);

    // Step 6: Calculate KPIs
    const kpis = calculateIntakeKPIs(trades);
    const timeAnalysis = calculateIntakeTimeAnalysis(trades);

    console.log(`[Intake] Net P&L: ${kpis.netPnl}, Warnings: ${validation.warnings.length}`);

    // If validation surfaced a critical issue (orderbook detected,
    // 50%+ trades missing time data) — fail the intake. Caller must
    // surface a specific user-facing error rather than persisting a
    // misleading zero-P&L session.
    if (validation.criticalError) {
      console.warn(`[Intake] Critical validation failure: ${validation.criticalError.code} — ${validation.criticalError.message}`);
      return {
        success: false,
        rawFile,
        trades,
        kpis,
        timeAnalysis,
        validationWarnings: validation.warnings,
        error: validation.criticalError.message,
        errorCode: validation.criticalError.code,
      };
    }

    return {
      success: true,
      rawFile,
      trades,
      kpis,
      timeAnalysis,
      validationWarnings: validation.warnings,
      parserMetadata,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Intake failed';
    console.error(`[Intake] Error: ${msg}`);
    return {
      success: false,
      rawFile: emptyRawFile(filename, ext, buffer.length, msg),
      trades: [],
      kpis: calculateIntakeKPIs([]),
      timeAnalysis: calculateIntakeTimeAnalysis([]),
      validationWarnings: [],
      error: msg,
    };
  }
}
