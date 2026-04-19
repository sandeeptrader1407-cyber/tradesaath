/**
 * TradeSaath Universal Raw Extractor
 * Works with ANY broker globally via:
 * 1. Expanded pattern dictionary (200+ column name variants)
 * 2. 3-tier matching: exact → contains → fuzzy
 * 3. Content-based detection fallback for headerless/unknown files
 * 4. Confidence scoring
 * 5. File quirk handling (currency symbols, European numbers, etc.)
 */

import { RawTradeRow, RawFileData, ConfidenceLevel } from './types';
import { detectBrokerFromText } from '@/lib/config/brokers';
// Papa.parse used directly in extractRawFile to preserve original CSV headers
import { parseExcelBuffer } from '@/lib/parsers/excelParser';
import { parsePDFBuffer } from '@/lib/parsers/pdfParser';
import { extractPdfWithCoordinates } from './pdfTableExtractor';
import { parseContractNote } from './contractNoteDetector';
import { extractPdfWithOcr, parseOcrTradeRows } from './pdfOcrExtractor';
import { detectMarket, detectCurrency, detectDate } from '@/lib/parsers/types';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════
// STEP 1: EXPANDED COLUMN PATTERN DICTIONARY
// ═══════════════════════════════════════════
// Each field has an array of possible column names across all major brokers globally.
// Patterns are plain strings — matching is done by the smart matcher below.

