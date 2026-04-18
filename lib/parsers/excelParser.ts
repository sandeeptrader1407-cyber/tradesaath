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

    // Find header row — look for row with known column names (skip metadata rows)
    let headerIdx = 0;
    const hdrPattern = /symbol|instrument|scrip|trade.?time|date.?&?.?time|side|qty|quantity|price|traded.?price/i;
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = (jsonData[i] || []).map((c: unknown) => String(c || ''));
      const matches = row.filter(c => hdrPattern.test(c.trim())).length;
      if (matches >= 3) { headerIdx = i; break; }
    }

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
        const trade = parseRow(row, colMap);
        if (trade && trade.symbol) allRows.push(trade);
      }
    }
  }

  // If structured parsing found trades, use those. Otherwise, fall back to CSV parsing.
  if (allRows.length > 0) return { text: allText, rows: allRows };
  return { text: allText, rows: parseCSVText(allText) };
}
