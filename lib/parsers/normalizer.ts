/**
 * Trade Normalizer for TradeSaath
 * Pairs buy/sell trades and calculates trade metrics.
 *
 * IMPORTANT: trades are paired within (symbol + date) buckets only.
 * A BUY on Jan 5 must NEVER be FIFO-matched against a SELL on Jan 12 —
 * doing so produces nonsense P&L for multi-day broker statements.
 */

import { AnyRow, ParsedTrade, classifySession, timeGapMinutes } from './types';

const UNKNOWN_DATE = 'unknown';

function dateOf(row: AnyRow): string {
  const d = row?.date;
  if (typeof d === 'string' && d.length > 0) return d;
  return UNKNOWN_DATE;
}

/** Compute holding time in minutes between two HH:MM strings */
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

/* --- Pair buy/sell orders for same instrument on the same day --- */
export function pairTrades(rawTrades: AnyRow[]): ParsedTrade[] {
  // Group by symbol + date so cross-day pairing is impossible.
  const groups: Record<string, AnyRow[]> = {};
  for (const t of rawTrades) {
    const symKey = (t.symbol || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const key = `${symKey}|${dateOf(t)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const paired: ParsedTrade[] = [];

  for (const [, trades] of Object.entries(groups)) {
    // Sort by time within each (symbol + date) group
    trades.sort((a, b) => {
      const ta = (a.time || '00:00:00').replace(/:/g, '');
      const tb = (b.time || '00:00:00').replace(/:/g, '');
      return parseInt(ta) - parseInt(tb);
    });

    const groupDate = dateOf(trades[0]);

    const buys = trades.filter(t => t.side === 'BUY');
    const sells = trades.filter(t => t.side === 'SELL');

    // Detect if this is a short-first group: first chronological trade is a SELL
    const firstTrade = trades[0];
    const isShort = firstTrade && firstTrade.side === 'SELL' && sells.length > 0 && buys.length > 0;

    // For shorts: entry = sell, exit = buy  |  For longs: entry = buy, exit = sell
    const openers = isShort ? sells : buys;
    const closers = isShort ? buys : sells;

    // FIFO matching
    const openQ: (AnyRow & { remaining: number })[] = openers.map(o => ({ ...o, remaining: o.qty || 0 }));
    const closeQ: (AnyRow & { remaining: number })[] = closers.map(c => ({ ...c, remaining: c.qty || 0 }));

    let oi = 0, ci = 0;
    while (oi < openQ.length && ci < closeQ.length) {
      const open = openQ[oi];
      const close = closeQ[ci];
      if (open.remaining <= 0) { oi++; continue; }
      if (close.remaining <= 0) { ci++; continue; }

      const matchQty = Math.min(open.remaining, close.remaining);
      const entryPrice = open.price || 0;
      const exitPrice = close.price || 0;

      // P&L: for longs (exit - entry) * qty, for shorts (entry - exit) * qty
      const pnl = isShort
        ? Math.round((entryPrice - exitPrice) * matchQty * 100) / 100
        : Math.round((exitPrice - entryPrice) * matchQty * 100) / 100;

      const entryTime = open.time || '';
      const exitTime = close.time || '';

      // Determine which came second chronologically for the "time" field
      const openNum = parseInt((open.time || '00:00').replace(/:/g, ''));
      const closeNum = parseInt((close.time || '00:00').replace(/:/g, ''));
      const closingTime = closeNum >= openNum ? close.time : open.time;

      paired.push({
        index: 0,
        time: closingTime || '',
        date: groupDate,
        symbol: open.symbol || close.symbol,
        side: isShort ? 'SELL' : 'BUY',
        qty: matchQty,
        entry: entryPrice,
        exit: exitPrice,
        pnl,
        cum_pnl: 0,
        session: classifySession(closingTime || ''),
        time_gap_minutes: holdingMinutes(entryTime, exitTime) || null,
        tag: pnl >= 0 ? 'win' : 'loss',
        label: pnl >= 0 ? 'Winner' : 'Loser',
        entry_time: entryTime,
        exit_time: exitTime,
        holding_minutes: holdingMinutes(entryTime, exitTime),
        exchange: open.exchange || close.exchange || '',
        trade_id: open.trade_id || close.trade_id || '',
      });

      open.remaining -= matchQty;
      close.remaining -= matchQty;
      if (open.remaining <= 0) oi++;
      if (close.remaining <= 0) ci++;
    }

    // Handle unpaired trades (open positions or trades with direct P&L)
    const allRemaining = [
      ...openQ.filter(o => o.remaining > 0),
      ...closeQ.filter(c => c.remaining > 0),
    ];
    for (const t of allRemaining) {
      // Include if they have P&L data, or flag as open position
      const hasPnl = t.pnl !== undefined;
      if (hasPnl || t.remaining > 0) {
        paired.push({
          index: 0,
          time: t.time || '',
          date: dateOf(t),
          symbol: t.symbol,
          side: t.side || 'BUY',
          qty: t.remaining || t.qty || 1,
          entry: t.price || 0,
          exit: 0,
          pnl: hasPnl ? t.pnl : 0,
          cum_pnl: 0,
          session: classifySession(t.time || ''),
          time_gap_minutes: null,
          tag: hasPnl ? (t.pnl >= 0 ? 'win' : 'loss') : 'open',
          label: hasPnl ? (t.pnl >= 0 ? 'Winner' : 'Loser') : 'Open Position',
          entry_time: t.time || '',
          exit_time: '',
          holding_minutes: 0,
          exchange: t.exchange || '',
          trade_id: t.trade_id || '',
        });
      }
    }
  }

  // If no pairing worked, try using raw trades directly (some reports have P&L per row)
  if (paired.length === 0 && rawTrades.length > 0 && rawTrades.some(t => t.pnl !== undefined)) {
    for (const t of rawTrades) {
      paired.push({
        index: 0,
        time: t.time || '',
        date: dateOf(t),
        symbol: t.symbol,
        side: t.side || 'BUY',
        qty: t.qty || 1,
        entry: t.price || 0,
        exit: 0,
        pnl: t.pnl || 0,
        cum_pnl: 0,
        session: classifySession(t.time || ''),
        time_gap_minutes: null,
        tag: (t.pnl || 0) >= 0 ? 'win' : 'loss',
        label: (t.pnl || 0) >= 0 ? 'Winner' : 'Loser',
        entry_time: t.time || '',
        exit_time: '',
        holding_minutes: 0,
        exchange: t.exchange || '',
        trade_id: t.trade_id || '',
      });
    }
  }

  // Sort by date then time so multi-day statements come out chronologically
  paired.sort((a, b) => {
    if (a.date !== b.date) {
      // 'unknown' dates go to the end
      if (a.date === UNKNOWN_DATE) return 1;
      if (b.date === UNKNOWN_DATE) return -1;
      return a.date.localeCompare(b.date);
    }
    const ta = (a.time || '').replace(/:/g, '');
    const tb = (b.time || '').replace(/:/g, '');
    return parseInt(ta || '0') - parseInt(tb || '0');
  });

  // Set indices, cum_pnl, time gaps (gaps only meaningful within same day)
  let cumPnl = 0;
  for (let i = 0; i < paired.length; i++) {
    paired[i].index = i;
    cumPnl += paired[i].pnl;
    paired[i].cum_pnl = Math.round(cumPnl * 100) / 100;
    if (i > 0 && paired[i].date === paired[i - 1].date) {
      paired[i].time_gap_minutes = timeGapMinutes(paired[i - 1].time, paired[i].time);
    } else {
      paired[i].time_gap_minutes = null;
    }
  }

  return paired;
}
