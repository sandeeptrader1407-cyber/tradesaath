import type { RawFill } from './types'

/**
 * Parse Fyers CSV.
 * Expected columns: orderDateTime, symbol, side, tradedQty, tradePrice
 */
export function parseFyers(rows: Record<string, string>[]): RawFill[] {
  return rows
    .filter((r) => r.side && r.symbol)
    .map((r) => ({
      time: (r.orderDateTime || '').trim(),
      symbol: r.symbol.trim(),
      side: (r.side || '').trim().toUpperCase() === 'BUY' ? 'BUY' as const : 'SELL' as const,
      qty: Math.abs(parseFloat(r.tradedQty) || 0),
      price: parseFloat(r.tradePrice) || 0,
    }))
    .filter((f) => f.qty > 0 && f.price > 0)
}
