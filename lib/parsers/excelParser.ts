/**
 * Excel Parser for TradeSaath
 * Handles XLS/XLSX trade data files
 */

import { AnyRow, mapColumns, parseRow } from './types';
import { parseCSVText } from './csvParser';

/* ─── Sheet selection (audit Finding N5 — 2026-05-04) ──────────────────
 * Multi-sheet workbooks (e.g. IBKR Activity Statement) used to be
 * concatenated row-for-row, so an "Open Positions" sheet sitting next
 * to the real "Trades" sheet would inject phantom trade rows with
 * mis-mapped columns (Cost Price ≠ Trade Price, Mult ≠ Qty, etc.).
 * Fix: pick exactly ONE sheet to parse.
 *   1. Positive name match  /^trade(s)?$/i wins instantly.
 *   2. Otherwise score every sheet by header-pattern hits in its first
 *      10 rows; pick the highest scorer that meets threshold (>=3).
 *      Tiebreak: lowest sheet index.
 *   3. If nothing scores, fall back to sheet 0 (legacy behaviour for
 *      weird workbooks where no sheet has clean trade headers).
 * Sheets matching the negative list are dropped from steps 2 (scoring),
 * since brokers occasionally give them trade-shaped column names too.
 */

const TRADE_SHEET_NAME_RE = /^trade(s)?$/i;

const NON_TRADE_SHEET_NAMES = new Set<string>([
  'open positions', 'open position', 'holdings', 'positions',
  'account information', 'account info', 'summary',
  'nav', 'net asset value', 'performance',
  'statement', 'cash report', 'dividends', 'interest',
]);

const HEADER_HINT_PATTERN =
  /symbol|instrument|scrip|contract|trade.?time|date.?&?.?time|buy.?sell|side|qty|quantity|price|traded.?price|trade.?type|action|trans.?code|t\.\s*price|asset.?category|date\/time/i;

const HEADER_SCORE_THRESHOLD = 3;

interface XlsxLike {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

/**
 * Decide which sheet inside the workbook holds trade rows.
 * Exported so the diagnostic test can report the choice independently.
 */
export function chooseTradeSheet(workbook: XlsxLike): string | null {
  const names = workbook.SheetNames;
  if (!names || names.length === 0) return null;

  // Step 1: positive name match.
  for (const name of names) {
    if (TRADE_SHEET_NAME_RE.test(name.trim())) return name;
  }

  // Step 2: score-based selection (skipping known non-trade sheet names).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  let bestScore = 0;
  let bestName: string | null = null;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const lower = name.trim().toLowerCase();
    if (NON_TRADE_SHEET_NAMES.has(lower)) continue;

    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | null)[][];
    let bestRowMatches = 0;
    const scanLimit = Math.min(10, json.length);
    for (let r = 0; r < scanLimit; r++) {
      const row = (json[r] || []).map((c: unknown) => String(c ?? '').trim());
      const matches = row.filter((c: string) => c.length > 0 && HEADER_HINT_PATTERN.test(c)).length;
      if (matches > bestRowMatches) bestRowMatches = matches;
    }
    if (bestRowMatches > bestScore) {
      bestScore = bestRowMatches;
      bestName = name;
    }
  }
  if (bestScore >= HEADER_SCORE_THRESHOLD && bestName) return bestName;

  // Step 3: fallback — sheet 0 (preserves legacy behaviour).
  return names[0];
}

/* ─── Parse Excel buffer ─── */
export function parseExcelBuffer(buffer: Buffer): { text: string; rows: AnyRow[] } {
  // xlsx is CommonJS-only — dynamic import not supported
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' }) as XlsxLike;

  // Accumulate rawText from EVERY sheet (downstream broker / market /
  // currency detection scans this string for keywords; restricting to
  // one sheet would lose signals like "MetaQuotes-Demo" in MT5's header
  // band).
  let allText = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet) as string;
    allText += csv + '\n';
  }

  const chosenSheetName = chooseTradeSheet(workbook);
  const allRows: AnyRow[] = [];

  if (chosenSheetName) {
    const sheet = workbook.Sheets[chosenSheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | null)[][];

    if (jsonData.length >= 2) {
      // Find header row inside the chosen sheet — look for row with known column
      // names (skip metadata rows). ICICI Direct / ISEC / some Axis exports put
      // 30+ rows of client info, date range, and charges summary ABOVE the actual
      // tradebook header, so we scan the whole sheet (capped at 200 to avoid
      // pathological inputs) and keep the row with the MOST column-name hits, not
      // just the first one clearing the threshold.
      let headerIdx = -1;
      let bestMatches = 2; // require at least 3 matches to accept a header row
      for (let i = 0; i < Math.min(200, jsonData.length); i++) {
        const row = (jsonData[i] || []).map((c: unknown) => String(c || ''));
        const matches = row.filter(c => HEADER_HINT_PATTERN.test(c.trim())).length;
        if (matches > bestMatches) {
          bestMatches = matches;
          headerIdx = i;
        }
      }
      if (headerIdx < 0) headerIdx = 0;

      const headers = (jsonData[headerIdx] || []).map((c: unknown) => String(c || ''));
      const colMap = mapColumns(headers);
      const statusCol = headers.findIndex(h => /^status$/i.test(h.trim()));

      if (Object.keys(colMap).length >= 2) {
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = (jsonData[i] || []).map((c: unknown) => String(c ?? ''));
          // Filter rejected/cancelled orders
          if (statusCol >= 0) {
            const status = (row[statusCol] || '').trim().toLowerCase();
            if (status === 'rejected' || status === 'cancelled' || status === 'canceled' || status === 'pending') continue;
          }
          // Skip trailing footer/note rows ("NOTE: Data Accurate Till...", "Disclaimer:")
          const firstCell = (row[0] || '').trim().toLowerCase();
          if (/^(note|disclaimer|remark|end of|\*)/i.test(firstCell)) continue;
          const trade = parseRow(row, colMap);
          if (trade && trade.symbol) allRows.push(trade);
        }
      }
    }
  }

  // If structured parsing found trades, use those. Otherwise, fall back to CSV parsing.
  if (allRows.length > 0) return { text: allText, rows: allRows };
  return { text: allText, rows: parseCSVText(allText) };
}
