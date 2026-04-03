/**
 * TradeSaath Universal Parser
 * Client-side parsing for CSV/Excel with broker auto-detection.
 * PDF/Image files are flagged for server-side fallback.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

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

/* ─── Broker Registry ─── */
interface BrokerDef {
  id: string
  name: string
  keywords: string[]
  columnMap: Record<string, string>
}

const BROKERS: BrokerDef[] = [
  {
    id: 'zerodha',
    name: 'Zerodha',
    keywords: ['tradingsymbol', 'zerodha', 'trade date', 'order execution time'],
    columnMap: { tradingsymbol: 'symbol', 'trade type': 'tradeType', quantity: 'quantity', price: 'price', 'realized p&l': 'pnl', exchange: 'exchange' },
  },
  {
    id: 'upstox',
    name: 'Upstox',
    keywords: ['instrument_name', 'upstox', 'order_type', 'avg_price'],
    columnMap: { instrument_name: 'symbol', transaction_type: 'tradeType', quantity: 'quantity', avg_price: 'price', pnl: 'pnl', exchange: 'exchange' },
  },
  {
    id: 'angelone',
    name: 'Angel One',
    keywords: ['scripname', 'angel', 'net qty', 'closing price'],
    columnMap: { scripname: 'symbol', buysell: 'tradeType', qty: 'quantity', price: 'price', 'net amount': 'pnl' },
  },
  {
    id: 'kotak',
    name: 'Kotak Securities',
    keywords: ['scrip name', 'kotak', 'neo', 'trade value'],
    columnMap: { 'scrip name': 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'net amount': 'pnl', 'exchange segment': 'exchange' },
  },
  {
    id: 'groww',
    name: 'Groww',
    keywords: ['groww', 'isin', 'order status', 'transaction type'],
    columnMap: { symbol: 'symbol', 'transaction type': 'tradeType', quantity: 'quantity', price: 'price', exchange: 'exchange' },
  },
  {
    id: 'fyers',
    name: 'Fyers',
    keywords: ['fyers', 'clientid', 'orderid', 'tradedqty'],
    columnMap: { symbol: 'symbol', side: 'tradeType', tradedqty: 'quantity', tradedprice: 'price', pl: 'pnl', exchange: 'exchange' },
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    keywords: ['ibkr', 'interactive brokers', 'conid', 'execution id', 'realized p/l'],
    columnMap: { symbol: 'symbol', buy_sell: 'tradeType', quantity: 'quantity', price: 'price', 'realized p/l': 'pnl' },
  },
  {
    id: 'tdameritrade',
    name: 'TD Ameritrade',
    keywords: ['thinkorswim', 'tdameritrade', 'td ameritrade', 'spread', 'side'],
    columnMap: { symbol: 'symbol', side: 'tradeType', qty: 'quantity', price: 'price', 'p/l open': 'pnl' },
  },
  {
    id: 'robinhood',
    name: 'Robinhood',
    keywords: ['robinhood', 'activity date', 'trans code', 'description'],
    columnMap: { description: 'symbol', 'trans code': 'tradeType', quantity: 'quantity', price: 'price', amount: 'pnl' },
  },
  {
    id: 'etoro',
    name: 'eToro',
    keywords: ['etoro', 'copy trader', 'units', 'open date', 'close date'],
    columnMap: { action: 'symbol', type: 'tradeType', units: 'quantity', 'open rate': 'price', profit: 'pnl' },
  },
]

/* ─── Broker Detection ─── */
function detectBroker(headersLower: string[], fullTextLower: string): BrokerDef | null {
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
