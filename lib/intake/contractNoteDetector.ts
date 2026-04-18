/**
 * TradeSaath Contract Note Detector
 * Detects broker, date, and trade table structure from Indian broker
 * contract note PDFs using coordinate-based extraction results.
 *
 * Supports: Fyers, Zerodha, Upstox, Angel One, ICICI Direct, HDFC Securities,
 * Kotak Securities, Motilal Oswal, Sharekhan, 5paisa, Groww, Dhan, and more.
 */

import { PdfTableRow, PdfExtractionResult, detectColumnBoundaries, alignRowsToColumns } from './pdfTableExtractor';

/** Broker detection result */
export interface BrokerDetection {
  brokerId: string;
  brokerName: string;
  confidence: number; // 0-100
}

/** Contract note parsing result */
export interface ContractNoteResult {
  broker: BrokerDetection;
  tradeDate: string;          // YYYY-MM-DD
  market: string;             // NSE, BSE, MCX
  currency: string;           // INR
  headers: string[];          // Detected column headers
  dataRows: string[][];       // Rows of trade data
  rawText: string;            // Full text for fallback detection
  warnings: string[];
}

// ─── Broker detection patterns ───

interface BrokerPattern {
  id: string;
  name: string;
  /** Patterns to match in PDF text (case-insensitive) */
  textPatterns: RegExp[];
  /** Confidence boost if pattern matches */
  weight: number;
}

const BROKER_PATTERNS: BrokerPattern[] = [
  {
    id: 'zerodha',
    name: 'Zerodha',
    textPatterns: [/zerodha/i, /zerodha\s*broking/i, /ZRDB\d/i, /kite\.zerodha/i],
    weight: 90,
  },
  {
    id: 'fyers',
    name: 'Fyers',
    textPatterns: [/fyers/i, /fyers\s*securities/i, /fyers\.in/i],
    weight: 90,
  },
  {
    id: 'upstox',
    name: 'Upstox',
    textPatterns: [/upstox/i, /rksv\s*securities/i, /upstox\.com/i],
    weight: 90,
  },
  {
    id: 'angel-one',
    name: 'Angel One',
    textPatterns: [/angel\s*(one|broking)/i, /angel\s*securities/i],
    weight: 90,
  },
  {
    id: 'icici-direct',
    name: 'ICICI Direct',
    textPatterns: [/icici\s*securities/i, /icici\s*direct/i, /icicidirect/i],
    weight: 90,
  },
  {
    id: 'hdfc-securities',
    name: 'HDFC Securities',
    textPatterns: [/hdfc\s*securities/i, /hdfcsec/i],
    weight: 90,
  },
  {
    id: 'kotak-securities',
    name: 'Kotak Securities',
    textPatterns: [/kotak\s*securities/i, /kotak\s*mahindra/i, /kotaksecurities/i],
    weight: 90,
  },
  {
    id: 'motilal-oswal',
    name: 'Motilal Oswal',
    textPatterns: [/motilal\s*oswal/i, /mosl/i],
    weight: 85,
  },
  {
    id: 'sharekhan',
    name: 'Sharekhan',
    textPatterns: [/sharekhan/i, /share\s*khan/i],
    weight: 90,
  },
  {
    id: '5paisa',
    name: '5paisa',
    textPatterns: [/5\s*paisa/i, /five\s*paisa/i, /5paisa/i],
    weight: 90,
  },
  {
    id: 'groww',
    name: 'Groww',
    textPatterns: [/groww/i, /nextbillion/i],
    weight: 90,
  },
  {
    id: 'dhan',
    name: 'Dhan',
    textPatterns: [/dhan\b/i, /dhan\s*hq/i, /moneylicious/i],
    weight: 85,
  },
  {
    id: 'paytm-money',
    name: 'Paytm Money',
    textPatterns: [/paytm\s*money/i, /paytm\s*securities/i],
    weight: 90,
  },
  {
    id: 'iifl',
    name: 'IIFL Securities',
    textPatterns: [/iifl\s*securities/i, /india\s*infoline/i, /iifl\.com/i],
    weight: 90,
  },
];

// ─── Contract note header patterns ───
// SEBI mandates specific columns in contract notes. These are the common headers.

