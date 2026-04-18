/**
 * TradeSaath Universal Parser
 * Client-side parsing for CSV/Excel with broker auto-detection.
 * PDF/Image files are flagged for server-side fallback.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { BROKER_REGISTRY, BROKER_INSTANT_MATCH, type BrokerDef } from '@/lib/config/brokers'

/* ─── Types ─── */
export interface StandardTrade {
  date: string
  time?: string
  symbol: string
  tradeType: 'BUY' | 'SELL' | 'UNKNOWN'
  quantity: number
  price: number
  pnl: number | null
  exchange: string | null
  rawRow: Record<string, string>
}

export interface ParseResult {
  success: boolean
  broker: string
  brokerName: string
  trades: StandardTrade[]
  rawRowCount: number
  parsedCount: number
  errors: string[]
  requiresClaudeFallback: boolean
}

/* ─── Broker Registry (imported from shared config) ─── */
const BROKERS = BROKER_REGISTRY
const INSTANT_MATCH = BROKER_INSTANT_MATCH

/* ─── Broker Detection ─── */
function detectBroker(headersLower: string[], fullTextLower: string): BrokerDef | null {
  // Phase 1: instant match on high-specificity keywords (broker names, unique columns)
  const searchText = headersLower.join(' ') + ' ' + fullTextLower
  for (const [keyword, brokerId] of Object.entries(INSTANT_MATCH)) {
    if (searchText.includes(keyword)) {
      return BROKERS.find(b => b.id === brokerId) || null
    }
  }

  // Phase 2: fallback to >=2 keyword match for generic patterns
  for (const broker of BROKERS) {
    if (broker.keywords.length === 0) continue
    const matchCount = broker.keywords.filter(kw =>
      headersLower.some(h => h.includes(kw)) || fullTextLower.includes(kw)
    ).length
    if (matchCount >= 2) return broker
  }
  return null
}

/* ─── Smart Generic Column Detection ─── */
function detectGenericColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  const lower = headers.map(h => h.toLowerCase().trim())

  const patterns: [string, string[]][] = [
    ['date', ['date', 'time', 'datetime']],
    ['symbol', ['symbol', 'scrip', 'stock', 'ticker', 'instrument', 'name']],
    ['tradeType', ['type', 'action', 'side', 'b/s', 'buy/sell', 'transaction']],
    ['quantity', ['qty', 'quantity', 'shares', 'units', 'volume']],
    ['price', ['price', 'rate', 'avg', 'ltp', 'close']],
    ['pnl', ['pnl', 'p&l', 'profit', 'loss', 'realized', 'net amount']],
    ['exchange', ['exchange', 'segment', 'market']],
  ]

  for (const [field, terms] of patterns) {
    for (let i = 0; i < lower.length; i++) {
      if (terms.some(t => lower[i].includes(t)) && !Object.values(map).includes(headers[i])) {
        map[headers[i].toLowerCase().trim()] = field
        break
      }
    }
  }
  return map
}

/* ─── Normalize Trade Type ─── */
function normalizeTradeType(val: string): 'BUY' | 'SELL' | 'UNKNOWN' {
  const v = (val || '').toLowerCase().trim()
  if (v.includes('buy') || v === 'b') return 'BUY'
  if (v.includes('sell') || v === 's') return 'SELL'
  return 'UNKNOWN'
}

/* ─── Map Row Using Column Map ─── */
function mapRow(row: Record<string, string>, columnMap: Record<string, string>): StandardTrade | null {
  // Build reverse map: standardField -> originalColumnName
  const reverseMap: Record<string, string> = {}
  for (const [origCol, stdField] of Object.entries(columnMap)) {
    reverseMap[stdField] = origCol
  }

  // Try to find the value for each field
  const findVal = (field: string): string => {
    const colName = reverseMap[field]
    if (!colName) return ''
    // Try exact match first
    if (row[colName] !== undefined) return row[colName]
    // Try case-insensitive match
    const rowLower = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v])
    )
    return rowLower[colName.toLowerCase().trim()] || ''
  }

  const symbol = findVal('symbol')?.trim()
  if (!symbol) return null

  const qty = parseFloat((findVal('quantity') || '0').replace(/,/g, ''))
  const price = parseFloat((findVal('price') || '0').replace(/,/g, ''))
  if (isNaN(qty) || qty === 0) return null

  const pnlStr = findVal('pnl')
  const pnl = pnlStr ? parseFloat(pnlStr.replace(/,/g, '').replace(/[()]/g, m => m === '(' ? '-' : '')) : null

  const dateVal = findVal('date') || ''
  const timeVal = findVal('time') || ''

  return {
    date: dateVal,
    time: timeVal || undefined,
    symbol,
    tradeType: normalizeTradeType(findVal('tradeType')),
    quantity: Math.abs(qty),
    price: Math.abs(price),
    pnl: pnl !== null && !isNaN(pnl) ? pnl : null,
    exchange: findVal('exchange') || null,
    rawRow: row,
  }
}

