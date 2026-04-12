/**
 * CSV/TSV Parser for TradeSaath
 * Handles comma-separated and tab-separated trade data
 */

import { AnyRow, mapColumns, parseRow } from './types';

/* ─── Parse CSV/TSV text ─── */
export function parseCSVText(text: string): AnyRow[] {
  // papaparse is CommonJS-only in server context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Papa = require('papaparse');

  // Fyers CSVs have metadata rows before actual headers (Report Title, Date Range, Client Name, etc.)
  // Strategy: Find the real header row by looking for a line with known column names
  const lines = text.trim().split('\n');
  let headerLineIdx = -1;
  const headerPatterns = /symbol|instrument|scrip|trade.?time|date.?&?.?time|side|qty|quantity|price|traded.?price/i;

  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i];
    // Count how many known column patterns match in this line
    const cols = line.split(',');
    const matches = cols.filter(c => headerPatterns.test(c.trim())).length;
    if (matches >= 3) {
      headerLineIdx = i;
      break;
    }
  }

  // If we found a header row that's not the first line, skip metadata
  let csvText = text.trim();
  if (headerLineIdx > 0) {
    csvText = lines.slice(headerLineIdx).join('\n');
    console.log(`[Parser] Skipped ${headerLineIdx} metadata rows, header: ${lines[headerLineIdx].substring(0, 100)}`);
  }

  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (!result.data || result.data.length === 0) return [];

  const headers = result.meta.fields || [];
  const colMap = mapColumns(headers);
  console.log('[Parser] CSV columns detected:', JSON.stringify(colMap), 'from headers:', headers.join(', '));

  if (Object.keys(colMap).length < 2) {
    console.log('[Parser] Too few columns matched. Headers:', headers);
    return [];
  }

  // Find status column (to filter out Rejected orders)
  const statusIdx = headers.findIndex((h: string) => /^status$/i.test(h.trim()));

  const trades: AnyRow[] = [];
  for (const row of result.data as Record<string, string>[]) {
    // Filter out rejected/cancelled orders
    if (statusIdx >= 0) {
      const status = (row[headers[statusIdx]] || '').toString().trim().toLowerCase();
      if (status === 'rejected' || status === 'cancelled' || status === 'canceled' || status === 'pending') {
        continue;
      }
    }
    const values = headers.map((h: string) => row[h] || '');
    const trade = parseRow(values, colMap);
    if (trade && trade.symbol) trades.push(trade);
  }

  console.log(`[Parser] Extracted ${trades.length} trades from CSV (filtered ${(result.data as unknown[]).length - trades.length} non-executed rows)`);
  return trades;
}
