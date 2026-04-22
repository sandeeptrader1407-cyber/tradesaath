import type { RawFill, ColumnMapping } from './types'

const BUY_KEYWORDS = ['buy', 'b', 'long', 'entry']
const SELL_KEYWORDS = ['sell', 's', 'short', 'exit']

function parseSide(value: string): 'BUY' | 'SELL' | null {
  const v = value.trim().toLowerCase()
  if (BUY_KEYWORDS.some((k) => v === k || v.startsWith(k))) return 'BUY'
  if (SELL_KEYWORDS.some((k) => v === k || v.startsWith(k))) return 'SELL'
  return null
}

function parseNumber(value: string): number {
  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[₹$€£,\s]/g, '').replace(/[()]/g, '')
  return Math.abs(parseFloat(cleaned) || 0)
}

export function applyMapping(rows: Record<string, string>[], mapping: ColumnMapping): RawFill[] {
  // Find header for each role
  const dateCol = Object.entries(mapping).find(([, role]) => role === 'date')?.[0]
  const symbolCol = Object.entries(mapping).find(([, role]) => role === 'symbol')?.[0]
  const sideCol = Object.entries(mapping).find(([, role]) => role === 'side')?.[0]
  const qtyCol = Object.entries(mapping).find(([, role]) => role === 'qty')?.[0]
  const priceCol = Object.entries(mapping).find(([, role]) => role === 'price')?.[0]

  if (!dateCol || !symbolCol || !sideCol || !qtyCol || !priceCol) {
    return []
  }

  return rows
    .map((row) => {
      const side = parseSide(row[sideCol] || '')
      if (!side) return null

      const qty = parseNumber(row[qtyCol] || '')
      const price = parseNumber(row[priceCol] || '')
      if (qty <= 0 || price <= 0) return null

      return {
        time: (row[dateCol] || '').trim(),
        symbol: (row[symbolCol] || '').trim(),
        side,
        qty,
        price,
      }
    })
    .filter((f): f is RawFill => f !== null)
}