const COLUMN_PATTERNS: Record<string, string[]> = {
  symbol: [
    // Indian brokers
    'tradingsymbol', 'trading_symbol', 'symbol', 'scrip', 'scripname', 'scrip_name',
    'scrip_code', 'instrument', 'instrument_name', 'instrument_key',
    // US/UK brokers
    'ticker', 'ticker_symbol', 'stock', 'stock_symbol', 'security',
    'security_name', 'underlying', 'contract', 'asset', 'description',
    // Crypto
    'pair', 'trading_pair', 'coin', 'base_asset', 'asset_pair', 'base_currency',
    // Forex
    'currency_pair', 'pair_name', 'forex_pair',
    // Generic
    'name', 'product', 'product_name', 'instrument_code', 'isin',
    'cusip', 'sedol', 'company', 'company_name',
  ],

  side: [
    // Standard
    'side', 'trade_type', 'tradetype', 'buy_sell', 'buysell', 'b_s',
    'action', 'direction', 'transaction_type', 'order_type',
    // Explicit
    'buy/sell', 'b/s', 'buy_or_sell', 'trade_direction', 'position',
    // Crypto/Forex
    'order_side', 'buy_sell_ind', 'side_indicator', 'order_action',
    'execution_side', 'type',
  ],

  qty: [
    // Standard
    'quantity', 'qty', 'traded_qty', 'filled_qty', 'net_qty',
    'shares', 'num_shares', 'number_of_shares',
    'lot', 'lots', 'volume', 'size', 'trade_qty', 'filled',
    // US
    'shares_quantity', 'contracts', 'units', 'trade_size',
    // Crypto
    'base_amount', 'coin_amount', 'crypto_amount', 'executed_qty',
    // Forex
    'lot_size', 'position_size', 'trade_volume',
    // Generic
    'count', 'no_of_shares',
  ],

  price: [
    // Standard
    'price', 'trade_price', 'avg_price', 'average_price', 'rate',
    'execution_price', 'fill_price', 'traded_price', 'avg_trade_price',
    'market_rate', 'avg_rate',
    // US
    'price_per_share', 'fill_avg_price', 'executed_price', 'exec_price',
    // Crypto
    'unit_price', 'price_per_unit', 'base_price', 'quote_price',
    // Forex
    'open_price', 'close_price',
    // Alternative
    'cost_basis_per_share', 'proceeds_per_share', 'net_rate',
  ],

  amount: [
    'amount', 'value', 'net_amount', 'turnover', 'total', 'net_total',
    'net_value', 'trade_value', 'gross_amount', 'consideration',
    'notional', 'notional_value', 'total_value',
  ],

  pnl: [
    // Standard
    'pnl', 'p&l', 'profit_loss', 'profit/loss', 'realized_pnl',
    'realised_pnl', 'net_pnl', 'profit', 'pl', 'gain_loss',
    'realized_p&l', 'realised_p&l',
    // US
    'realized_gain_loss', 'net_proceeds', 'unrealized_p&l',
    'total_pnl', 'gain/loss', 'realized_gain',
    // Crypto
    'realized_profit', 'pnl_usd', 'pnl_inr', 'profit_usd',
    // Forex
    'net_profit', 'gross_profit', 'swap',
    // Alternative
    'return', 'total_return', 'gain', 'loss',
  ],

  date: [
    // Standard
    'trade_date', 'tradedate', 'date', 'execution_date', 'fill_date',
    'settlement_date', 'order_date', 'trade_day', 'transaction_date',
    // US
    'date_of_trade', 'buy_date', 'sell_date', 'opened', 'closed',
    // Crypto
    'date_utc', 'created_date',
    // Generic
    'day', 'trading_day', 'report_date', 'exec_date',
  ],

  time: [
    // Standard
    'order_execution_time', 'execution_time', 'time', 'trade_time',
    'fill_time', 'timestamp', 'order_time', 'datetime', 'time_utc',
    'date_time', 'date&time',
    // US
    'time_of_trade', 'execution_timestamp', 'fill_timestamp',
    // Crypto
    'trade_timestamp', 'created_at',
    // Alternative
    'opened_at', 'closed_at', 'executed_at', 'exchange_timestamp',
  ],

  exchange: [
    'exchange', 'exch', 'exchange_code', 'mkt', 'venue',
    'trading_venue', 'listing_exchange', 'exchange_name',
  ],

  segment: [
    'segment', 'series', 'product_type', 'instrument_type',
    'asset_class', 'market_segment', 'category', 'section',
  ],

  tradeId: [
    'trade_id', 'tradeid', 'trade_no', 'trade_number', 'execution_id',
    'fill_id', 'transaction_id', 'ref_id', 'reference_id', 'trade_ref',
    'execution_reference', 'deal_id', 'fill_number', 'txn_id',
  ],

  orderId: [
    'order_id', 'orderid', 'order_no', 'order_number', 'order_ref',
    'order_reference', 'parent_order_id',
  ],

  fees: [
    'brokerage', 'commission', 'fee', 'fees', 'transaction_cost',
    'total_fees', 'charges', 'stt', 'tax', 'gst', 'exchange_charges',
    'total_charges', 'transaction_charges', 'stamp_duty', 'sebi_charges',
    'clearing_charges', 'regulatory_fee',
  ],

  expiry: [
    'expiry', 'expiry_date', 'exp', 'expiration', 'expiration_date',
    'exp_date', 'contract_expiry',
  ],

  strike: [
    'strike', 'strike_price', 'exercise_price',
  ],

  optionType: [
    'option_type', 'opt_type', 'ce_pe', 'call_put',
    'put_call', 'contract_type', 'right',
  ],

  buyQty: [
    'buy_qty', 'buy_quantity', 'buy_vol', 'buy_volume',
    'bought_qty', 'purchase_qty',
  ],

  sellQty: [
    'sell_qty', 'sell_quantity', 'sell_vol', 'sell_volume',
    'sold_qty', 'sale_qty',
  ],

  buyPrice: [
    'buy_price', 'buy_rate', 'buy_avg', 'buy_value',
    'purchase_price', 'buy_average', 'bought_price',
  ],

  sellPrice: [
    'sell_price', 'sell_rate', 'sell_avg', 'sell_value',
    'sale_price', 'sell_average', 'sold_price',
  ],

  entryPrice: [
    'entry_price', 'entry', 'open_price', 'entry_rate',
    'buy_entry_price', 'opening_price', 'entry_value',
  ],

  exitPrice: [
    'exit_price', 'exit', 'close_price', 'exit_rate',
    'sell_exit_price', 'closing_price', 'exit_value',
  ],
};

// ═══════════════════════════════════════════
// STEP 2: SMART COLUMN MATCHING
// ═══════════════════════════════════════════

/** Normalize a string for comparison: lowercase, strip separators */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-\/\.&]+/g, '').trim();
}

/**
 * 3-tier column matching: exact → contains → fuzzy.
 * Returns mapping of header → field name.
 */
