/**
 * TradeSaath Trade Pairer (Intake Module)
 * FIFO pairs buy/sell within (symbol + date) buckets.
 * Returns StandardTrade[] with references back to raw row indices.
 *
 * RULE: A BUY on Jan 5 must NEVER match a SELL on Jan 12.
 */

import { RawTradeRow, StandardTrade } from './types';
import { normalizeDate, normalizeTime, cleanNumeric } from './rawExtractor';

/**
 * Compute a unique signature for a trade — used for deduplication.
 * Uses broker tradeId if available, otherwise falls back to a composite key.
 */
export function computeTradeSignature(trade: {
  tradeId?: string; trade_id?: string;
  date?: string; trade_date?: string;
  entryTime?: string; entry_time?: string; time?: string;
  symbol?: string;
  side?: string;
  quantity?: number; qty?: number;
  entryPrice?: number; entry_price?: number; price?: number;
  exitPrice?: number; exit_price?: number;
  // Raw row indices the trade was built from. When present, they make two
  // legitimate fills with identical time/price/qty distinguishable — prevents
  // intra-batch dedup from silently eating partial fills that share a timestamp.
  sourceRows?: number[];
}): string {
  // Use broker's tradeId if available (most reliable)
  const tid = trade.tradeId || trade.trade_id;
  if (tid && String(tid).length > 3) {
    return `tid:${tid}`;
  }
  // Fallback: composite key unlikely to repeat by accident
  const date = (trade.date || trade.trade_date || '').substring(0, 10);
  const rawTime = trade.entryTime || trade.entry_time || trade.time || '';
  // Normalize time to HH:MM (strip seconds for consistency)
  const time = rawTime.length > 5 ? rawTime.substring(0, 5) : rawTime;
  const sym = (trade.symbol || '').toUpperCase().replace(/\s+/g, '');
  const side = (trade.side || '').toUpperCase();
  const qty = trade.quantity || trade.qty || 0;
  const entry = trade.entryPrice || trade.entry_price || trade.price || 0;
  const exit = trade.exitPrice || trade.exit_price || 0;
  // Include sourceRows so trades derived from DIFFERENT raw rows never collide,
  // even if broker recorded two identical-timestamp partial fills. Re-uploads of
  // the same file still match because rowIndex is stable per file content (and
  // file_hash dedup upstream blocks the re-upload before this ever runs).
  const rows = Array.isArray(trade.sourceRows) && trade.sourceRows.length > 0
    ? trade.sourceRows.slice().sort((a, b) => a - b).join(',')
    : '';
  return [date, time, sym, side, qty, entry.toFixed(2), exit.toFixed(2), rows].join('|');
}

/**
 * Deduplicate trades: remove trades whose signature matches an existing set.
 * Returns { unique, skipped } counts.
 */
export function deduplicateTrades<T extends Record<string, unknown>>(
  newTrades: T[],
  existingTrades: T[],
): { unique: T[]; skipped: number } {
  const existingSigs = new Set(
    existingTrades.map(t => computeTradeSignature(t as Parameters<typeof computeTradeSignature>[0]))
  );
  const unique: T[] = [];
  let skipped = 0;
  for (const t of newTrades) {
    const sig = computeTradeSignature(t as Parameters<typeof computeTradeSignature>[0]);
    if (existingSigs.has(sig)) {
      skipped++;
    } else {
      unique.push(t);
      existingSigs.add(sig); // prevent intra-batch duplicates too
    }
  }
  return { unique, skipped };
}

const UNKNOWN_DATE = 'unknown';

/** Parse a numeric value from a raw string, handling all formats */
function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = cleanNumeric(val);
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Normalize side string to BUY or SELL.
 *
 * FIX (audit N3 — 2026-05-04): explicit recognition of trade codes plus
 * null return for non-trade Robinhood/IBKR transaction codes (ACH/AFEE/INT/
 * DIVT/DTAX/DFEE/OFEE/etc.). Null is the contract for "this isn't a trade
 * row" — upstream prepareRows skips it silently.
 *
 * Returns:
 *   undefined → no value supplied (column missing on this row)
 *   null      → value supplied but not a trade code (drop the row)
 *   'BUY'/'SELL' → recognised trade
 */
function normSide(raw: string | undefined): 'BUY' | 'SELL' | null | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toUpperCase();
  if (!s) return undefined;
  // Explicit trade codes (covers BUY / SELL / B / S / LONG / SHORT plus
  // option-style Robinhood codes BTO/STC/BTC/STO).
  if (s === 'BUY' || s === 'B' || s === 'BTO' || s === 'BTC' || s === 'LONG') return 'BUY';
  if (s === 'SELL' || s === 'S' || s === 'STO' || s === 'STC' || s === 'SHORT') return 'SELL';
  // Prefix tolerance for verbose values like "Buy To Open" / "Sell 100 shares".
  if (/^(BUY|LONG)\b/.test(s)) return 'BUY';
  if (/^(SELL|SHORT)\b/.test(s)) return 'SELL';
  // Anything else (ACH, DIV, INT, DTAX, AFEE, DFEE, OFEE, etc.) is a
  // non-trade activity row — return null so prepareRows can skip it.
  return null;
}

