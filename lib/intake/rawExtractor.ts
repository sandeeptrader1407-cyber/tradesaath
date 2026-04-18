/**
 * TradeSaath Raw Extractor
 * Extracts every field from every row, preserving raw values.
 * Column matching uses broad patterns to handle any broker format.
 */

import { RawTradeRow, RawFileData } from './types';
import { detectBrokerFromText } from '@/lib/config/brokers';
import { parseCSVText } from '@/lib/parsers/csvParser';
import { parseExcelBuffer } from '@/lib/parsers/excelParser';
import { parsePDFBuffer } from '@/lib/parsers/pdfParser';
import { detectMarket, detectCurrency, detectDate } from '@/lib/parsers/types';
import * as crypto from 'crypto';

// ── Column pattern matching ──
// Each key maps to an array of regex patterns (tested in order, first match wins)
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  symbol: [
    /^(symbol|scrip|instrument|stock|name|contract|underlying|security.?name|company|trading.?symbol|scripname|instrument_name|scrip.?name|tradingsymbol)$/i,
  ],
  side: [
    /^(side|trade.?type|buy.?sell|action|b.?s|direction|transaction.?type|buysell|buy\/sell)$/i,
  ],
  qty: [
    /^(qty|quantity|lots|volume|traded.?qty|net.?qty|filled|no.?of.?shares)$/i,
  ],
  price: [
    /^(price|rate|avg.?price|trade.?price|executed.?price|avg.?rate|traded.?price|market.?rate|avg_price)$/i,
  ],
  amount: [
    /^(amount|value|net.?amount|turnover|total|net.?total|net.?value)$/i,
  ],
  pnl: [
    /^(pnl|p.?&.?l|profit|loss|net.?pnl|realized|realised|net.?profit|realized.?p.?&.?l)$/i,
  ],
  date: [
    /^(date|trade.?date|order.?date|exec.?date|trade_date)$/i,
  ],
  time: [
    /^(time|trade.?time|exec.?time|order.?time|timestamp|executed.?at|date.?&?.?time|date.?time|order.?execution.?time|exchange_timestamp|order_execution_time)$/i,
  ],
  exchange: [
    /^(exchange|segment|market|exch)$/i,
  ],
  tradeId: [
    /^(trade.?id|order.?id|deal.?id|exec.?id|trade.?no|trade_id|order_id)$/i,
  ],
  expiry: [
    /^(expiry|expiry.?date|exp)$/i,
  ],
  strike: [
    /^(strike|strike.?price)$/i,
  ],
  optionType: [
    /^(option.?type|opt.?type|ce.?pe|call.?put|instrument.?type)$/i,
  ],
  buyQty: [
    /^(buy.?qty|buy.?quantity|buy.?vol)$/i,
  ],
  sellQty: [
    /^(sell.?qty|sell.?quantity|sell.?vol)$/i,
  ],
  buyPrice: [
    /^(buy.?price|buy.?rate|buy.?avg|buy.?value)$/i,
  ],
  sellPrice: [
    /^(sell.?price|sell.?rate|sell.?avg|sell.?value)$/i,
  ],
};

/** Match headers to standard field names */
export function matchColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of headers) {
    const clean = header.trim();
    if (!clean) continue;

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (usedFields.has(field)) continue;
      for (const pattern of patterns) {
        if (pattern.test(clean)) {
          mapping[clean] = field;
          usedFields.add(field);
          break;
        }
      }
      if (mapping[clean]) break;
    }
  }

  return mapping;
}

/** Normalize a date string to YYYY-MM-DD (best effort) */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // Already YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // Excel serial date
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + serial * 86400000);
    return d.toISOString().split('T')[0];
  }

  // Named month: "5 Jan 2024", "January 5, 2024"
  const namedMonth = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{4})/i);
  if (namedMonth) {
    const months: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
    const m = months[namedMonth[2].toLowerCase().slice(0, 3)];
    return `${namedMonth[3]}-${m}-${namedMonth[1].padStart(2, '0')}`;
  }

  return s; // Return as-is if can't parse
}

/** Normalize a time string to HH:MM (best effort) */
export function normalizeTime(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // Extract HH:MM from various formats
  const hhmm = s.match(/(\d{1,2}):(\d{2})/);
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;

  return s;
}

/** Extract date from a datetime string if present */
function extractDateFromTime(timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  const isoDate = timeStr.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const ddmmDate = timeStr.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
  if (ddmmDate) return normalizeDate(ddmmDate[1]);
  return undefined;
}

/** Build a symbol string incorporating strike/option info */
function buildSymbol(base: string, strike?: string, optType?: string): string {
  if (!strike && !optType) return base;

  let opt = '';
  if (optType) {
    const o = optType.toLowerCase();
    if (o.includes('call') || o === 'ce') opt = 'CE';
    else if (o.includes('put') || o === 'pe') opt = 'PE';
    else opt = optType;
  }

  let sym = `${base} ${strike || ''} ${opt}`.replace(/\s+/g, ' ').trim();
  if (/OPTIDX/i.test(sym)) {
    sym = sym.replace(/OPTIDX/i, '').replace(/\s+/g, ' ').trim();
  }
  return sym;
}

/**
 * Extract raw rows from parsed CSV/Excel data.
 * Takes headers + data rows (string[][]) and returns RawTradeRow[].
 */