/** Standard contract note column header patterns (case-insensitive) */
const HEADER_PATTERNS: { field: string; patterns: RegExp[] }[] = [
  { field: 'symbol', patterns: [/^scrip\s*name$/i, /^symbol$/i, /^instrument$/i, /^security\s*name$/i, /^scrip$/i, /^contract\s*desc/i, /^security/i, /^stock\s*name/i] },
  { field: 'tradeNo', patterns: [/^trade\s*no/i, /^order\s*no/i, /^trade\s*id/i, /^sr\.?\s*no/i, /^s\.?\s*no/i, /^sl\.?\s*no/i] },
  { field: 'time', patterns: [/^trade\s*time/i, /^time$/i, /^order\s*time/i, /^exec.*time/i] },
  { field: 'side', patterns: [/^buy\s*\/\s*sell$/i, /^b\s*\/\s*s$/i, /^type$/i, /^side$/i, /^transaction/i, /^buy.*sell/i] },
  { field: 'qty', patterns: [/^qty$/i, /^quantity$/i, /^traded\s*qty/i, /^trade\s*qty/i, /^lot\s*size/i] },
  { field: 'price', patterns: [/^price$/i, /^rate$/i, /^trade\s*price/i, /^traded\s*price/i, /^avg\.?\s*price/i, /^net\s*rate/i] },
  { field: 'amount', patterns: [/^amount$/i, /^value$/i, /^trade\s*value/i, /^net\s*value/i, /^gross\s*value/i, /^net\s*amount/i] },
  { field: 'exchange', patterns: [/^exchange$/i, /^exch$/i, /^mkt$/i, /^market$/i] },
  { field: 'expiry', patterns: [/^expiry$/i, /^expiry\s*date/i, /^exp\s*date/i, /^contract\s*exp/i] },
  { field: 'strike', patterns: [/^strike$/i, /^strike\s*price/i] },
  { field: 'optionType', patterns: [/^option\s*type/i, /^opt\s*type/i, /^ce\s*\/\s*pe$/i, /^call\s*\/\s*put/i] },
  { field: 'brokerage', patterns: [/^brokerage$/i, /^brkg$/i, /^commission$/i] },
  { field: 'netAmount', patterns: [/^net\s*amount/i, /^net\s*value/i, /^payable/i, /^receivable/i] },
  { field: 'segment', patterns: [/^segment$/i, /^series$/i] },
  { field: 'settlement', patterns: [/^settlement/i, /^sett\s*no/i, /^settl/i] },
];

/**
 * Detect broker from PDF text content.
 */
export function detectBrokerFromPdf(rawText: string): BrokerDetection {
  let bestMatch: BrokerDetection = { brokerId: 'unknown', brokerName: 'Unknown', confidence: 0 };

  for (const bp of BROKER_PATTERNS) {
    let matchCount = 0;
    for (const pat of bp.textPatterns) {
      if (pat.test(rawText)) matchCount++;
    }
    if (matchCount > 0) {
      const conf = Math.min(100, bp.weight + (matchCount - 1) * 5);
      if (conf > bestMatch.confidence) {
        bestMatch = { brokerId: bp.id, brokerName: bp.name, confidence: conf };
      }
    }
  }

  // Fallback: check for generic "contract note" or "trade confirmation"
  if (bestMatch.confidence === 0) {
    if (/contract\s*note/i.test(rawText) || /trade\s*confirmation/i.test(rawText)) {
      bestMatch = { brokerId: 'generic-indian', brokerName: 'Unknown Indian Broker', confidence: 30 };
    }
  }

  return bestMatch;
}

/**
 * Extract trade date from contract note PDF text.
 * Indian contract notes have dates in DD/MM/YYYY, DD-MM-YYYY, or "DD Mon YYYY" format.
 * Looks for "Trade Date", "Date", "Contract Note Date" labels near a date value.
 */
export function extractContractNoteDate(rawText: string): string {
  // Pattern 1: "Trade Date: DD/MM/YYYY" or "Trade Date : DD-MM-YYYY"
  const labeledDate = rawText.match(
    /(?:trade\s*date|contract\s*note\s*date|date\s*of\s*contract|order\s*date)\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i
  );
  if (labeledDate) {
    return normalizeIndianDate(labeledDate[1]);
  }

  // Pattern 2: "Trade Date: 27 Mar 2026" or "Trade Date : March 27, 2026"
  const labeledDateWords = rawText.match(
    /(?:trade\s*date|contract\s*note\s*date|date)\s*:?\s*(\d{1,2}\s+\w{3,9}\s+\d{2,4})/i
  );
  if (labeledDateWords) {
    return parseDateWords(labeledDateWords[1]);
  }

  // Pattern 3: Look for any DD/MM/YYYY near top of document (first 500 chars)
  const topText = rawText.slice(0, 500);
  const anyDate = topText.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/);
  if (anyDate) {
    return normalizeIndianDate(anyDate[1]);
  }

  // Pattern 4: "27 Mar 2026" style near top
  const wordDate = topText.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
  if (wordDate) {
    return parseDateWords(`${wordDate[1]} ${wordDate[2]} ${wordDate[3]}`);
  }

  return '';
}

/**
 * Normalize DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD.
 */
function normalizeIndianDate(dateStr: string): string {
  const parts = dateStr.split(/[\/-]/);
  if (parts.length !== 3) return dateStr;

  const [dd, mm, yyyyRaw] = parts;
  const yyyy = yyyyRaw.length === 2 ? '20' + yyyyRaw : yyyyRaw;

  // Validate
  const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) {
    // Maybe it's MM/DD/YYYY? Check if dd > 12
    if (d > 12 && m <= 12) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return dateStr;
  }

  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Parse "27 Mar 2026" style date to YYYY-MM-DD.
 */
