/**
 * TradeSaath Intake Pipeline — Main Entry Point
 * read file -> extract raw -> (optionally save to Supabase) -> pair trades -> validate -> return
 */

import { IntakeResult } from './types';
import { extractRawFile } from './rawExtractor';
import { pairRawTrades } from './tradePairer';
import { validateTrades } from './tradeValidator';
import { calculateIntakeKPIs, calculateIntakeTimeAnalysis } from './kpiCalculator';
import { saveRawData } from './saveRawData';

export interface IntakeOptions {
  /** If true, save raw data to Supabase (requires userId) */
  saveRaw?: boolean;
  /** User ID for Supabase storage */
  userId?: string;
  /** Session ID to link raw file to */
  sessionId?: string;
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

  // Images need AI/OCR — early exit
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    const emptyRaw = {
      filename, extension: ext, sizeBytes: buffer.length,
      fileHash: '', broker: 'Unknown', market: 'Unknown', currency: '',
      tradeDate: new Date().toISOString().split('T')[0],
      headers: [], columnMapping: {}, rows: [], rawText: '',
      warnings: ['Image files require AI for OCR extraction'],
      extractedAt: new Date().toISOString(),
    };
    return {
      success: false,
      rawFile: emptyRaw,
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
    const rawFile = await extractRawFile(buffer, filename);
    console.log(`[Intake] Extracted ${rawFile.rows.length} raw rows, broker: ${rawFile.broker}`);

    // Step 2: Optionally save raw data to Supabase
    if (options.saveRaw && options.userId) {
      const saveResult = await saveRawData(rawFile, options.userId, options.sessionId);
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

    // Step 4: Pair trades
    const trades = pairRawTrades(rawFile.rows);
    console.log(`[Intake] ${trades.length} paired trades`);

    // Step 5: Validate
    const validation = validateTrades(trades);

    // Step 6: Calculate KPIs
    const kpis = calculateIntakeKPIs(trades);
    const timeAnalysis = calculateIntakeTimeAnalysis(trades);

    console.log(`[Intake] Net P&L: ${kpis.netPnl}, Warnings: ${validation.warnings.length}`);

    return {
      success: true,
      rawFile,
      trades,
      kpis,
      timeAnalysis,
      validationWarnings: validation.warnings,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Intake failed';
    console.error(`[Intake] Error: ${msg}`);
    return {
      success: false,
      rawFile: {
        filename, extension: ext, sizeBytes: buffer.length,
        fileHash: '', broker: 'Unknown', market: 'Unknown', currency: '',
        tradeDate: new Date().toISOString().split('T')[0],
        headers: [], columnMapping: {}, rows: [], rawText: '',
        warnings: [msg], extractedAt: new Date().toISOString(),
      },
      trades: [],
      kpis: calculateIntakeKPIs([]),
      timeAnalysis: calculateIntakeTimeAnalysis([]),
      validationWarnings: [],
      error: msg,
    };
  }
}
