/**
 * TradeSaath Local Trade Parser
 * Parses PDF, CSV, TSV, XLS/XLSX files WITHOUT AI
 * Extracts trades, pairs buy/sell, calculates all KPIs
 * Falls back gracefully if parsing fails
 */

import { detectBrokerFromText } from '@/lib/config/brokers';
import { parseCSVText } from './csvParser';
import { parseExcelBuffer } from './excelParser';
import { parsePDFBuffer } from './pdfParser';
import { pairTrades } from './normalizer';
import { calculateKPIs, calculateTimeAnalysis } from './kpiCalculator';
import {
  AnyRow,
  ParseResult,
  detectMarket,
  detectCurrency,
  detectDate,
} from './types';

export type { ParsedTrade, ParsedKPIs, ParseResult } from './types';
export type { IntakeResult, StandardTrade } from '@/lib/intake';

// Re-export the intake pipeline for callers that want the raw-first approach
export { intakeFile } from '@/lib/intake';

/* ═══════════════════════════════════════════
   MAIN EXPORT: parseTradeFile
═══════════════════════════════════════════ */
export async function parseTradeFile(buffer: Buffer, filename: string): Promise<ParseResult> {
  const ext = filename.toLowerCase().split('.').pop() || '';
  let rawText = '';
  let rawTrades: AnyRow[] = [];

  try {
    console.log(`[Parser] Parsing ${filename} (${ext}, ${buffer.length} bytes)`);

    if (ext === 'csv' || ext === 'tsv') {
      const text = buffer.toString('utf-8');
      rawText = text;
      rawTrades = parseCSVText(text);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const { text, rows } = parseExcelBuffer(buffer);
      rawText = text;
      rawTrades = rows;
    } else if (ext === 'pdf') {
      const { text, rows } = await parsePDFBuffer(buffer);
      rawText = text;
      rawTrades = rows;
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return {
        success: false,
        broker: 'Unknown',
        market: 'Unknown',
        trade_date: new Date().toISOString().split('T')[0],
        currency: '',
        total_trades_in_file: 0,
        kpis: calculateKPIs([]),
        trades: [],
        time_analysis: calculateTimeAnalysis([]),
        error: 'Image files require AI for OCR extraction',
      };
    } else {
      const text = buffer.toString('utf-8');
      rawText = text;
      rawTrades = parseCSVText(text);
    }

    console.log(`[Parser] Extracted ${rawTrades.length} raw trade rows`);

    if (rawTrades.length === 0) {
      return {
        success: false,
        broker: detectBrokerFromText(rawText),
        market: detectMarket(rawText),
        trade_date: detectDate(rawText),
        currency: detectCurrency(rawText),
        total_trades_in_file: 0,
        kpis: calculateKPIs([]),
        trades: [],
        time_analysis: calculateTimeAnalysis([]),
        error: `Could not extract structured trades from ${ext.toUpperCase()} file. Will use AI.`,
      };
    }

    const pairedTrades = pairTrades(rawTrades);
    const kpis = calculateKPIs(pairedTrades);
    const timeAnalysis = calculateTimeAnalysis(pairedTrades);

    console.log(`[Parser] ${pairedTrades.length} paired trades, Net P&L: ${kpis.net_pnl}`);

    return {
      success: true,
      broker: detectBrokerFromText(rawText),
      market: detectMarket(rawText),
      trade_date: detectDate(rawText),
      currency: detectCurrency(rawText),
      total_trades_in_file: pairedTrades.length,
      kpis,
      trades: pairedTrades,
      time_analysis: timeAnalysis,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed';
    console.error(`[Parser] Error: ${msg}`);
    return {
      success: false,
      broker: detectBrokerFromText(rawText),
      market: detectMarket(rawText),
      trade_date: detectDate(rawText),
      currency: detectCurrency(rawText),
      total_trades_in_file: 0,
      kpis: calculateKPIs([]),
      trades: [],
      time_analysis: calculateTimeAnalysis([]),
      error: msg,
    };
  }
}
