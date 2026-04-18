/**
 * TradeSaath Trade Pairer (Intake Module)
 * FIFO pairs buy/sell within (symbol + date) buckets.
 * Returns StandardTrade[] with references back to raw row indices.
 *
 * RULE: A BUY on Jan 5 must NEVER match a SELL on Jan 12.
 */

import { RawTradeRow, StandardTrade } from './types';
import { normalizeDate, normalizeTime } from './rawExtractor';

const UNKNOWN_DATE = 'unknown';

/** Parse a numeric value from a raw string, handling commas and parens */
function parseNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/[()]/g, (m) => m === '(' ? '-' : '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Normalize side string to BUY or SELL */
function normSide(raw: string | undefined): 'BUY' | 'SELL' | undefined {
  if (!raw) return undefined;
  return /^(b|buy|long)/i.test(raw.trim()) ? 'BUY' : 'SELL';
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
  date: string;
  time: string;
  exchange: string;
  tradeId: string;
}

/** Prepare raw rows for pairing */
function prepareRows(rawRows: RawTradeRow[]): PreparedRow[] {
  const prepared: PreparedRow[] = [];

  for (const row of rawRows) {
    const m = row.mapped;
    const symbol = m.symbol;
    if (!symbol) continue;

    const side = normSide(m.side);
    const qty = parseNum(m.qty);
    const price = parseNum(m.price);
    const date = m.date ? normalizeDate(m.date) : UNKNOWN_DATE;
    const time = m.time ? normalizeTime(m.time) : '';
    const pnlStr = m.pnl;
    const pnl = pnlStr ? parseNum(pnlStr) : undefined;

    // If no side, try to infer from context
    if (!side && qty <= 0 && !pnl) continue;

    prepared.push({
      rowIndex: row.rowIndex,
      symbol: symbol.toLowerCase().replace(/\s+/g, ' ').trim(),
      side: side || 'BUY',
      qty: qty || 1,
      price,
      pnl,
      date,
      time,
      exchange: m.exchange || '',
      tradeId: m.tradeId || '',
    });
  }

  return prepared;
}

/**
 * Pair raw trade rows into StandardTrade[].
 * Uses FIFO matching within (symbol + date) groups.
 */
export function pairRawTrades(rawRows: RawTradeRow[]): StandardTrade[] {
  const prepared = prepareRows(rawRows);

  // Group by symbol + date
  const groups: Record<string, PreparedRow[]> = {};
  for (const t of prepared) {
    const key = `${t.symbol}|${t.date}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const paired: StandardTrade[] = [];

  for (const [, trades] of Object.entries(groups)) {
    // Sort by time within group
    trades.sort((a, b) => {
      const ta = (a.time || '00:00').replace(/:/g, '');
      const tb = (b.time || '00:00').replace(/:/g, '');
      return parseInt(ta) - parseInt(tb);
    });

    const groupDate = trades[0].date;
    const buys = trades.filter(t => t.side === 'BUY');
    const sells = trades.filter(t => t.side === 'SELL');

    // Detect shorts: first chronological trade is SELL
    const firstTrade = trades[0];
    const isShort = firstTrade.side === 'SELL' && sells.length > 0 && buys.length > 0;

    const openers = isShort ? sells : buys;
    const closers = isShort ? buys : sells;

    // FIFO matching
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

      const pnl = isShort
        ? Math.round((entryPrice - exitPrice) * matchQty * 100) / 100
        : Math.round((exitPrice - entryPrice) * matchQty * 100) / 100;

      const entryTime = normalizeTime(open.time);
      const exitTime = normalizeTime(close.time);

      const openNum = parseInt((open.time || '00:00').replace(/:/g, ''));
      const closeNum = parseInt((close.time || '00:00').replace(/:/g, ''));
      const closingTime = closeNum >= openNum ? close.time : open.time;
      const normalizedClosingTime = normalizeTime(closingTime);

      // Use the original (un-lowercased) symbol from the raw row
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
        paired.push({
          index: 0,
          symbol: origSymbol,
          side: t.side,
          qty: t.remaining || t.qty,
          entryPrice: t.price,
          exitPrice: 0,
          pnl: hasPnl ? (t.pnl as number) : 0,
          cumPnl: 0,
          date: t.date,
          entryTime: time,
          exitTime: '',
          holdingMinutes: 0,
          session: classifySession(time),
          timeGapMinutes: null,
          tag: hasPnl ? ((t.pnl as number) >= 0 ? 'win' : 'loss') : 'open',
          label: hasPnl ? ((t.pnl as number) >= 0 ? 'Winner' : 'Loser') : 'Open Position',
          exchange: t.exchange,
          tradeId: t.tradeId,
          sourceRows: [t.rowIndex],
          isShort: false,
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
          date: m.date ? normalizeDate(m.date) : UNKNOWN_DATE,
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
