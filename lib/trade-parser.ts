/**
 * TradeSaath Local Trade Parser
 * Parses PDF, CSV, TSV, XLS/XLSX files WITHOUT AI
 * Extracts trades, pairs buy/sell, calculates all KPIs
 * Falls back gracefully if parsing fails
 */

// Generic row type — fields vary by broker format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
import { detectBrokerFromText } from '@/lib/config/brokers';

export interface ParsedTrade {
  index: number;
  time: string;
  symbol: string;
  side: string;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  cum_pnl: number;
  session: string;
  time_gap_minutes: number | null;
  tag: string;
  label: string;
}

export interface ParsedKPIs {
  net_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number;
  best_trade_pnl: number;
  worst_trade_pnl: number;
  gross_profit: number;
  gross_loss: number;
  avg_win: number;
  avg_loss: number;
  gross_buy_value: number;
  gross_sell_value: number;
}

export interface ParseResult {
  success: boolean;
  broker: string;
  market: string;
  trade_date: string;
  currency: string;
  total_trades_in_file: number;
  kpis: ParsedKPIs;
  trades: ParsedTrade[];
  time_analysis: {
    avg_time_gap_minutes: number;
    min_time_gap_minutes: number;
    max_time_gap_minutes: number;
    trading_duration_minutes: number;
  };
  error?: string;
}

/* ─── Column name patterns for flexible matching ─── */
const COL = {
  time: /^(time|trade.?time|exec.?time|order.?time|timestamp|executed.?at|date.?&?.?time|date.?time|order.?execution.?time)/i,
  symbol: /^(symbol|scrip|instrument|stock|name|contract|underlying|security.?name|company|trading.?symbol)/i,
  side: /^(side|trade.?type|buy.?sell|action|b.?s|direction|transaction.?type)/i,
  qty: /^(qty|quantity|lots|volume|traded.?qty|net.?qty|filled)/i,
  price: /^(price|rate|avg.?price|trade.?price|executed.?price|avg.?rate|traded.?price|market.?rate)/i,
  amount: /^(amount|value|net.?amount|turnover|total|net.?total)/i,
  buyQty: /^(buy.?qty|buy.?quantity|buy.?vol)/i,
  sellQty: /^(sell.?qty|sell.?quantity|sell.?vol)/i,
  buyPrice: /^(buy.?price|buy.?rate|buy.?avg|buy.?value)/i,
  sellPrice: /^(sell.?price|sell.?rate|sell.?avg|sell.?value)/i,
  pnl: /^(pnl|p.?&.?l|profit|loss|net.?pnl|realized|realised|net.?profit)/i,
  date: /^(date|trade.?date|order.?date|exec.?date)/i,
  expiry: /^(expiry|expiry.?date|exp)/i,
  strike: /^(strike|strike.?price)/i,
  optType: /^(option.?type|opt.?type|ce.?pe|call.?put|instrument.?type)/i,
};

/* ─── Broker detection (from shared registry) ─── */
const detectBroker = detectBrokerFromText;

/* ─── Market detection ─── */
function detectMarket(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('nse') || t.includes('bse') || t.includes('nifty') || t.includes('banknifty') || t.includes('sensex')) return 'NSE';
  if (t.includes('nyse') || t.includes('nasdaq')) return 'NYSE';
  if (t.includes('forex') || t.includes('fx')) return 'Forex';
  if (t.includes('crypto') || t.includes('btc') || t.includes('eth')) return 'Crypto';
  return 'NSE'; // Default for Indian brokers
}

/* ─── Currency detection ─── */
function detectCurrency(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('inr') || t.includes('₹') || t.includes('rs') || t.includes('rupee')) return 'INR';
  if (t.includes('usd') || t.includes('$')) return 'USD';
  if (t.includes('eur') || t.includes('€')) return 'EUR';
  if (t.includes('gbp') || t.includes('£')) return 'GBP';
  return 'INR';
}

/* ─── Date detection ─── */
function detectDate(text: string): string {
  // Look for date patterns
  const patterns = [
    /(\d{4}[-/]\d{2}[-/]\d{2})/,  // YYYY-MM-DD
    /(\d{2}[-/]\d{2}[-/]\d{4})/,  // DD-MM-YYYY or MM-DD-YYYY
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = m[1];
      // Try to normalize to YYYY-MM-DD
      if (/^\d{4}/.test(d)) return d.replace(/\//g, '-');
      // DD-MM-YYYY → YYYY-MM-DD
      const parts = d.split(/[-/]/);
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return d;
    }
  }
  return new Date().toISOString().split('T')[0];
}