export function matchColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();
  const usedHeaders = new Set<number>();
  const normalizedHeaders = headers.map(h => normalize(h.trim()));

  // Priority order: most important fields first to avoid ambiguity
  const fieldPriority = [
    'symbol', 'side', 'buyQty', 'sellQty', 'buyPrice', 'sellPrice',
    'entryPrice', 'exitPrice',
    'qty', 'price', 'date', 'time', 'pnl',
    'exchange', 'tradeId', 'fees', 'amount', 'segment', 'orderId',
    'expiry', 'strike', 'optionType',
  ];

  for (const field of fieldPriority) {
    if (usedFields.has(field)) continue;
    const patterns = COLUMN_PATTERNS[field];
    if (!patterns) continue;
    const normalizedPatterns = patterns.map(normalize);

    // Tier 1: EXACT match
    let matched = false;
    for (const np of normalizedPatterns) {
      const idx = normalizedHeaders.findIndex((h, i) => !usedHeaders.has(i) && h === np);
      if (idx >= 0) {
        mapping[headers[idx].trim()] = field;
        usedFields.add(field);
        usedHeaders.add(idx);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 2: CONTAINS match (header contains pattern)
    for (const np of normalizedPatterns) {
      if (np.length < 3) continue; // skip very short patterns for contains
      const idx = normalizedHeaders.findIndex((h, i) => !usedHeaders.has(i) && h.includes(np));
      if (idx >= 0) {
        mapping[headers[idx].trim()] = field;
        usedFields.add(field);
        usedHeaders.add(idx);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Tier 3: FUZZY match (pattern contains header, header must be >= 3 chars and >= 60% of pattern length)
    for (const np of normalizedPatterns) {
      const idx = normalizedHeaders.findIndex((h, i) =>
        !usedHeaders.has(i) && h.length >= 3 && np.includes(h) && h.length >= np.length * 0.8
      );
      if (idx >= 0) {
        mapping[headers[idx].trim()] = field;
        usedFields.add(field);
        usedHeaders.add(idx);
        matched = true;
        break;
      }
    }
  }

  return mapping;
}

// ═══════════════════════════════════════════
// STEP 3: CONTENT-BASED DETECTION FALLBACK
// ═══════════════════════════════════════════

/** Detect column type by analyzing actual data content */
function detectColumnByContent(dataRows: string[][], colIdx: number): string | null {
  const samples = dataRows.slice(0, 15).map(r => (r[colIdx] || '').trim()).filter(Boolean);
  if (samples.length < 2) return null;

  // Is it BUY/SELL? Check first — very distinctive
  const sideValues = ['buy', 'sell', 'long', 'short', 'b', 's'];
  if (samples.every(s => sideValues.includes(s.toLowerCase()))) return 'side';

  // Is it a date?
  const dateRegex = /^(\d{1,4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i;
  if (samples.filter(s => dateRegex.test(s)).length >= samples.length * 0.8) return 'date';

  // Is it a time? (HH:MM or HH:MM:SS, not a date)
  const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;
  if (samples.every(s => timeRegex.test(s))) return 'time';

  // Is it a symbol/ticker? (uppercase, 2-20 chars, letters/numbers/dots/hyphens)
  const symbolRegex = /^[A-Z][A-Z0-9\.\-\s]{1,30}$/;
  if (samples.filter(s => symbolRegex.test(s)).length >= samples.length * 0.7) return 'symbol';

  // Numeric columns — determine price vs qty by value range
  const cleanedNums = samples.map(s => parseFloat(cleanNumeric(s))).filter(n => !isNaN(n));
  if (cleanedNums.length >= samples.length * 0.8) {
    const avg = cleanedNums.reduce((a, b) => a + b, 0) / cleanedNums.length;
    const allInt = cleanedNums.every(n => Number.isInteger(n));
    // Quantities: usually integers, smaller values
    if (allInt && avg > 0 && avg < 50000) return 'qty';
    // Prices: usually decimals, larger range
    if (avg > 0.01 && avg < 10000000) return 'price';
  }

  return null;
}

/**
 * Apply content-based detection to fill gaps in header matching.
 * Only used when critical fields (symbol, qty, price) are missing.
 */
function applyContentDetection(
  headers: string[],
  dataRows: string[][],
  existingMapping: Record<string, string>,
): Record<string, string> {
  const mapping = { ...existingMapping };
  const mappedFields = new Set(Object.values(mapping));
  const mappedHeaderIndices = new Set(
    Object.keys(mapping).map(h => headers.indexOf(h)).filter(i => i >= 0)
  );

  // Only try content detection for missing critical fields
  const criticalMissing = ['symbol', 'side', 'qty', 'price', 'date'].filter(f => !mappedFields.has(f));
  if (criticalMissing.length === 0) return mapping;

  for (let i = 0; i < headers.length; i++) {
    if (mappedHeaderIndices.has(i)) continue;
    const detected = detectColumnByContent(dataRows, i);
    if (detected && criticalMissing.includes(detected) && !mappedFields.has(detected)) {
      mapping[headers[i]] = detected;
      mappedFields.add(detected);
      mappedHeaderIndices.add(i);
    }
  }

  return mapping;
}

// ═══════════════════════════════════════════
// STEP 4: FILE QUIRK HANDLERS
// ═══════════════════════════════════════════

/** Strip currency symbols from a string */
function stripCurrency(s: string): string {
  return s.replace(/[$\u20B9\u00A3\u20AC\u00A5\uFFE5]/g, '').trim();
}

/** Clean numeric value: handle currency, commas, parens, European format */
export function cleanNumeric(val: string): string {
  if (!val) return '';
  let s = stripCurrency(val.trim());

  // Accounting negatives: (500) → -500
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.slice(1, -1);
  }

  // Detect European vs US number format
  // European: 1.234.567,89 (dots for thousands, comma for decimal)
  // US/Indian: 1,234,567.89 (commas for thousands, dot for decimal)
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastComma > lastDot && lastComma === s.length - 3) {
    // Likely European: "1.234,56" → "1234.56"
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // US/Indian: just strip commas
    s = s.replace(/,/g, '');
  }

  // Remove any remaining non-numeric chars except minus and dot
  s = s.replace(/[^0-9.\-]/g, '');

  return s;
}

/** Normalize a date string to YYYY-MM-DD (best effort, supports 10+ formats) */
export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // Unix timestamp (seconds or milliseconds)
  const unixNum = parseFloat(s);
  if (!isNaN(unixNum) && /^\d{10,13}$/.test(s)) {
    const ms = s.length === 10 ? unixNum * 1000 : unixNum;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // ISO 8601: 2024-03-01T09:16:32Z or 2024-03-01 09:16:32
  const isoFull = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s]/);
  if (isoFull) return `${isoFull[1]}-${isoFull[2].padStart(2, '0')}-${isoFull[3].padStart(2, '0')}`;

  // Already YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // MM-DD-YYYY (US) — ambiguous, assume if month <= 12 and day > 12
  const mdy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mdy) {
    const m = parseInt(mdy[1]), d = parseInt(mdy[2]);
    if (m <= 12 && d > 12) {
      return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
    }
    // Default to DD-MM-YYYY (more common globally)
    return `${mdy[3]}-${mdy[2].padStart(2, '0')}-${mdy[1].padStart(2, '0')}`;
  }

  // Excel serial date
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + serial * 86400000);
    return d.toISOString().split('T')[0];
  }

  // Named month: "5 Jan 2024", "15 December 2023"
  const dMonthY = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{4})/i);
  if (dMonthY) {
    const months: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
    const m = months[dMonthY[2].toLowerCase().slice(0, 3)];
    if (m) return `${dMonthY[3]}-${m}-${dMonthY[1].padStart(2, '0')}`;
  }

  // "Jan 5, 2024" or "January 5 2024"
  const monthDY = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{1,2})[\s,]+(\d{4})/i);
  if (monthDY) {
    const months: Record<string, string> = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
    const m = months[monthDY[1].toLowerCase().slice(0, 3)];
    if (m) return `${monthDY[3]}-${m}-${monthDY[2].padStart(2, '0')}`;
  }

  // YYYYMMDD (compact)
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  return s; // Return as-is if can't parse
}

