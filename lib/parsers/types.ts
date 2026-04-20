/**
 * TradeSaath Parser Types and Shared Utilities
 * Defines interfaces and utility functions used across parser modules
 */

// Generic row type - fields vary by broker format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = Record<string, any>;

export interface ParsedTrade {
  index: number;
  time: string;
  date: string; // YYYY-MM-DD from the original trade row (or 'unknown' if missing)
  symbol: string;
  side: string;        // 'BUY' or 'SELL' (direction of the opening leg)
  qty: number;
  entry: number;       // entry price
  exit: number;        // exit price (0 if open/unpaired)
  pnl: number;
  cum_pnl: number;
  session: string;
  time_gap_minutes: number | null;
  tag: string;
  label: string;
  // New fields for full trade context
  entry_time: string;          // HH:MM of the opening leg
  exit_time: string;           // HH:MM of the closing leg ('' if open/unpaired)
  holding_minutes: number;     // exit_time - entry_time in minutes (0 if unknown)
  exchange: string;            // NSE/NFO/BSE etc. ('' if not available)
  trade_id: string;            // broker trade ID for dedup ('' if not available)
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

// Column name patterns for flexible matching
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
  exchange: /^(exchange|segment|market|exch)/i,
  tradeId: /^(trade.?id|order.?id|deal.?id|exec.?id|id)/i,
  expiry: /^(expiry|expiry.?date|exp)/i,
  strike: /^(strike|strike.?price)/i,
  optType: /^(option.?type|opt.?type|ce.?pe|call.?put|instrument.?type)/i,
};

// Market detection
export function detectMarket(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('nse') || t.includes('bse') || t.includes('nifty') || t.includes('banknifty') || t.includes('sensex')) return 'NSE';
  if (t.includes('nyse') || t.includes('nasdaq')) return 'NYSE';
  if (t.includes('forex') || t.includes('fx')) return 'Forex';
  if (t.includes('crypto') || t.includes('btc') || t.includes('eth')) return 'Crypto';
  return 'Unknown';
}

// Currency detection
// NOTE: uses word-boundary regex for 3-letter codes so "European", "Europe", etc.
// don't false-match EUR. Indian-market signals (NSE/BSE/NIFTY/rupee symbol/Indian
// brokers) force INR regardless of stray substrings in option metadata.
export function detectCurrency(text: string): string {
  const t = text.toLowerCase();
  // Indian-market signals take priority — most of our users are Indian brokers
  if (
    /\binr\b/.test(t) ||
    t.includes('\u20B9') || // ₹
    /\brs\.?\b/.test(t) ||
    t.includes('rupee') ||
    /\b(nse|bse|nifty|sensex|bank\s*nifty)\b/.test(t) ||
    /\b(zerodha|upstox|groww|angel|icici\s*direct|hdfc\s*sec|kotak\s*sec|5paisa|sharekhan|dhan|fyers|alice\s*blue|paytm\s*money|motilal|iifl)\b/.test(t)
  ) return 'INR';
  if (/\busd\b/.test(t) || t.includes('$')) return 'USD';
  if (/\beur\b/.test(t) || t.includes('\u20AC')) return 'EUR';
  if (/\bgbp\b/.test(t) || t.includes('\u00A3')) return 'GBP';
  if (/\bjpy\b/.test(t) || t.includes('yen') || t.includes('\u00A5')) return 'JPY';
  return '';  // Let downstream infer from detected market
}

// Date detection
export function detectDate(text: string): string {
  const patterns = [/(\d{4}[-/]\d{2}[-/]\d{2})/, /(\d{2}[-/]\d{2}[-/]\d{4})/, /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const d = m[1];
      if (/^\d{4}/.test(d)) return d.replace(/\//g, '-');
      const parts = d.split(/[-/]/);
      if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      return d;
    }
  }
  return new Date().toISOString().split('T')[0];
}

