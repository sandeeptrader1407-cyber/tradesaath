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

/* ─── Pair buy/sell orders for same instrument on the same day ─── */
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

    // FIFO matching: match buy qty with sell qty in chronological order
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
        time: closingTime || '',
        date: groupDate,
        symbol: buy.symbol || sell.symbol,
        side: 'BUY',
        qty: matchQty,
        entry,
        exit,
        pnl,
        cum_pnl: 0,
        session: classifySession(closingTime || ''),
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
          time: t.time || '',
          date: dateOf(t),
          symbol: t.symbol,
          side: t.side || 'BUY',
          qty: t.remaining || t.qty || 1,
          entry: t.price || 0,
          exit: 0,
          pnl: t.pnl,
          cum_pnl: 0,
          session: classifySession(t.time || ''),
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