/** Classify time into session */
function classifySession(time: string): string {
  const [h] = time.split(':').map(Number);
  if (isNaN(h)) return 'morning';
  if (h < 11) return 'morning';
  if (h < 14) return 'midday';
  return 'afternoon';
}

/** Compute holding time in minutes */
function holdingMinutes(entryTime: string, exitTime: string): number {
  const parse = (t: string) => {
    const parts = t.split(':').map(Number);
    return (isNaN(parts[0]) || isNaN(parts[1])) ? null : parts[0] * 60 + parts[1];
  };
  const a = parse(entryTime);
  const b = parse(exitTime);
  if (a === null || b === null) return 0;
  const diff = b - a;
  return diff >= 0 ? diff : 0;
}

/** Time gap in minutes between two HH:MM strings */
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

interface PreparedRow {
  rowIndex: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  pnl: number | undefined;
  fees: number;
  date: string;
  time: string;
  exchange: string;
  tradeId: string;
  /** Pre-paired: entry price from same row */
  entryPriceRaw: number;
  /** Pre-paired: exit price from same row */
  exitPriceRaw: number;
  /** Whether this row is pre-paired (has both entry and exit price) */
  isPrePaired: boolean;
}

/** Prepare raw rows for pairing */
function prepareRows(rawRows: RawTradeRow[], market?: string): PreparedRow[] {
  const prepared: PreparedRow[] = [];

  for (const row of rawRows) {
    const m = row.mapped;
    const symbol = m.symbol;
    if (!symbol) continue;

    const side = normSide(m.side);
    const qty = parseNum(m.qty);
    const price = parseNum(m.price);
    const date = m.date ? normalizeDate(m.date, market) : UNKNOWN_DATE;
    const time = m.time ? normalizeTime(m.time) : '';
    const pnlStr = m.pnl;
    const pnl = pnlStr ? parseNum(pnlStr) : undefined;
    const fees = parseNum(m.fees);

    // Pre-paired: entry/exit prices on the same row
    const entryPriceRaw = parseNum(m.entryPrice);
    const exitPriceRaw = parseNum(m.exitPrice);
    const isPrePaired = entryPriceRaw > 0 && exitPriceRaw > 0;

    // FIX (audit N3 — 2026-05-04): explicit non-trade rows (Robinhood ACH /
    // DIVT / DTAX / INT / AFEE / DFEE etc.) are skipped silently. normSide
    // returns null when the value is a recognised non-trade code; undefined
    // means "no side column on this row" (existing fallback continues).
    if (m.side && side === null) continue;

    if (!side && qty <= 0 && !pnl) continue;

    prepared.push({
      rowIndex: row.rowIndex,
      symbol: symbol.toLowerCase().replace(/\s+/g, ' ').trim(),
      side: side || 'BUY',
      qty: qty || 1,
      price,
      pnl,
      fees,
      date,
      time,
      exchange: m.exchange || '',
      tradeId: m.tradeId || '',
      entryPriceRaw,
      exitPriceRaw,
      isPrePaired,
    });
  }

  return prepared;
}

/**
 * Build trades from pre-paired rows (each row has entry + exit price).
 * No FIFO matching needed — each row IS a complete trade.
 */