// Session classification
export function classifySession(time: string): string {
  const [h] = time.split(':').map(Number);
  if (isNaN(h)) return 'morning';
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  return 'afternoon';
}

// Time gap in minutes
export function timeGapMinutes(t1: string, t2: string): number | null {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return isNaN(h) || isNaN(m) ? null : h * 60 + m;
  };
  const m1 = parse(t1);
  const m2 = parse(t2);
  if (m1 === null || m2 === null) return null;
  return Math.abs(m2 - m1);
}

// Map header columns to known field types
export function mapColumns(headers: string[]): Record<string, number> {
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

// Normalize a date string into YYYY-MM-DD (best effort)
function normalizeDateStr(raw: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // Already YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return undefined;
}

// Parse a single row into a raw trade
export function parseRow(row: string[], colMap: Record<string, number>): AnyRow | null {
  const get = (key: string) => {
    const idx = colMap[key];
    if (idx !== undefined && idx < row.length) {
      const val = row[idx];
      return val ? val.trim() : undefined;
    }
    return undefined;
  };

  const getNum = (key: string) => {
    const v = get(key);
    if (v === undefined) return undefined;
    const cleaned = v.replace(/,/g, '');
    const withNegatives = cleaned.replace(/[()]/g, (m) => m === '(' ? '-' : '');
    const n = parseFloat(withNegatives);
    return isNaN(n) ? undefined : n;
  };

  const symbol = get('symbol');
  if (symbol === undefined || symbol === null) return null;
  if (/^(total|grand|sub|net|sum)/i.test(symbol)) return null;

  const result: AnyRow = { symbol };
  const timeVal = get('time');
  if (timeVal) {
    const tm = timeVal.match(/(\d{1,2}:\d{2})/);
    result.time = tm ? tm[1] : timeVal;
    const isoDate = timeVal.match(/(\d{4}-\d{2}-\d{2})/);
    const ddmmDate = timeVal.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
    if (isoDate) result.date = isoDate[1];
    else if (ddmmDate) {
      const norm = normalizeDateStr(ddmmDate[1]);
      if (norm) result.date = norm;
    }
  }

  if (result.date === undefined) {
    const dateVal = get('date');
    if (dateVal) {
      const serial = parseFloat(dateVal);
      if (!isNaN(serial) && serial > 40000 && serial < 60000) {
        const epoch = new Date(Date.UTC(1899, 11, 30));
        const d = new Date(epoch.getTime() + serial * 86400000);
        result.date = d.toISOString().split('T')[0];
      } else {
        const norm = normalizeDateStr(dateVal);
        result.date = norm || dateVal;
      }
    }
  }

  const side = get('side');
  if (side) {
    result.side = /^(b|buy|long)/i.test(side.trim()) ? 'BUY' : 'SELL';
  }

  result.qty = getNum('qty');
  result.price = getNum('price');
  result.amount = getNum('amount');
  result.pnl = getNum('pnl');

  result.buyQty = getNum('buyQty');
  result.sellQty = getNum('sellQty');
  result.buyPrice = getNum('buyPrice');
  result.sellPrice = getNum('sellPrice');

  if (result.side === undefined) {
    if (result.buyQty && result.buyQty > 0) result.side = 'BUY';
    else if (result.sellQty && result.sellQty > 0) result.side = 'SELL';
  }
  if (result.qty === undefined) {
    result.qty = result.buyQty || result.sellQty;
  }
  if (result.price === undefined) {
    result.price = result.side === 'BUY' ? result.buyPrice : result.sellPrice;
  }

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

  // Extract exchange and trade ID when available
  const exchange = get('exchange');
  if (exchange) result.exchange = exchange;
  const tradeId = get('tradeId');
  if (tradeId) result.trade_id = tradeId;

  if (result.symbol && /OPTIDX/i.test(result.symbol)) {
    result.symbol = result.symbol.replace(/OPTIDX/i, '').replace(/\s+/g, ' ').trim();
  }

  return result;
}
