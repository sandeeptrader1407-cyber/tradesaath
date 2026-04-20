/**
 * TradeSaath Claude Trade Pairer
 * Pairs BUY/SELL trades from Claude AI extraction and computes P&L.
 *
 * Claude often returns individual legs (one BUY row, one SELL row) from
 * contract notes. This module pairs them by symbol + date using FIFO
 * and computes P&L = (exit - entry) * qty for BUY, (entry - exit) * qty for SELL.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTrade = Record<string, any>;

/**
 * Check if Claude-extracted trades need pairing.
 * Returns true if most trades have pnl === null/undefined and
 * there are matching BUY/SELL pairs on the same symbol.
 */
export function tradesNeedPairing(trades: AnyTrade[]): boolean {
  if (trades.length < 2) return false;

  // Count trades with null/undefined/0 pnl
  const nullPnlCount = trades.filter(
    t => t.pnl === null || t.pnl === undefined
  ).length;

  // If more than 60% have null pnl, they likely need pairing
  if (nullPnlCount / trades.length < 0.6) return false;

  // Check if there are matching BUY/SELL pairs
  const symbols = new Set<string>();
  let hasBuy = false, hasSell = false;
  for (const t of trades) {
    const side = String(t.side || '').toUpperCase();
    if (side === 'BUY' || side === 'B') hasBuy = true;
    if (side === 'SELL' || side === 'S') hasSell = true;
    symbols.add(normalizeSymbol(t.symbol || ''));
  }

  return hasBuy && hasSell;
}

/**
 * Normalize symbol for matching (strip spaces, uppercase).
 */
function normalizeSymbol(sym: string): string {
  return sym.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Get a date key from a trade for bucketing.
 */
function getDateKey(t: AnyTrade, sessionDate: string): string {
  if (t.trade_date && /\d{4}-\d{2}-\d{2}/.test(t.trade_date)) {
    return t.trade_date.substring(0, 10);
  }
  if (t.date && /\d{4}-\d{2}-\d{2}/.test(t.date)) {
    return t.date.substring(0, 10);
  }
  return sessionDate || 'unknown';
}

/**
 * Pair Claude-extracted trades by symbol + date (FIFO).
 * Returns new array with paired trades that have computed P&L.
 * Unpaired trades are returned as-is with estimated P&L = 0.
 */
export function pairClaudeTrades(
  trades: AnyTrade[],
  sessionDate: string = '',
): AnyTrade[] {
  // Group by (symbol, date)
  const buckets = new Map<string, { buys: AnyTrade[]; sells: AnyTrade[] }>();

  for (const t of trades) {
    const sym = normalizeSymbol(t.symbol || '');
    const date = getDateKey(t, sessionDate);
    const key = `${sym}|${date}`;
    if (!buckets.has(key)) buckets.set(key, { buys: [], sells: [] });
    const bucket = buckets.get(key)!;
    const side = String(t.side || '').toUpperCase();
    if (side === 'BUY' || side === 'B') {
      bucket.buys.push(t);
    } else {
      bucket.sells.push(t);
    }
  }

  const paired: AnyTrade[] = [];
  let tradeIndex = 0;

  const bucketEntries = Array.from(buckets.entries());
  for (const [, bucket] of bucketEntries) {
    const buys = [...bucket.buys];
    const sells = [...bucket.sells];

    // FIFO pair: match buys with sells
    while (buys.length > 0 && sells.length > 0) {
      const buy = buys[0];
      const sell = sells[0];

      const buyQty = Math.abs(buy.quantity || buy.qty || 0);
      const sellQty = Math.abs(sell.quantity || sell.qty || 0);
      const matchQty = Math.min(buyQty, sellQty);

      if (matchQty === 0) {
        // Can't pair — push both as unpaired
        buys.shift();
        sells.shift();
        paired.push({ ...buy, pnl: 0, trade_index: tradeIndex++ });
        paired.push({ ...sell, pnl: 0, trade_index: tradeIndex++ });
        continue;
      }

      const buyPrice = buy.exit_price || buy.entry_price || buy.price || 0;
      const sellPrice = sell.exit_price || sell.entry_price || sell.price || 0;
      const pnl = Math.round((sellPrice - buyPrice) * matchQty * 100) / 100;

      // Determine trade direction: if BUY came before SELL chronologically, it's a long.
      // Otherwise it's a short. Fallback: check which bucket has the earlier time.
      const buyTime = buy.entry_time || buy.time || '';
      const sellTime = sell.entry_time || sell.time || '';
      const isShort = sellTime && buyTime ? sellTime < buyTime : false;

      // Create paired trade
      paired.push({
        symbol: buy.symbol || sell.symbol,
        side: isShort ? 'SELL' : 'BUY',
        quantity: matchQty,
        qty: matchQty,
        entry_price: isShort ? sellPrice : buyPrice,
        exit_price: isShort ? buyPrice : sellPrice,
        entry_time: isShort ? sellTime : buyTime,
        exit_time: isShort ? buyTime : sellTime,
        pnl,
        trade_date: buy.trade_date || buy.date || sell.trade_date || sell.date || '',
        trade_index: tradeIndex++,
      });

      // Handle partial fills
      const remainBuy = buyQty - matchQty;
      const remainSell = sellQty - matchQty;
      if (remainBuy > 0) {
        buys[0] = { ...buy, quantity: remainBuy, qty: remainBuy };
      } else {
        buys.shift();
      }
      if (remainSell > 0) {
        sells[0] = { ...sell, quantity: remainSell, qty: remainSell };
      } else {
        sells.shift();
      }
    }

    // Leftover unpaired trades
    for (const b of buys) {
      paired.push({ ...b, pnl: 0, exit_price: null, trade_index: tradeIndex++ });
    }
    for (const s of sells) {
      paired.push({ ...s, pnl: 0, exit_price: null, trade_index: tradeIndex++ });
    }
  }

  // Sort by original order if possible (by time, then symbol)
  paired.sort((a, b) => {
    const timeA = a.entry_time || a.time || '';
    const timeB = b.entry_time || b.time || '';
    if (timeA && timeB && timeA !== timeB) return timeA.localeCompare(timeB);
    return (a.symbol || '').localeCompare(b.symbol || '');
  });

  // Reindex
  paired.forEach((t, i) => { t.trade_index = i; });

  const totalPnl = paired.reduce((s, t) => s + (t.pnl || 0), 0);
  const pnlStr = totalPnl.toFixed(2);
  console.log('[ClaudePairer] Paired ' + trades.length + ' raw legs into ' + paired.length + ' trades, P&L = ' + pnlStr);

  return paired;
}