export function extractRawRows(
  headers: string[],
  dataRows: string[][],
): { rows: RawTradeRow[]; columnMapping: Record<string, string>; warnings: string[] } {
  const columnMapping = matchColumns(headers);
  const warnings: string[] = [];

  // Check for critical missing columns
  const mappedFields = new Set(Object.values(columnMapping));
  if (!mappedFields.has('symbol')) warnings.push('No symbol/instrument column detected');
  if (!mappedFields.has('price') && !mappedFields.has('buyPrice') && !mappedFields.has('sellPrice')) {
    warnings.push('No price column detected');
  }

  // Build reverse mapping: field -> header name
  const fieldToHeader: Record<string, string> = {};
  for (const [header, field] of Object.entries(columnMapping)) {
    fieldToHeader[field] = header;
  }

  const rows: RawTradeRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowWarnings: string[] = [];

    // Build raw record (every column)
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < row.length; j++) {
      raw[headers[j]] = row[j]?.trim() ?? '';
    }

    // Build mapped record
    const getMapped = (field: string): string | undefined => {
      const header = fieldToHeader[field];
      if (!header) return undefined;
      const val = raw[header];
      return val ? val.trim() : undefined;
    };

    const symbol = getMapped('symbol');
    // Skip summary/total rows
    if (!symbol || /^(total|grand|sub|net|sum)/i.test(symbol)) continue;

    const mapped: RawTradeRow['mapped'] = {
      symbol: buildSymbol(symbol, getMapped('strike'), getMapped('optionType')),
      side: getMapped('side'),
      qty: getMapped('qty'),
      price: getMapped('price'),
      amount: getMapped('amount'),
      pnl: getMapped('pnl'),
      date: getMapped('date'),
      time: getMapped('time'),
      exchange: getMapped('exchange'),
      tradeId: getMapped('tradeId'),
      expiry: getMapped('expiry'),
      strike: getMapped('strike'),
      optionType: getMapped('optionType'),
      buyQty: getMapped('buyQty'),
      sellQty: getMapped('sellQty'),
      buyPrice: getMapped('buyPrice'),
      sellPrice: getMapped('sellPrice'),
    };

    // Try to extract date from time field if date is missing
    if (!mapped.date && mapped.time) {
      const dateFromTime = extractDateFromTime(mapped.time);
      if (dateFromTime) mapped.date = dateFromTime;
    }

    // Infer side from buyQty/sellQty if missing
    if (!mapped.side) {
      const bq = parseFloat((mapped.buyQty || '').replace(/,/g, ''));
      const sq = parseFloat((mapped.sellQty || '').replace(/,/g, ''));
      if (!isNaN(bq) && bq > 0) mapped.side = 'BUY';
      else if (!isNaN(sq) && sq > 0) mapped.side = 'SELL';
    }

    // Infer qty from buyQty/sellQty if missing
    if (!mapped.qty) {
      mapped.qty = mapped.buyQty || mapped.sellQty;
    }

    // Infer price from buyPrice/sellPrice if missing
    if (!mapped.price) {
      if (mapped.side === 'BUY' || (!mapped.side && mapped.buyPrice)) {
        mapped.price = mapped.buyPrice;
      } else {
        mapped.price = mapped.sellPrice;
      }
    }

    // Validate critical fields
    if (!mapped.price && !mapped.pnl) {
      rowWarnings.push(`Row ${i}: no price or pnl value`);
    }

    rows.push({
      rowIndex: i,
      raw,
      mapped,
      columnMapping,
      warnings: rowWarnings,
    });
  }

  return { rows, columnMapping, warnings };
}

/**
 * Main entry: extract raw file data from a buffer.
 * Handles CSV, TSV, XLSX, XLS, PDF. Returns RawFileData.
 */
export async function extractRawFile(
  buffer: Buffer,
  filename: string,
): Promise<RawFileData> {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const warnings: string[] = [];

  let rawText = '';
  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (ext === 'csv' || ext === 'tsv') {
    rawText = buffer.toString('utf-8');
    // Parse to get headers and rows
    const lines = rawText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 0) {
      // Use papaparse via csvParser to get structured data
      // But we also need raw headers — get them from the first data line
      const parsed = parseCSVText(rawText);
      if (parsed.length > 0) {
        headers = Object.keys(parsed[0]);
        dataRows = parsed.map(row => headers.map(h => String(row[h] ?? '')));
      }
    }
  } else if (ext === 'xlsx' || ext === 'xls') {
    const result = parseExcelBuffer(buffer);
    rawText = result.text;
    if (result.rows.length > 0) {
      headers = Object.keys(result.rows[0]);
      dataRows = result.rows.map(row => headers.map(h => String(row[h] ?? '')));
    }
  } else if (ext === 'pdf') {
    const result = await parsePDFBuffer(buffer);
    rawText = result.text;
    if (result.rows.length > 0) {
      headers = Object.keys(result.rows[0]);
      dataRows = result.rows.map(row => headers.map(h => String(row[h] ?? '')));
    }
  } else {
    // Try as text
    rawText = buffer.toString('utf-8');
    const parsed = parseCSVText(rawText);
    if (parsed.length > 0) {
      headers = Object.keys(parsed[0]);
      dataRows = parsed.map(row => headers.map(h => String(row[h] ?? '')));
    }
  }

  // Cap raw text at 500KB
  if (rawText.length > 512000) {
    rawText = rawText.slice(0, 512000);
    warnings.push('Raw text truncated to 500KB');
  }

  const { rows, columnMapping, warnings: extractWarnings } = extractRawRows(headers, dataRows);
  warnings.push(...extractWarnings);

  const broker = detectBrokerFromText(rawText);
  const market = detectMarket(rawText);
  const currency = detectCurrency(rawText);
  const tradeDate = detectDate(rawText);

  return {
    filename,
    extension: ext,
    sizeBytes: buffer.length,
    fileHash,
    broker,
    market,
    currency,
    tradeDate,
    headers,
    columnMapping,
    rows,
    rawText,
    warnings,
    extractedAt: new Date().toISOString(),
  };
}