function parseDateWords(dateStr: string): string {
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const m = dateStr.match(/(\d{1,2})\s+(\w{3})\w*\s+(\d{4})/);
  if (!m) return '';
  const mon = months[m[2].toLowerCase().slice(0, 3)];
  if (!mon) return '';
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

/**
 * Detect which rows are headers in the table extraction.
 * Scans for rows where multiple cells match known header patterns.
 */
function findHeaderRow(tableRows: PdfTableRow[]): { index: number; headers: string[]; fieldMapping: Record<string, string> } | null {
  for (let i = 0; i < Math.min(tableRows.length, 30); i++) {
    const row = tableRows[i];
    const fieldMapping: Record<string, string> = {};
    let matchCount = 0;

    for (const cell of row.cells) {
      const cleanCell = cell.trim();
      if (!cleanCell) continue;

      for (const hp of HEADER_PATTERNS) {
        for (const pat of hp.patterns) {
          if (pat.test(cleanCell)) {
            fieldMapping[cleanCell] = hp.field;
            matchCount++;
            break;
          }
        }
        if (fieldMapping[cleanCell]) break;
      }
    }

    // Need at least 3 header matches to be confident it's a header row
    if (matchCount >= 3) {
      return { index: i, headers: row.cells.map(c => c.trim()), fieldMapping };
    }
  }

  return null;
}

/**
 * Check if a row looks like trade data (has numbers, not a summary/total row).
 */
function isDataRow(cells: string[]): boolean {
  if (cells.length < 3) return false;

  // Must have at least one number
  const hasNumber = cells.some(c => /\d+\.?\d*/.test(c));
  if (!hasNumber) return false;

  // Skip total/summary rows
  const joinedLower = cells.join(' ').toLowerCase();
  if (/^(total|grand\s*total|sub\s*total|net\s*total|brokerage|stt|stamp|sebi|gst|cgst|sgst|igst|transaction\s*charges)/i.test(joinedLower)) {
    return false;
  }
  if (/\b(total|grand total|sub total)\b/i.test(cells[0])) {
    return false;
  }

  return true;
}

/**
 * Main function: detect contract note structure and extract trade rows.
 */
export function parseContractNote(extraction: PdfExtractionResult): ContractNoteResult {
  const warnings: string[] = [];
  const rawText = extraction.rawText;

  // 1. Detect broker
  const broker = detectBrokerFromPdf(rawText);
  if (broker.confidence < 50) {
    warnings.push(`Low confidence broker detection: ${broker.brokerName} (${broker.confidence}%)`);
  }

  // 2. Extract trade date
  const tradeDate = extractContractNoteDate(rawText);
  if (!tradeDate) {
    warnings.push('Could not extract trade date from contract note');
  }

  // 3. Detect market
  let market = 'NSE';
  if (/\bBSE\b/.test(rawText)) market = 'BSE';
  if (/\bMCX\b/.test(rawText)) market = 'MCX';
  if (/\bNSE\b/.test(rawText)) market = 'NSE';

  // 4. Find header row in table rows
  const tableRows = extraction.tableRows;
  const headerResult = findHeaderRow(tableRows);

  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (headerResult) {
    headers = headerResult.headers;
    console.log(`[ContractNote] Found header row at index ${headerResult.index}: ${headers.join(' | ')}`);

    // 5. Detect column boundaries from header row onward for alignment
    const dataTableRows = tableRows.slice(headerResult.index + 1);
    const colBoundaries = detectColumnBoundaries([tableRows[headerResult.index], ...dataTableRows]);

    if (colBoundaries.length > 0) {
      // Re-align all data rows to columns
      const aligned = alignRowsToColumns(dataTableRows, colBoundaries);
      // Also re-align header row
      const alignedHeaders = alignRowsToColumns([tableRows[headerResult.index]], colBoundaries);
      if (alignedHeaders.length > 0) {
        headers = alignedHeaders[0];
      }
      dataRows = aligned.filter(row => isDataRow(row));
    } else {
      // Use raw cells
      dataRows = dataTableRows
        .map(r => r.cells)
        .filter(cells => isDataRow(cells));
    }
  } else {
    warnings.push('Could not detect header row in contract note — trying fallback');

    // Fallback: look for rows with BUY/SELL and numbers
    const tradeRows = tableRows.filter(row => {
      const text = row.cells.join(' ');
      return /\b(BUY|SELL|B|S)\b/i.test(text) && /\d+/.test(text);
    });

    if (tradeRows.length > 0) {
      // Use the first trade row's cell count as column count
      headers = tradeRows[0].cells.map((_, i) => `Column${i + 1}`);
      dataRows = tradeRows.map(r => r.cells);
      warnings.push(`Fallback: found ${tradeRows.length} rows with BUY/SELL patterns`);
    }
  }

  // Filter out rows that are clearly not trade data
  dataRows = dataRows.filter(row => {
    // Must have at least one non-empty cell
    const nonEmpty = row.filter(c => c.trim() !== '');
    return nonEmpty.length >= 3;
  });

  console.log(`[ContractNote] Extracted ${dataRows.length} trade rows from ${broker.brokerName} contract note`);

  return {
    broker,
    tradeDate,
    market,
    currency: 'INR',
    headers,
    dataRows,
    rawTex