/* ─── Session classification ─── */
function classifySession(time: string): string {
  const [h] = time.split(':').map(Number);
  if (isNaN(h)) return 'morning';
  if (h < 11) return 'morning';
  if (h < 14) return 'midday'; // 11 AM - 1:30 PM
  return 'afternoon';
}

/* ─── Time gap in minutes ─── */
function timeGapMinutes(t1: string, t2: string): number | null {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  };
  const m1 = parse(t1);
  const m2 = parse(t2);
  if (m1 === null || m2 === null) return null;
  return Math.abs(m2 - m1);
}

/* ─── Map header columns to known field types ─── */
function mapColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  headers.forEach((h, i) => {
    const clean = h.trim();
    for (const [key, pattern] of Object.entries(COL)) {
      if (pattern.test(clean) && !(key in mapping)) {
        mapping[key] = i;
      }
    }
  });
  return mapping;
}

/* ─── Parse a single row into a raw trade ─── */
function parseRow(row: string[], colMap: Record<string, number>): AnyRow | null {
  const get = (key: string) => {
    const idx = colMap[key];
    return idx !== undefined && idx < row.length ? row[idx]?.trim() : undefined;
  };
  const getNum = (key: string) => {
    const v = get(key);
    if (!v) return undefined;
    const n = parseFloat(v.replace(/,/g, '').replace(/[()]/g, m => m === '(' ? '-' : ''));
    return isNaN(n) ? undefined : n;
  };

  const symbol = get('symbol');
  if (!symbol) return null;

  // Skip header-like rows or totals
  if (/^(total|grand|sub|net|sum)/i.test(symbol)) return null;

  const result: AnyRow = { symbol };

  // Time — handle many formats:
  //   "27-03-2026 14:34:43" (Fyers Date & Time)
  //   "2023-11-13T09:15:36" (Zerodha order_execution_time)
  //   "14:13:21" (Kotak Trade Time)
  //   "14:02:43" (Upstox Trade Time)
  const timeVal = get('time');
  if (timeVal) {
    // Extract HH:MM from any format containing time
    const tm = timeVal.match(/(\d{1,2}:\d{2})/);
    result.time = tm ? tm[1] : timeVal;
    // Extract date from combined fields
    const isoDate = timeVal.match(/(\d{4}-\d{2}-\d{2})/); // 2023-11-13T09:15
    const ddmmDate = timeVal.match(/(\d{2}[-/]\d{2}[-/]\d{4})/); // 27-03-2026
    if (isoDate) result.date = isoDate[1];
    else if (ddmmDate) result.date = ddmmDate[1];
  }

  // Separate Date column
  if (!result.date) {
    const dateVal = get('date');
    if (dateVal) {
      // Handle Excel serial number dates (e.g., 45505)
      const serial = parseFloat(dateVal);
      if (!isNaN(serial) && serial > 40000 && serial < 60000) {
        // Excel serial date to YYYY-MM-DD
        const epoch = new Date(Date.UTC(1899, 11, 30));
        const d = new Date(epoch.getTime() + serial * 86400000);
        result.date = d.toISOString().split('T')[0];
      } else {
        result.date = dateVal;
      }
    }
  }

  // Side detection
  const side = get('side');
  if (side) {
    result.side = /^(b|buy|long)/i.test(side.trim()) ? 'BUY' : 'SELL';
  }

  // Quantity and price
  result.qty = getNum('qty');
  result.price = getNum('price');
  result.amount = getNum('amount');
  result.pnl = getNum('pnl');

  // Buy/Sell separate columns (contract note format)
  result.buyQty = getNum('buyQty');
  result.sellQty = getNum('sellQty');
  result.buyPrice = getNum('buyPrice');
  result.sellPrice = getNum('sellPrice');

  // If we have buy/sell qty but no explicit side
  if (!result.side) {
    if (result.buyQty && result.buyQty > 0) result.side = 'BUY';
    else if (result.sellQty && result.sellQty > 0) result.side = 'SELL';
  }
  if (!result.qty) {
    result.qty = result.buyQty || result.sellQty;
  }
  if (!result.price) {
    result.price = result.side === 'BUY' ? result.buyPrice : result.sellPrice;
  }

  // Option components — build full symbol from parts (Upstox: Company=NIFTY, Strike=25000, Type=European Put)
  const strike = get('strike');
  const optType = get('optType');
  const expiry = get('expiry');
  if (strike || optType) {
    let opt = '';
    if (optType) {
      const o = optType.toLowerCase();
      if (o.includes('call') || o === 'ce') opt = 'CE';
      else if (o.includes('put') || o === 'pe') opt = 'PE';
      else opt = optType;
    }
    result.symbol = `${symbol} ${strike || ''} ${opt}`.replace(/\s+/g, ' ').trim();
  }
  if (expiry) result.expiry = expiry;

  // Clean up Kotak-style security names: "OPTIDXNIFTY     12JUN2025CE  24750.00"
  if (result.symbol && /OPTIDX/i.test(result.symbol)) {
    result.symbol = result.symbol.replace(/OPTIDX/i, '').replace(/\s+/g, ' ').trim();
  }

  return result;
}

