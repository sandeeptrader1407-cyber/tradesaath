import type { RawFill, ParsedTrade, Fill } from './types'

/**
 * Group raw fills by symbol, pair buys with sells, compute P&L.
 * Returns trades in the same shape as v12 ORDERS array.
 */
export function pairTrades(fills: RawFill[]): ParsedTrade[] {
  // Group fills by symbol
  const bySymbol = new Map<string, RawFill[]>()
  for (const f of fills) {
    const arr = bySymbol.get(f.symbol) || []
    arr.push(f)
    bySymbol.set(f.symbol, arr)
  }

  const trades: ParsedTrade[] = []
  let id = 1

  for (const [symbol, symbolFills] of Array.from(bySymbol.entries())) {
    // Sort by time
    symbolFills.sort((a, b) => a.time.localeCompare(b.time))

    const buys: RawFill[] = []
    const sells: RawFill[] = []

    for (const f of symbolFills) {
      if (f.side === 'BUY') buys.push(f)
      else sells.push(f)
    }

    // Pair: if more buys, entry=buy avg, exit=sell avg (BUY trade)
    // if more sells, entry=sell avg, exit=buy avg (SELL trade)
    if (buys.length === 0 && sells.length === 0) continue

    const buyQty = buys.reduce((s, f) => s + f.qty, 0)
    const sellQty = sells.reduce((s, f) => s + f.qty, 0)
    const buyAvg = buyQty > 0 ? buys.reduce((s, f) => s + f.price * f.qty, 0) / buyQty : 0
    const sellAvg = sellQty > 0 ? sells.reduce((s, f) => s + f.price * f.qty, 0) / sellQty : 0

    const pairedQty = Math.min(buyQty, sellQty)
    if (pairedQty === 0) {
      // Open position — no pair, skip or show as open
      continue
    }

    // Determine dominant side
    const side: 'BUY' | 'SELL' = buys[0] && (!sells[0] || buys[0].time <= sells[0].time) ? 'BUY' : 'SELL'
    const entry = side === 'BUY' ? buyAvg : sellAvg
    const exit = side === 'BUY' ? sellAvg : buyAvg

    const pnl = side === 'BUY'
      ? Math.round((exit - entry) * pairedQty)
      : Math.round((entry - exit) * pairedQty)

    // Extract time from first fill
    const firstFill = symbolFills[0]
    const time = extractTime(firstFill.time)

    // Build fills array from the entry side
    const entryFills = side === 'BUY' ? buys : sells
    const fillsArr: Fill[] = entryFills.map((f) => ({ qty: f.qty, price: round2(f.price) }))

    trades.push({
      id: id++,
      time,
      symbol,
      side,
      qty: pairedQty,
      entry: round2(entry),
      exit: round2(exit),
      pnl,
      cumPnl: 0, // filled below
      fills: fillsArr,
    })
  }

  // Sort by time, assign cumulative P&L
  trades.sort((a, b) => a.time.localeCompare(b.time))
  let cum = 0
  for (let i = 0; i < trades.length; i++) {
    trades[i].id = i + 1
    cum += trades[i].pnl
    trades[i].cumPnl = cum
  }

  return trades
}

function extractTime(dateStr: string): string {
  // Try to extract HH:MM from various formats
  const timeMatch = dateStr.match(/(\d{1,2}:\d{2})(:\d{2})?/)
  if (timeMatch) return timeMatch[1]
  return dateStr.slice(0, 5)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
