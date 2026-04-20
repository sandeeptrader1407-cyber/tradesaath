/**
 * Excel Parser for TradeSaath
 * Handles XLS/XLSX trade data files
 */

import { AnyRow, mapColumns, parseRow } from './types';
import { parseCSVText } from './csvParser';

/* ─── Parse Excel buffer ─── */
export function parseExcelBuffer(buffer: Buffer): { text: string; rows: AnyRow[] } {
  // xlsx is CommonJS-only — dynamic import not supported
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  let allText = '';
  const allRows: AnyRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    allText += csv + '\n';

    // Also try as array for more structured parsing
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | null)[][];
    if (jsonData.length < 2) continue;

    // Find header row — look for row with known column names (skip metadata rows).
    // ICICI Direct / ISEC / some Axis exports put 30+ rows of client info, date range,
    // and charges summary ABOVE the actual tradebook header, so we scan the whole sheet
    // (capped at 200 to avoid pathological inputs) and keep the row with the MOST
    // column-name hits, not just the first one clearing the threshold.
    let headerIdx = -1;
    let bestMatches = 2; // require at least 3 matches to accept a header row
    const hdrPattern = /symbol|instrument|scrip|contract|trade.?time|date.?&?.?time|buy.?sell|side|qty|quantity|price|traded.?price/i;
    for (let i = 0; i < Math.min(200, jsonData.length); i++) {
      const row = (jsonData[i] || []).map((c: unknown) => String(c || ''));
      const matches = row.filter(c => hdrPattern.test(c.trim())).length;
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

  // If structured parsing found trades, use those. Otherwise, fall back to CSV parsing.
  if (allRows.length > 0) return { text: allText, rows: allRows };
  return { text: allText, rows: parseCSVText(allText) };
}