/** Normalize a time string to HH:MM (best effort) */
export function normalizeTime(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // HH:MM:SS or HH:MM
  const hhmm = s.match(/(\d{1,2}):(\d{2})/);
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;

  // Unix timestamp — extract time
  const unixNum = parseFloat(s);
  if (!isNaN(unixNum) && /^\d{10,13}$/.test(s)) {
    const ms = s.length === 10 ? unixNum * 1000 : unixNum;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
    }
  }

  return s;
}

/** Extract date from a datetime string if present */
function extractDateFromTime(timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  const isoDate = timeStr.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const ddmmDate = timeStr.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
  if (ddmmDate) return normalizeDate(ddmmDate[1]);
  // Unix timestamp
  const unixNum = parseFloat(timeStr);
  if (!isNaN(unixNum) && /^\d{10,13}$/.test(timeStr.trim())) {
    const ms = timeStr.trim().length === 10 ? unixNum * 1000 : unixNum;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
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

// ═══════════════════════════════════════════
// STEP 5: CONFIDENCE SCORING
// ═══════════════════════════════════════════

/** Compute confidence level and score for a column mapping */
export function computeConfidence(
  mapping: Record<string, string>,
  rowCount: number,
  brokerDetected: boolean,
): { level: ConfidenceLevel; score: number } {
  let score = 0;
  const fields = new Set(Object.values(mapping));

  // Required fields (20 pts each)
  if (fields.has('symbol')) score += 20;
  if (fields.has('side') || fields.has('buyQty') || fields.has('sellQty')) score += 20;
  if (fields.has('qty') || fields.has('buyQty') || fields.has('sellQty')) score += 20;
  if (fields.has('price') || fields.has('buyPrice') || fields.has('sellPrice') || fields.has('entryPrice')) score += 20;

  // Important fields (10 pts)
  if (fields.has('date') || fields.has('time')) score += 10;

  // Optional but valuable
  if (fields.has('time')) score += 3;
  if (fields.has('pnl')) score += 3;
  if (fields.has('exchange')) score += 2;
  if (fields.has('tradeId')) score += 2;
  if (fields.has('fees')) score += 2;

  // Data volume bonus
  if (rowCount >= 10) score += 3;
  if (rowCount >= 50) score += 2;

  // Broker recognition bonus
  if (brokerDetected) score += 5;

  // Cap at 100
  score = Math.min(score, 100);

  const level: ConfidenceLevel = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';

  return { level, score };
}

// ═══════════════════════════════════════════
// STEP 6: HEADER ROW DETECTION
// ═══════════════════════════════════════════

/**
 * Detect the real header row in cases where brokers put
 * account info, totals, or metadata in the first N rows.
 * Returns the index of the header row, or 0 if first row is headers.
 */
export function detectHeaderRow(lines: string[][]): number {
  // Try each of the first 20 rows as a potential header
  const maxCheck = Math.min(lines.length, 20);

  let bestIdx = 0;
  let bestScore = 0;

  for (let i = 0; i < maxCheck; i++) {
    const row = lines[i];
    if (!row || row.length < 3) continue;

    // Score this row as a header candidate
    let score = 0;
    const allPatterns = Object.values(COLUMN_PATTERNS).flat();
    const normalizedPatterns = allPatterns.map(normalize);

    for (const cell of row) {
      const nc = normalize(cell.trim());
      if (!nc) continue;
      // Check if this cell matches any known column pattern
      if (normalizedPatterns.some(p => nc === p || nc.includes(p) || (p.length >= 3 && p.includes(nc)))) {
        score++;
      }
    }

    // Need at least 3 matches to be a header
    if (score > bestScore && score >= 3) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// ═══════════════════════════════════════════
// MAIN EXTRACTION
// ═══════════════════════════════════════════

/**
 * Extract raw rows from parsed CSV/Excel data.
 * Takes headers + data rows (string[][]) and returns RawTradeRow[].
 */
export function extractRawRows(
  headers: string[],
  dataRows: string[][],
): { rows: RawTradeRow[]; columnMapping: Record<string, string>; warnings: string[] } {
  // Step 1: Smart header matching
  let columnMapping = matchColumns(headers);
  const warnings: string[] = [];

  // Step 2: Content-based detection fallback
  const mappedFields = new Set(Object.values(columnMapping));
  const criticalMissing = ['symbol', 'qty', 'price'].filter(f => !mappedFields.has(f));
  if (criticalMissing.length > 0 && dataRows.length > 0) {
    columnMapping = applyContentDetection(headers, dataRows, columnMapping);
  }

  // Check for remaining critical missing columns
  const finalFields = new Set(Object.values(columnMapping));
  if (!finalFields.has('symbol')) warnings.push('No symbol/instrument column detected');
  if (!finalFields.has('price') && !finalFields.has('buyPrice') && !finalFields.has('sellPrice') && !finalFields.has('entryPrice')) {
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
    if (!symbol || /^(total|grand|sub|net|sum|average|avg|count)/i.test(symbol)) continue;

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
      entryPrice: getMapped('entryPrice'),
      exitPrice: getMapped('exitPrice'),
      fees: getMapped('fees'),
      segment: getMapped('segment'),
      orderId: getMapped('orderId'),
    };

    // Try to extract date from time field if date is missing
    if (!mapped.date && mapped.time) {
      const dateFromTime = extractDateFromTime(mapped.time);
      if (dateFromTime) mapped.date = dateFromTime;
    }

    // Infer side from buyQty/sellQty if missing
    if (!mapped.side) {
      const bq = parseFloat(cleanNumeric(mapped.buyQty || ''));
      const sq = parseFloat(cleanNumeric(mapped.sellQty || ''));
      if (!isNaN(bq) && bq > 0) mapped.side = 'BUY';
      else if (!isNaN(sq) && sq > 0) mapped.side = 'SELL';
    }

    // Infer qty from buyQty/sellQty if missing
    if (!mapped.qty) {
      mapped.qty = mapped.buyQty || mapped.sellQty;
    }

    // Infer price from entryPrice/buyPrice/sellPrice if missing
    if (!mapped.price) {
      if (mapped.entryPrice) {
        mapped.price = mapped.entryPrice;
      } else if (mapped.side === 'BUY' || (!mapped.side && mapped.buyPrice)) {
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
 * Detect binary/garbage content from PDF text extractors.
 * pdf-parse often extracts raw stream bytes from scanned PDFs —
 * encrypted/compressed data that looks like `\x96\x00\x83W+Íµ¯ù...`.
 * Returns true if the text is mostly non-printable junk.
 */
function isBinaryGarbage(text: string): boolean {
  if (!text || text.length < 100) return false;
  // Sample first 2000 chars (representative enough)
  const sample = text.slice(0, 2000);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // Count chars that are non-printable ASCII (excluding tab, newline, carriage return)
    // or in the Latin-1 supplement control range (128-159)
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || (code > 126 && code < 160)) {
      nonPrintable++;
    }
  }
  const ratio = nonPrintable / sample.length;
  if (ratio > 0.08) {
    console.log(`[RawExtractor] Binary garbage detected: ${(ratio * 100).toFixed(1)}% non-printable in first ${sample.length} chars`);
    return true;
  }
  return false;
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
    // Parse CSV directly with Papa to preserve original headers
    // (parseCSVText uses old column mapper that drops entryPrice/exitPrice)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Papa = require('papaparse');
    // Skip metadata rows (e.g., Fyers has title/date/client before headers)
    const lines = rawText.trim().split('\n');
    let headerLineIdx = 0;
    const headerPatterns = /symbol|instrument|scrip|trade.?time|date.?&?.?time|date.?time|side|qty|quantity|price|traded.?price|entry|exit/i;
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const cols = lines[i].split(',');
      const matches = cols.filter((c: string) => headerPatterns.test(c.trim())).length;
      if (matches >= 3) { headerLineIdx = i; break; }
    }
    const csvText = headerLineIdx > 0 ? lines.slice(headerLineIdx).join('\n') : rawText.trim();
    const papaResult = Papa.parse(csvText, { header: false, skipEmptyLines: true, dynamicTyping: false });
    const allRows: string[][] = papaResult.data || [];
    if (allRows.length > 1) {
      headers = allRows[0].map((h: string) => (h || '').trim());
      dataRows = allRows.slice(1).filter((r: string[]) => r.some((c: string) => c && c.trim()));
    }
  } else if (ext === 'xlsx' || ext === 'xls') {
    const result = parseExcelBuffer(buffer);
    rawText = result.text;
    if (result.rows.length > 0) {
      headers = Object.keys(result.rows[0]);
      dataRows = result.rows.map(row => headers.map(h => String(row[h] ?? '')));
    }
  } else if (ext === 'pdf') {
    // Strategy 1: Layout-aware coordinate-based extraction (contract notes)
    let pdfHandled = false;
    try {
      const extraction = await extractPdfWithCoordinates(buffer);
      if (extraction.tableRows.length >= 2) {
        const cnResult = parseContractNote(extraction);
        if (cnResult.dataRows.length > 0) {
          headers = cnResult.headers;
          dataRows = cnResult.dataRows;
          rawText = cnResult.rawText;
          warnings.push(...cnResult.warnings);
          pdfHandled = true;
          console.log(`[RawExtractor] PDF contract note: ${cnResult.broker.brokerName}, ${cnResult.dataRows.length} trade rows`);
        } else {
          rawText = extraction.rawText;
          warnings.push('Contract note detector found no trade rows — falling back to legacy parser');
        }
      } else {
        rawText = extraction.rawText;
        warnings.push('PDF has too few table rows for contract note detection — falling back');
      }
    } catch (pdfErr) {
      console.error('[RawExtractor] Coordinate PDF extraction failed:', pdfErr instanceof Error ? pdfErr.message : pdfErr);
      warnings.push('Coordinate-based PDF extraction failed — falling back to legacy parser');
    }

    // Strategy 2: OCR for scanned/image PDFs (when text extraction found nothing)
    if (!pdfHandled && (!rawText || rawText.replace(/---\s*PAGE BREAK\s*---/g, '').trim().length < 50)) {
      console.log('[RawExtractor] PDF has no/minimal text — trying OCR extraction...');
      try {
        const ocrResult = await extractPdfWithOcr(buffer);
        if (ocrResult && ocrResult.rawText.length > 100) {
          rawText = ocrResult.rawText;
          // First try contract note detector on OCR output
          if (ocrResult.tableRows.length >= 2) {
            try {
              const cnResult = parseContractNote(ocrResult);
              if (cnResult.dataRows.length > 0) {
                headers = cnResult.headers;
                dataRows = cnResult.dataRows;
                warnings.push(...cnResult.warnings);
                pdfHandled = true;
                console.log('[RawExtractor] OCR + contract note parser: ' + cnResult.dataRows.length + ' trade rows');
              }
            } catch (cnErr) {
              console.error('[RawExtractor] Contract note parse on OCR failed:', cnErr instanceof Error ? cnErr.message : cnErr);
            }
          }
          // Fallback: parse OCR text directly for trade patterns
          if (!pdfHandled) {
            const ocrTrades = parseOcrTradeRows(ocrResult.rawText);
            if (ocrTrades.dataRows.length > 0) {
              headers = ocrTrades.headers;
              dataRows = ocrTrades.dataRows;
              warnings.push(...ocrTrades.warnings);
              pdfHandled = true;
              console.log('[RawExtractor] OCR direct parse: ' + ocrTrades.dataRows.length + ' trades (broker: ' + ocrTrades.broker + ')');
            }
          }
        }
      } catch (ocrErr) {
        console.error('[RawExtractor] OCR extraction failed:', ocrErr instanceof Error ? ocrErr.message : ocrErr);
        warnings.push('OCR extraction failed — will fall back to Claude AI if available');
      }
    }

    // Strategy 3: Legacy text-based PDF parser (order books, generic formats)
    if (!pdfHandled) {
      const result = await parsePDFBuffer(buffer);
      // Check for binary garbage before using the extracted text
      if (result.text && isBinaryGarbage(result.text)) {
        console.log(`[RawExtractor] Skipping legacy PDF text (${result.text.length} chars of binary garbage)`);
        // Don't set rawText to garbage — leave it empty so Claude AI fallback triggers cleanly
        warnings.push('PDF text extraction returned binary data — skipping legacy parser');
      } else {
        if (!rawText) rawText = result.text;
        if (result.rows.length > 0) {
          headers = Object.keys(result.rows[0]);
            dataRows = result.rows.map(row => headers.map(h => String(row[h] ?? '')));
          console.log('[RawExtractor] Legacy PDF parser: ' + result.rows.length + ' rows');
        }
      }
    }
  } else {
    rawText = buffer.toString('utf-8');
    // Parse as CSV preserving original headers (same as CSV path)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PapaFallback = require('papaparse');
    const fbResult = PapaFallback.parse(rawText.trim(), { header: false, skipEmptyLines: true, dynamicTyping: false });
    const fbRows: string[][] = fbResult.data || [];
    if (fbRows.length > 1) {
      headers = fbRows[0].map((h: string) => (h || '').trim());
      dataRows = fbRows.slice(1).filter((r: string[]) => r.some((c: string) => c && c.trim()));
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

  const brokerDetected = broker !== 'Unknown';
  const { level: confidence, score: confidenceScore } = computeConfidence(
    columnMapping, rows.length, brokerDetected
  );

  if (confidence === 'low') {
    warnings.push('Low confidence (' + confidenceScore + '/100) in column mapping — some fields may be incorrectly mapped');
  }

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
    confidence,
    confidenceScore,
  };
}