function buildPrePairedTrades(prepared: PreparedRow[], rawRows: RawTradeRow[]): StandardTrade[] {
  const paired: StandardTrade[] = [];

  for (const t of prepared) {
    const entryPrice = t.isPrePaired ? t.entryPriceRaw : t.price;
    const exitPrice = t.isPrePaired ? t.exitPriceRaw : 0;
    const isShort = t.side === 'SELL';

    // Use provided P&L or compute from prices
    let pnl: number;
    if (t.pnl !== undefined) {
      pnl = t.pnl;
    } else if (exitPrice > 0) {
      pnl = isShort
        ? Math.round((entryPrice - exitPrice) * t.qty * 100) / 100
        : Math.round((exitPrice - entryPrice) * t.qty * 100) / 100;
    } else {
      pnl = 0;
    }

    const entryTime = normalizeTime(t.time);
    const origSymbol = rawRows.find(r => r.rowIndex === t.rowIndex)?.mapped.symbol || t.symbol;

    paired.push({
      index: 0,
      symbol: origSymbol,
      side: t.side,
      qty: t.qty,
      entryPrice,
      exitPrice,
      pnl,
      cumPnl: 0,
      date: t.date,
      entryTime,
      exitTime: '',
      holdingMinutes: 0,
      session: classifySession(entryTime),
      timeGapMinutes: null,
      tag: exitPrice > 0 ? (pnl >= 0 ? 'win' : 'loss') : 'open',
      label: exitPrice > 0 ? (pnl >= 0 ? 'Winner' : 'Loser') : 'Open Position',
      exchange: t.exchange,
      tradeId: t.tradeId,
      sourceRows: [t.rowIndex],
      isShort,
      fees: t.fees,
    });
  }

  // Sort by date then time
  paired.sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === UNKNOWN_DATE) return 1;
      if (b.date === UNKNOWN_DATE) return -1;
      return a.date.localeCompare(b.date);
    }
    const ta = (a.entryTime || '').replace(/:/g, '');
    const tb = (b.entryTime || '').replace(/:/g, '');
    return parseInt(ta || '0') - parseInt(tb || '0');
  });

  // Set indices, cumPnl, time gaps
  let cumPnl = 0;
  for (let i = 0; i < paired.length; i++) {
    paired[i].index = i;
    cumPnl += paired[i].pnl;
    paired[i].cumPnl = Math.round(cumPnl * 100) / 100;
    if (i > 0 && paired[i].date === paired[i - 1].date) {
      const prevTime = paired[i - 1].exitTime || paired[i - 1].entryTime;
      paired[i].timeGapMinutes = timeGapMinutes(prevTime, paired[i].entryTime);
    }
  }

  return paired;
}

/**
 * Pair raw trade rows into StandardTrade[].
 * Uses FIFO matching within (symbol + date) groups.
 */
