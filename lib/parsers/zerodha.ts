import type { RawFill } from './types'

/**
 * Parse Zerodha tradebook CSV.
 * Expected columns: trade_date, tradingsymbol, exchange, segment, trade_type, quantity, price, order_execution_time
 */
export function parseZerodha(rows: Record<string, string>[]): RawFill[] {
  return rows
    .filter((r) => r.trade_type && r.tradingsymbol)
    .map((r) => ({
      time: (r.order_execution_time || r.trade_date || '').trim(),
      symbol: r.tradingsymbol.trim(),
      side: r.trade_type.trim().toUpperCase() as 'BUY' | 'SELL',
      qty: Math.abs(parseFloat(r.quantity) || 0),
      price: parseFloat(r.price) || 0,
    }))
    .filter((f) => f.qty > 0 && f.price > 0)
}
