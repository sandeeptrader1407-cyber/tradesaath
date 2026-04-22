import { fuzzyDetectColumns } from './fuzzyDetect'
import type { ColumnMapping, DetectionResult } from './types'

// Known broker exact-match signatures for fast path
const KNOWN_BROKERS: { name: string; requiredHeaders: string[] }[] = [
  { name: 'Zerodha', requiredHeaders: ['tradingsymbol', 'trade_type', 'order_execution_time'] },
  { name: 'Fyers', requiredHeaders: ['orderdatetime', 'tradedqty', 'tradeprice'] },
  { name: 'Angel One', requiredHeaders: ['symbol', 'trade_type', 'trade_date', 'net_rate'] },
  { name: 'Upstox', requiredHeaders: ['trading_symbol', 'trade_type', 'order_timestamp', 'traded_price'] },
  { name: 'Groww', requiredHeaders: ['symbol', 'type', 'quantity', 'price'] },
  { name: 'Dhan', requiredHeaders: ['trading_symbol', 'transaction_type', 'quantity', 'price'] },
  { name: 'IBKR', requiredHeaders: ['symbol', 'buy/sell', 'quantity', 'tradeprice'] },
  { name: 'Binance', requiredHeaders: ['pair', 'side', 'filled', 'price'] },
  { name: 'MT4/MT5', requiredHeaders: ['ticket', 'type', 'lots', 'price'] },
]

function detectKnownBroker(headers: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const broker of KNOWN_BROKERS) {
    if (broker.requiredHeaders.every((h) => lower.includes(h))) {
      return broker.name
    }
  }
  return null
}

export function detectAndPreview(
  headers: string[],
  rows: Record<string, string>[],
  format: string
): DetectionResult {
  const knownBroker = detectKnownBroker(headers)
  const { mapping, confidence, missingFields } = fuzzyDetectColumns(headers)

  // If known broker, boost confidence
  const finalConfidence = knownBroker ? Math.max(confidence, 0.9) : confidence

  return {
    headers,
    mapping,
    confidence: finalConfidence,
    broker: knownBroker,
    preview: rows.slice(0, 10),
    format,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  }
}

// Keep backward compatibility exports
export type BrokerName = 'zerodha' | 'fyers' | 'unknown'

export function detectBroker(headers: string[]): BrokerName {
  const lower = headers.map((h) => h.toLowerCase().trim())
  if (['tradingsymbol', 'trade_type', 'order_execution_time'].every((h) => lower.includes(h))) return 'zerodha'
  if (['orderdatetime', 'tradedqty', 'tradeprice'].every((h) => lower.includes(h))) return 'fyers'
  return 'unknown'
}

export function parseByBroker(broker: BrokerName, rows: Record<string, string>[]): import('./types').RawFill[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseZerodha } = require('./zerodha')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseFyers } = require('./fyers')
  switch (broker) {
    case 'zerodha': return parseZerodha(rows)
    case 'fyers': return parseFyers(rows)
    default: return []
  }
}

export { ColumnMapping }