export function pairRawTrades(rawRows: RawTradeRow[], market?: string): StandardTrade[] {
  const prepared = prepareRows(rawRows, market);

  // ── Pre-paired detection ──
  // If most rows have both entry and exit prices, treat as pre-paired CSV
  const prePairedRows = prepared.filter(t => t.isPrePaired);
  const isPrePairedFile = prePairedRows.length > 0 && prePairedRows.length >= prepared.length * 0.5;

  if (isPrePairedFile) {
    return buildPrePairedTrades(prepared, rawRows);
  }

  // Group by symbol + date
  const groups: Record<string, PreparedRow[]> = {};
  for (const t of prepared) {
    const key = `${t.symbol}|${t.date}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const paired: StandardTrade[] = [];

  for (const [, trades] of Object.entries(groups)) {
    trades.sort((a, b) => {
      const ta = (a.time || '00:00').replace(/:/g, '');
      const tb = (b.time || '00:00').replace(/:/g, '');
      return parseInt(ta) - parseInt(tb);
    });

    const groupDate = trades[0].date;
    const buys = trades.filter(t => t.side === 'BUY');
    const sells = trades.filter(t => t.side === 'SELL');

    const firstTrade = trades[0];
    const isShort = firstTrade.side === 'SELL' && sells.length > 0 && buys.length > 0;

    const openers = isShort ? sells : buys;
    const closers = isShort ? buys : sells;

    const openQ = openers.map(o => ({ ...o, remaining: o.qty }));
    const closeQ = closers.map(c => ({ ...c, remaining: c.qty }));

    let oi = 0, ci = 0;
    while (oi < openQ.length && ci < closeQ.length) {
      const open = openQ[oi];
      const close = closeQ[ci];
      if (open.remaining <= 0) { oi++; continue; }
      if (close.remaining <= 0) { ci++; continue; }

      const matchQty = Math.min(open.remaining, close.remaining);
      const entryPrice = open.price;
      const exitPrice = close.price;

      const grossPnl = isShort
        ? (entryPrice - exitPrice) * matchQty
        : (exitPrice - entryPrice) * matchQty;
      const tradeFees = Math.round((open.fees + close.fees) * 100) / 100;
      const pnl = Math.round((grossPnl - tradeFees) * 100) / 100;

      const entryTime = normalizeTime(open.time);
      const exitTime = normalizeTime(close.time);

      const openNum = parseInt((open.time || '00:00').replace(/:/g, ''));
      const closeNum = parseInt((close.time || '00:00').replace(/:/g, ''));
      const closingTime = closeNum >= openNum ? close.time : open.time;
      const normalizedClosingTime = normalizeTime(closingTime);

      const origSymbol = rawRows.find(r => r.rowIndex === open.rowIndex)?.mapped.symbol
        || rawRows.find(r => r.rowIndex === close.rowIndex)?.mapped.symbol
        || open.symbol;

      paired.push({
        index: 0,
        symbol: origSymbol,
        side: isShort ? 'SELL' : 'BUY',
        qty: matchQty,
        entryPrice,
        exitPrice,
        pnl,
        cumPnl: 0,
        date: groupDate,
        entryTime,
        exitTime,
        holdingMinutes: holdingMinutes(entryTime, exitTime),
        session: classifySession(normalizedClosingTime),
        timeGapMinutes: null,
        tag: pnl >= 0 ? 'win' : 'loss',
        label: pnl >= 0 ? 'Winner' : 'Loser',
        exchange: open.exchange || close.exchange,
        tradeId: open.tradeId || close.tradeId,
        sourceRows: [open.rowIndex, close.rowIndex],
        isShort,
        fees: Math.round((open.fees + close.fees) * 100) / 100,
      });

      open.remaining -= matchQty;
      close.remaining -= matchQty;
      if (open.remaining <= 0) oi++;
      if (close.remaining <= 0) ci++;
    }

    // Handle unpaired (open positions or rows with direct P&L)
    const allRemaining = [
      ...openQ.filter(o => o.remaining > 0),
      ...closeQ.filter(c => c.remaining > 0),
    ];
    for (const t of allRemaining) {
      const hasPnl = t.pnl !== undefined;
      if (hasPnl || t.remaining > 0) {
        const origSymbol = rawRows.find(r => r.rowIndex === t.rowIndex)?.mapped.symbol || t.symbol;
        const time = normalizeTime(t.time);
        // FIX (audit N2 — 2026-05-04): tag honours exit-price guard. Unpaired
        // rows have no exit, so exitPrice=0 → 'open' regardless of any pnl
        // value the broker may have populated (e.g. IBKR's MtmPnl=0 used to
        // produce tag='win' / label='Winner' on unclosed positions).
        const exitPrice = 0;
        const tradePnl = hasPnl ? (t.pnl as number) : 0;
        paired.push({
          index: 0,
          symbol: origSymbol,
          side: t.side,
          qty: t.remaining || t.qty,
          entryPrice: t.price,
          exitPrice,
          pnl: tradePnl,
          cumPnl: 0,
          date: t.date,
          entryTime: time,
          exitTime: '',
          holdingMinutes: 0,
          session: classifySession(time),
          timeGapMinutes: null,
          tag: exitPrice === 0 ? 'open' : (tradePnl >= 0 ? 'win' : 'loss'),
          label: exitPrice === 0 ? 'Open Position' : (tradePnl >= 0 ? 'Winner' : 'Loser'),
          exchange: t.exchange,
          tradeId: t.tradeId,
          sourceRows: [t.rowIndex],
          isShort: false,
          fees: t.fees,
        });
      }
    }
  }

  // Fallback: if no pairing, use raw rows with P&L directly
  if (paired.length === 0 && rawRows.length > 0) {
    const withPnl = rawRows.filter(r => r.mapped.pnl !== undefined);
    if (withPnl.length > 0) {
      for (const row of withPnl) {
        const m = row.mapped;
        const pnl = parseNum(m.pnl);
        const time = m.time ? normalizeTime(m.time) : '';
        paired.push({
          index: 0,
          symbol: m.symbol || 'Unknown',
          side: normSide(m.side) || 'BUY',
          qty: parseNum(m.qty) || 1,
          entryPrice: parseNum(m.price),
          exitPrice: 0,
          pnl,
          cumPnl: 0,
          date: m.date ? normalizeDate(m.date, market) : UNKNOWN_DATE,
          entryTime: time,
          exitTime: '',
          holdingMinutes: 0,
          session: classifySession(time),
          timeGapMinutes: null,
          tag: pnl >= 0 ? 'win' : 'loss',
          label: pnl >= 0 ? 'Winner' : 'Loser',
          exchange: m.exchange || '',
          tradeId: m.tradeId || '',
          sourceRows: [row.rowIndex],
          isShort: false,
          fees: parseNum(m.fees),
        });
      }
    }
  }

  // Sort by date then time
  paired.sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === UNKNOWN_DATE) return 1;
      if (b.date === UNKNOWN_DATE) return -1;
      return a.date.localeCompare(b.date);
    }
    const ta = (a.entryTime || '').replace(/:/g, '');
    const tb = (b.entryTime || '').replace(/:/g, '');
    return parseInt(ta || '0') - parseInt(tb || '0');
  });

  // Set indices, cumPnl, time gaps
  let cumPnl = 0;
  for (let i = 0; i < paired.length; i++) {
    paired[i].index = i;
    cumPnl += paired[i].pnl;
    paired[i].cumPnl = Math.round(cumPnl * 100) / 100;
    if (i > 0 && paired[i].date === paired[i - 1].date) {
      const prevTime = paired[i - 1].exitTime || paired[i - 1].entryTime;
      paired[i].timeGapMinutes = timeGapMinutes(prevTime, paired[i].entryTime);
    }
  }

  return paired;
}