/* ─── Parse CSV ─── */
export function parseCSV(text: string): ParseResult {
  const errors: string[] = []

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (!parsed.data || parsed.data.length === 0) {
    return { success: false, broker: 'unknown', brokerName: 'Unknown', trades: [], rawRowCount: 0, parsedCount: 0, errors: ['No data rows found'], requiresClaudeFallback: false }
  }

  const headers = parsed.meta.fields || []
  const headersLower = headers.map(h => h.toLowerCase().trim())
  const fullText = headers.join(' ') + ' ' + JSON.stringify(parsed.data.slice(0, 3))
  const fullTextLower = fullText.toLowerCase()

  // Detect broker
  const detectedBroker = detectBroker(headersLower, fullTextLower)
  let columnMap: Record<string, string>
  let brokerId: string
  let brokerName: string

  if (detectedBroker) {
    columnMap = detectedBroker.columnMap
    brokerId = detectedBroker.id
    brokerName = detectedBroker.name
  } else {
    // Generic detection
    columnMap = detectGenericColumns(headers)
    brokerId = 'generic'
    brokerName = 'Auto-Detected'
    if (Object.keys(columnMap).length < 2) {
      errors.push('Could not map enough columns for trade extraction')
    }
  }

  // Map rows to trades
  const trades: StandardTrade[] = []
  for (const row of parsed.data) {
    const trade = mapRow(row, columnMap)
    if (trade) trades.push(trade)
  }

  return {
    success: trades.length > 0,
    broker: brokerId,
    brokerName,
    trades,
    rawRowCount: parsed.data.length,
    parsedCount: trades.length,
    errors,
    requiresClaudeFallback: false,
  }
}

/* ─── Parse Excel ─── */
export function parseExcel(buffer: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) {
      return { success: false, broker: 'unknown', brokerName: 'Unknown', trades: [], rawRowCount: 0, parsedCount: 0, errors: ['No sheets found in Excel file'], requiresClaudeFallback: false }
    }
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet])
    const result = parseCSV(csv)
    return result
  } catch (err) {
    return { success: false, broker: 'unknown', brokerName: 'Unknown', trades: [], rawRowCount: 0, parsedCount: 0, errors: [`Excel parse error: ${err instanceof Error ? err.message : 'Unknown error'}`], requiresClaudeFallback: false }
  }
}

/* ─── Parse PDF (browser fallback) ─── */
export function parsePDF(): ParseResult {
  // PDF parsing requires server-side (pdf-parse/unpdf).
  // In browser, flag for server-side processing via /api/parse.
  return {
    success: false,
    broker: 'pdf',
    brokerName: 'PDF Upload',
    trades: [],
    rawRowCount: 0,
    parsedCount: 0,
    errors: [],
    requiresClaudeFallback: true,
  }
}

/* ─── Parse Image ─── */
export function parseImage(): ParseResult {
  return {
    success: false,
    broker: 'image',
    brokerName: 'Image Upload',
    trades: [],
    rawRowCount: 0,
    parsedCount: 0,
    errors: [],
    requiresClaudeFallback: true,
  }
}

/* ─── Main Export ─── */
export async function parseTradeFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (['csv', 'tsv', 'txt'].includes(ext)) {
    const text = await file.text()
    return parseCSV(text)
  }

  if (['xlsx', 'xls'].includes(ext)) {
    const buffer = await file.arrayBuffer()
    return parseExcel(buffer)
  }

  if (ext === 'pdf') {
    return parsePDF()
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return parseImage()
  }

  return {
    success: false,
    broker: 'unknown',
    brokerName: 'Unknown',
    trades: [],
    rawRowCount: 0,
    parsedCount: 0,
    errors: [`Unsupported file type: .${ext}`],
    requiresClaudeFallback: false,
  }
}