/* ─── Pair buy/sell orders for same instrument ─── */
function pairTrades(rawTrades: AnyRow[]): ParsedTrade[] {
  // Group by symbol (normalized)
  const groups: Record<string, AnyRow[]> = {};
  for (const t of rawTrades) {
    const key = t.symbol.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const paired: ParsedTrade[] = [];

  for (const [, trades] of Object.entries(groups)) {
    // Sort by time within each symbol group
    trades.sort((a, b) => {
      const ta = (a.time || '00:00:00').replace(/:/g, '');
      const tb = (b.time || '00:00:00').replace(/:/g, '');
      return parseInt(ta) - parseInt(tb);
    });

    const buys = trades.filter(t => t.side === 'BUY');
    const sells = trades.filter(t => t.side === 'SELL');

    // FIFO matching: match buy qty with sell qty in chronological order
    // Track remaining qty for each order
    const buyQ: (AnyRow & { remaining: number })[] = buys.map(b => ({ ...b, remaining: b.qty || 0 }));
    const sellQ: (AnyRow & { remaining: number })[] = sells.map(s => ({ ...s, remaining: s.qty || 0 }));

    let bi = 0, si = 0;
    while (bi < buyQ.length && si < sellQ.length) {
      const buy = buyQ[bi];
      const sell = sellQ[si];
      if (buy.remaining <= 0) { bi++; continue; }
      if (sell.remaining <= 0) { si++; continue; }

      const matchQty = Math.min(buy.remaining, sell.remaining);
      const entry = buy.price || 0;
      const exit = sell.price || 0;
      const pnl = Math.round((exit - entry) * matchQty * 100) / 100;

      // Use the time of whichever came second (the closing trade)
      const buyTime = (buy.time || '00:00').replace(/:/g, '');
      const sellTime = (sell.time || '00:00').replace(/:/g, '');
      const closingTime = parseInt(sellTime) >= parseInt(buyTime) ? sell.time : buy.time;

      paired.push({
        index: 0,
        time: closingTime || '09:15',
        symbol: buy.symbol || sell.symbol,
        side: 'BUY',
        qty: matchQty,
        entry,
        exit,
        pnl,
        cum_pnl: 0,
        session: classifySession(closingTime || '09:15'),
        time_gap_minutes: null,
        tag: pnl >= 0 ? 'win' : 'loss',
        label: pnl >= 0 ? 'Winner' : 'Loser',
      });

      buy.remaining -= matchQty;
      sell.remaining -= matchQty;
      if (buy.remaining <= 0) bi++;
      if (sell.remaining <= 0) si++;
    }

    // Handle unpaired trades with direct P&L
    const allRemaining = [
      ...buyQ.filter(b => b.remaining > 0),
      ...sellQ.filter(s => s.remaining > 0),
    ];
    for (const t of allRemaining) {
      if (t.pnl !== undefined) {
        paired.push({
          index: 0,
          time: t.time || '09:15',
          symbol: t.symbol,
          side: t.side || 'BUY',
          qty: t.remaining || t.qty || 1,
          entry: t.price || 0,
          exit: 0,
          pnl: t.pnl,
          cum_pnl: 0,
          session: classifySession(t.time || '09:15'),
          time_gap_minutes: null,
          tag: t.pnl >= 0 ? 'win' : 'loss',
          label: t.pnl >= 0 ? 'Winner' : 'Loser',
        });
      }
    }
  }

  // If no pairing worked, try using raw trades directly (some reports have P&L per row)
  if (paired.length === 0 && rawTrades.length > 0 && rawTrades.some(t => t.pnl !== undefined)) {
    for (const t of rawTrades) {
      paired.push({
        index: 0,
        time: t.time || '09:15',
        symbol: t.symbol,
        side: t.side || 'BUY',
        qty: t.qty || 1,
        entry: t.price || 0,
        exit: 0,
        pnl: t.pnl || 0,
        cum_pnl: 0,
        session: classifySession(t.time || '09:15'),
        time_gap_minutes: null,
        tag: (t.pnl || 0) >= 0 ? 'win' : 'loss',
        label: (t.pnl || 0) >= 0 ? 'Winner' : 'Loser',
      });
    }
  }

  // Sort by time
  paired.sort((a, b) => {
    const ta = a.time.replace(/:/g, '');
    const tb = b.time.replace(/:/g, '');
    return parseInt(ta || '0') - parseInt(tb || '0');
  });

  // Set indices, cum_pnl, time gaps
  let cumPnl = 0;
  for (let i = 0; i < paired.length; i++) {
    paired[i].index = i;
    cumPnl += paired[i].pnl;
    paired[i].cum_pnl = Math.round(cumPnl * 100) / 100;
    if (i > 0) {
      paired[i].time_gap_minutes = timeGapMinutes(paired[i - 1].time, paired[i].time);
    }
  }

  return paired;
}

/* ─── Calculate KPIs ─── */
function calculateKPIs(trades: ParsedTrade[]): ParsedKPIs {
  if (trades.length === 0) {
    return { net_pnl: 0, total_trades: 0, wins: 0, losses: 0, win_rate: 0, profit_factor: 0, best_trade_pnl: 0, worst_trade_pnl: 0, gross_profit: 0, gross_loss: 0, avg_win: 0, avg_loss: 0, gross_buy_value: 0, gross_sell_value: 0 };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = losses.reduce((s, t) => s + t.pnl, 0);
  const netPnl = grossProfit + grossLoss;

  // Cross P&L: total buy value vs total sell value
  const grossBuyValue = trades.reduce((s, t) => s + (t.entry || 0) * (t.qty || 0), 0);
  const grossSellValue = trades.reduce((s, t) => s + (t.exit || 0) * (t.qty || 0), 0);

  return {
    net_pnl: Math.round(netPnl * 100) / 100,
    total_trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Math.round((wins.length / trades.length) * 10000) / 100,
    profit_factor: grossLoss !== 0 ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100 : wins.length > 0 ? 999 : 0,
    best_trade_pnl: Math.max(...trades.map(t => t.pnl)),
    worst_trade_pnl: Math.min(...trades.map(t => t.pnl)),
    gross_profit: Math.round(grossProfit * 100) / 100,
    gross_loss: Math.round(grossLoss * 100) / 100,
    avg_win: wins.length > 0 ? Math.round((grossProfit / wins.length) * 100) / 100 : 0,
    avg_loss: losses.length > 0 ? Math.round((grossLoss / losses.length) * 100) / 100 : 0,
    gross_buy_value: Math.round(grossBuyValue * 100) / 100,
    gross_sell_value: Math.round(grossSellValue * 100) / 100,
  };
}

/* ─── Time analysis ─── */
function calculateTimeAnalysis(trades: ParsedTrade[]) {
  const gaps = trades.map(t => t.time_gap_minutes).filter((g): g is number => g !== null && g > 0);
  const times = trades.map(t => {
    const [h, m] = t.time.split(':').map(Number);
    return isNaN(h) ? 0 : h * 60 + (m || 0);
  }).filter(t => t > 0);

  return {
    avg_time_gap_minutes: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
    min_time_gap_minutes: gaps.length > 0 ? Math.min(...gaps) : 0,
    max_time_gap_minutes: gaps.length > 0 ? Math.max(...gaps) : 0,
    trading_duration_minutes: times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0,
  };
}

/* ═══════════════════════════════════════════
   FILE TYPE PARSERS
═══════════════════════════════════════════ */

/* ─── Parse CSV/TSV text ─── */
function parseCSVText(text: string): AnyRow[] {
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

/* ─── Parse Excel buffer ─── */
function parseExcelBuffer(buffer: Buffer): { text: string; rows: AnyRow[] } {
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

/* ─── Parse Fyers/Indian broker order book format (PDF text) ─── */
function parseFyersOrderBook(text: string): AnyRow[] {
  const trades: AnyRow[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this is a symbol line (e.g., NIFTY26MAR22900PE, BANKNIFTY...)
    if (/^(NIFTY|BANKNIFTY|FINNIFTY|SENSEX|MIDCPNIFTY)/i.test(line) && !line.includes('Symbol')) {
      // Next line(s) should have exchange (NFO/NSE) then order details
      // PDF text format: "NFO\n27 Mar 2026 02:34:43 PMSELL\nOvernightExecutedMarket195/195₹243.26..."
      // OR inline: "NFO 27 Mar 2026 02:34:43 PMSELL OvernightExecuted..."

      // Collect next 3 lines as context (PDF extraction can split differently)
      const context = [lines[i + 1], lines[i + 2], lines[i + 3]].filter(Boolean).join(' ').trim();

      // Match pattern: date time AM/PM immediately followed by BUY/SELL
      // Then: Overnight/Intraday + Executed/Rejected + Market/Limit + qty/qty + ₹price
      const match = context.match(
        /(\d{1,2}\s+\w{3}\s+\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s*(?:AM|PM)?\s*(BUY|SELL)/i
      );

      if (!match) continue;

      const [, dateStr, timeRaw, side] = match;

      // Check if Executed (skip Rejected)
      if (/Rejected/i.test(context)) continue;
      if (!/Executed/i.test(context)) continue;

      // Extract qty/qty and price: "195/195₹243.26" or "195/195 ₹243.26"
      const qtyPriceMatch = context.match(/(\d+)\/(\d+)\s*₹?([\d,.]+)/);
      if (!qtyPriceMatch) continue;

      const tradedQty = parseInt(qtyPriceMatch[1]);
      const price = parseFloat(qtyPriceMatch[3].replace(/,/g, ''));
      if (isNaN(price) || isNaN(tradedQty) || tradedQty === 0) continue;

      // Parse time — check if AM/PM was concatenated with BUY/SELL
      const fullTimeMatch = context.match(/(\d{1,2}):(\d{2}):\d{2}\s*(AM|PM)/i);
      let hour = parseInt(fullTimeMatch?.[1] || timeRaw.split(':')[0]);
      const min = fullTimeMatch?.[2] || timeRaw.split(':')[1] || '00';
      const ampm = fullTimeMatch?.[3]?.toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      const time = `${hour.toString().padStart(2, '0')}:${min}`;

      // Format symbol nicely
      let symbol = line;
      const symMatch = line.match(/(NIFTY|BANKNIFTY|FINNIFTY|SENSEX|MIDCPNIFTY)\w*?(\d{5})(CE|PE)/i);
      if (symMatch) {
        symbol = `${symMatch[1]} ${symMatch[2]} ${symMatch[3]}`;
      }

      trades.push({
        time,
        symbol,
        side: side.toUpperCase(),
        qty: tradedQty,
        price,
        date: dateStr,
      });
    }
  }

  return trades;
}

/* ─── Parse Kotak PDF text ─── */
function parseKotakPDF(text: string): AnyRow[] {
  const trades: AnyRow[] = [];
  // Kotak PDFs have lines like:
  // "12/06/2025 14:13:21 OPTIDXNIFTY 12JUN2025CE 24750.00 - NSEDERV Buy Cash KotakSecurities 150 107.7500 16162.50 6.99 8.42"
  // OR extracted text may have varied spacing. We search for OPTIDXNIFTY patterns.

  // Normalize text: replace multiple spaces/tabs with single space
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const lines = normalized.split('\n');

  // Also try to find rows in fully concatenated text by splitting on date patterns
  // Kotak format: DD/MM/YYYY HH:MM:SS ... Buy/Sell ... Qty ... Price
  const _dateTimePattern = /(\d{2}\/\d{2}\/\d{4})\s*(\d{1,2}:\d{2}:\d{2})/;
  const tradeLinePattern = /(\d{2}\/\d{2}\/\d{4})\s*(\d{1,2}:\d{2}:\d{2})\s+(OPTIDX[A-Z]+\s+\d+[A-Z]+\d+(?:CE|PE)\s+[\d.]+)\s*-?\s*\w*\s*(Buy|Sell)\s+\w+\s+\w+\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i;

  // Strategy 1: Try matching complete lines
  for (const line of lines) {
    const m = line.match(tradeLinePattern);
    if (m) {
      const [, dateStr, timeStr, secName, side, qtyStr, priceStr, , chargesStr, sttStr] = m;
      const qty = parseInt(qtyStr);
      const price = parseFloat(priceStr);
      if (isNaN(qty) || isNaN(price) || qty === 0) continue;

      // Clean symbol: "OPTIDXNIFTY 12JUN2025CE 24750.00" → "NIFTY 24750 CE"
      let symbol = secName.trim();
      const symMatch = symbol.match(/OPTIDX(NIFTY|BANKNIFTY|FINNIFTY)\s*(\d+[A-Z]+\d+)(CE|PE)\s+([\d.]+)/i);
      if (symMatch) {
        symbol = `${symMatch[1]} ${symMatch[4]} ${symMatch[3]}`;
      }

      trades.push({
        time: timeStr,
        symbol,
        side: side.toUpperCase(),
        qty,
        price,
        date: dateStr,
        charges: parseFloat(chargesStr) + parseFloat(sttStr),
      });
      continue;
    }
  }

  // Strategy 2: If no complete lines matched, try flexible parsing
  // PDF extractors sometimes split across lines. Collect all text and re-split on date patterns.
  if (trades.length === 0) {
    const allText = lines.join(' ');
    // Split on date/time patterns
    const chunks = allText.split(/(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/);

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      // Extract fields from each chunk
      const dtm = chunk.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})/);
      if (!dtm) continue;

      const sideMatch = chunk.match(/\b(Buy|Sell)\b/i);
      if (!sideMatch) continue;

      const secMatch = chunk.match(/OPTIDX(NIFTY|BANKNIFTY|FINNIFTY)\s*(\d+[A-Z]*\d*)(CE|PE)\s*([\d.]+)/i);
      if (!secMatch) continue;

      // Find numbers after side: qty, price, total, charges, stt
      const afterSide = chunk.substring(chunk.indexOf(sideMatch[0]) + sideMatch[0].length);
      const numbers = afterSide.match(/[\d.]+/g);
      if (!numbers || numbers.length < 3) continue;

      // Skip "Cash" and "KotakSecurities" text — find qty (integer) and price
      let qty = 0, price = 0;
      for (let ni = 0; ni < numbers.length; ni++) {
        const n = parseFloat(numbers[ni]);
        if (Number.isInteger(n) && n >= 25 && n <= 100000 && qty === 0) {
          qty = n;
        } else if (qty > 0 && price === 0 && n > 0 && n < 1000000) {
          price = n;
          break;
        }
      }
      if (qty === 0 || price === 0) continue;

      const symbol = `${secMatch[1]} ${secMatch[4]} ${secMatch[3]}`;

      trades.push({
        time: dtm[2],
        symbol,
        side: sideMatch[1].toUpperCase(),
        qty,
        price,
        date: dtm[1],
      });
    }
  }

  if (trades.length > 0) {
    console.log(`[Parser] Kotak PDF format detected: ${trades.length} orders`);
  }
  return trades;
}

/* ─── Parse PDF buffer ─── */
async function parsePDFBuffer(buffer: Buffer): Promise<{ text: string; rows: AnyRow[] }> {
  let fullText = '';

  // Try multiple PDF extraction methods
  // Method 1: unpdf
  try {
    const { extractText } = await import('unpdf');
    const uint8 = new Uint8Array(buffer);
    const result = await extractText(uint8);
    if (typeof result === 'string') {
      fullText = result;
    } else if (result && Array.isArray(result.text)) {
      fullText = result.text.join('\n');
    } else if (result && typeof result.text === 'string') {
      fullText = result.text;
    }
    console.log(`[Parser] unpdf extracted ${fullText.length} chars`);
  } catch (e) {
    console.error('[Parser] unpdf failed:', e instanceof Error ? e.message : e);
  }

  // Method 2: If unpdf failed or returned nothing, try pdf-parse
  if (!fullText || fullText.trim().length < 50) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const pdfParse = require('pdf-parse') as any;
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > fullText.trim().length) {
        fullText = data.text;
        console.log(`[Parser] pdf-parse extracted ${fullText.length} chars`);
      }
    } catch (e2) {
      console.error('[Parser] pdf-parse also failed:', e2 instanceof Error ? e2.message : e2);
    }
  }

  // Method 3: Raw buffer text scan (last resort — finds visible ASCII strings)
  if (!fullText || fullText.trim().length < 50) {
    try {
      const raw = buffer.toString('latin1');
      // Extract text between BT/ET operators (PDF text objects)
      const textMatches = raw.match(/\(([^)]+)\)/g);
      if (textMatches && textMatches.length > 10) {
        fullText = textMatches.map(m => m.slice(1, -1)).join(' ');
        console.log(`[Parser] Raw PDF text scan extracted ${fullText.length} chars`);
      }
    } catch (e3) {
      console.error('[Parser] Raw PDF scan failed:', e3 instanceof Error ? e3.message : e3);
    }
  }

  if (!fullText || fullText.trim().length < 20) {
    console.error('[Parser] All PDF extraction methods failed');
    return { text: '', rows: [] };
  }

  if (!fullText || fullText.trim().length < 50) {
    return { text: fullText, rows: [] };
  }

  // Strategy 1a: Try Kotak PDF format (OPTIDXNIFTY, Security Name, TransactionType)
  if (/kotak|OPTIDX|Security.?Name|Transaction.?Type/i.test(fullText)) {
    const kotakTrades = parseKotakPDF(fullText);
    if (kotakTrades.length > 0) {
      return { text: fullText, rows: kotakTrades };
    }
  }

  // Strategy 1b: Try Fyers/Indian broker order book format
  const fyersTrades = parseFyersOrderBook(fullText);
  if (fyersTrades.length > 0) {
    console.log(`[Parser] Fyers format detected: ${fyersTrades.length} orders`);
    return { text: fullText, rows: fyersTrades };
  }

  // Strategy 2: Try generic table parsing
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Tab-delimited
  const tabLines = lines.filter(l => l.includes('\t'));
  if (tabLines.length >= 3) {
    const rows = parseCSVText(tabLines.join('\n'));
    if (rows.length > 0) return { text: fullText, rows };
  }

  // Pipe-delimited
  const pipeLines = lines.filter(l => l.includes('|'));
  if (pipeLines.length >= 3) {
    const csvText = pipeLines.map(l => l.split('|').map(c => c.trim()).join(',')).join('\n');
    const rows = parseCSVText(csvText);
    if (rows.length > 0) return { text: fullText, rows };
  }

  // Multi-space delimited
  const spacedLines = lines.filter(l => /\s{2,}/.test(l) && l.split(/\s{2,}/).length >= 4);
  if (spacedLines.length >= 3) {
    const csvLines = spacedLines.map(l => l.split(/\s{2,}/).map(c => c.trim()).join(','));
    const rows = parseCSVText(csvLines.join('\n'));
    if (rows.length > 0) return { text: fullText, rows };
  }

  // Comma-delimited
  const commaLines = lines.filter(l => l.split(',').length >= 4);
  if (commaLines.length >= 3) {
    const rows = parseCSVText(commaLines.join('\n'));
    if (rows.length > 0) return { text: fullText, rows };
  }

  return { text: fullText, rows: [] };
}

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
      // Images need AI/OCR — return failure so AI handles it
      return {
        success: false,
        broker: 'Unknown',
        market: 'NSE',
        trade_date: new Date().toISOString().split('T')[0],
        currency: 'INR',
        total_trades_in_file: 0,
        kpis: calculateKPIs([]),
        trades: [],
        time_analysis: calculateTimeAnalysis([]),
        error: 'Image files require AI for OCR extraction',
      };
    } else {
      // Try as text
      const text = buffer.toString('utf-8');
      rawText = text;
      rawTrades = parseCSVText(text);
    }

    console.log(`[Parser] Extracted ${rawTrades.length} raw trade rows`);

    if (rawTrades.length === 0) {
      return {
        success: false,
        broker: detectBroker(rawText),
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

    // Pair trades and calculate
    const pairedTrades = pairTrades(rawTrades);
    const kpis = calculateKPIs(pairedTrades);
    const timeAnalysis = calculateTimeAnalysis(pairedTrades);

    console.log(`[Parser] ${pairedTrades.length} paired trades, Net P&L: ${kpis.net_pnl}`);

    return {
      success: true,
      broker: detectBroker(rawText),
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
      broker: detectBroker(rawText),
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
