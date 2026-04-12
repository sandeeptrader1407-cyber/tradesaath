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
  // ─── Indian Brokers ───
  {
    id: 'zerodha',
    name: 'Zerodha',
    keywords: ['tradingsymbol', 'zerodha', 'kite', 'order execution time', 'trade_id', 'order_id', 'auction'],
    columnMap: { tradingsymbol: 'symbol', symbol: 'symbol', 'trade type': 'tradeType', 'trade_type': 'tradeType', quantity: 'quantity', price: 'price', 'realized p&l': 'pnl', exchange: 'exchange', 'order_execution_time': 'time', 'trade_date': 'date' },
  },
  {
    id: 'upstox',
    name: 'Upstox',
    keywords: ['instrument_name', 'upstox', 'rksv', 'order_type', 'avg_price', 'exchange_timestamp'],
    columnMap: { instrument_name: 'symbol', transaction_type: 'tradeType', quantity: 'quantity', avg_price: 'price', pnl: 'pnl', exchange: 'exchange' },
  },
  {
    id: 'angelone',
    name: 'Angel One',
    keywords: ['scripname', 'angel', 'angel one', 'smartapi', 'net qty', 'closing price', 'trade no'],
    columnMap: { scripname: 'symbol', buysell: 'tradeType', 'buy/sell': 'tradeType', qty: 'quantity', price: 'price', 'net amount': 'pnl', 'trade date': 'date' },
  },
  {
    id: 'groww',
    name: 'Groww',
    keywords: ['groww', 'isin', 'order status', 'transaction type', 'folio number'],
    columnMap: { symbol: 'symbol', 'transaction type': 'tradeType', quantity: 'quantity', price: 'price', exchange: 'exchange' },
  },
  {
    id: '5paisa',
    name: '5Paisa',
    keywords: ['5paisa', '5 paisa', 'scrip code', 'client code', 'scripcode'],
    columnMap: { 'scrip name': 'symbol', scripname: 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', rate: 'price', price: 'price', 'net amount': 'pnl' },
  },
  {
    id: 'icicidirect',
    name: 'ICICI Direct',
    keywords: ['icici', 'icicidirect', 'icici direct', 'icici securities', 'stock code', 'order ref'],
    columnMap: { 'stock symbol': 'symbol', 'stock code': 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'profit/loss': 'pnl', exchange: 'exchange' },
  },
  {
    id: 'hdfc',
    name: 'HDFC Securities',
    keywords: ['hdfc', 'hdfcsec', 'hdfc securities', 'blink'],
    columnMap: { symbol: 'symbol', 'scrip name': 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'net amount': 'pnl', exchange: 'exchange' },
  },
  {
    id: 'kotak',
    name: 'Kotak Securities',
    keywords: ['kotak', 'neo', 'kotak securities', 'kotak neo', 'trade value'],
    columnMap: { 'scrip name': 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'net amount': 'pnl', 'exchange segment': 'exchange' },
  },
  {
    id: 'fyers',
    name: 'Fyers',
    keywords: ['fyers', 'clientid', 'orderid', 'tradedqty', 'tradedprice', 'fytoken'],
    columnMap: { symbol: 'symbol', side: 'tradeType', tradedqty: 'quantity', tradedprice: 'price', pl: 'pnl', exchange: 'exchange' },
  },
  {
    id: 'dhan',
    name: 'Dhan',
    keywords: ['dhan', 'dhan hq', 'dhanhq', 'security id', 'drvexpdt'],
    columnMap: { symbol: 'symbol', 'security name': 'symbol', 'transaction type': 'tradeType', quantity: 'quantity', price: 'price', 'realized profit': 'pnl', exchange: 'exchange' },
  },
  {
    id: 'paytm',
    name: 'Paytm Money',
    keywords: ['paytm', 'paytm money', 'paytmmoney'],
    columnMap: { symbol: 'symbol', 'order type': 'tradeType', quantity: 'quantity', price: 'price', 'p&l': 'pnl' },
  },
  {
    id: 'motilal',
    name: 'Motilal Oswal',
    keywords: ['motilal', 'motilal oswal', 'mosl'],
    columnMap: { 'scrip name': 'symbol', symbol: 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', rate: 'price', 'net amount': 'pnl' },
  },
  {
    id: 'sharekhan',
    name: 'Sharekhan',
    keywords: ['sharekhan', 'trade tiger'],
    columnMap: { symbol: 'symbol', 'scrip name': 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'profit/loss': 'pnl' },
  },
  // ─── International Brokers ───
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    keywords: ['ibkr', 'interactive brokers', 'conid', 'execution id', 'realized p/l', 'comm/fee', 't. price'],
    columnMap: { symbol: 'symbol', buy_sell: 'tradeType', 'buy/sell': 'tradeType', quantity: 'quantity', 't. price': 'price', price: 'price', 'realized p/l': 'pnl' },
  },
  {
    id: 'tdameritrade',
    name: 'TD Ameritrade',
    keywords: ['thinkorswim', 'tdameritrade', 'td ameritrade', 'schwab'],
    columnMap: { symbol: 'symbol', side: 'tradeType', qty: 'quantity', price: 'price', 'p/l open': 'pnl' },
  },
  {
    id: 'robinhood',
    name: 'Robinhood',
    keywords: ['robinhood', 'activity date', 'trans code'],
    columnMap: { description: 'symbol', 'trans code': 'tradeType', quantity: 'quantity', price: 'price', amount: 'pnl' },
  },
  {
    id: 'webull',
    name: 'Webull',
    keywords: ['webull', 'filled qty', 'avg price', 'total p&l'],
    columnMap: { symbol: 'symbol', side: 'tradeType', 'filled qty': 'quantity', 'avg price': 'price', 'total p&l': 'pnl' },
  },
  {
    id: 'trading212',
    name: 'Trading212',
    keywords: ['trading212', 'trading 212', 'isin', 'currency (price / share)'],
    columnMap: { ticker: 'symbol', action: 'tradeType', 'no. of shares': 'quantity', 'price / share': 'price', result: 'pnl' },
  },
  {
    id: 'etoro',
    name: 'eToro',
    keywords: ['etoro', 'copy trader', 'units', 'open date', 'close date'],
    columnMap: { action: 'symbol', type: 'tradeType', units: 'quantity', 'open rate': 'price', profit: 'pnl' },
  },
]

/* ─── Broker Detection ─── */
// High-specificity keywords: if ANY of these appear, it's an instant match (confidence: high)
const INSTANT_MATCH: Record<string, string> = {
  'zerodha': 'zerodha', 'kite': 'zerodha', 'tradingsymbol': 'zerodha', 'order execution time': 'zerodha',
  'upstox': 'upstox', 'rksv': 'upstox', 'instrument_name': 'upstox', 'exchange_timestamp': 'upstox',
  'angel one': 'angelone', 'angel broking': 'angelone', 'smartapi': 'angelone', 'scripname': 'angelone',
  'groww': 'groww',
  '5paisa': '5paisa', '5 paisa': '5paisa', 'scripcode': '5paisa',
  'icici direct': 'icicidirect', 'icicidirect': 'icicidirect', 'icici securities': 'icicidirect',
  'hdfc securities': 'hdfc', 'hdfcsec': 'hdfc',
  'kotak neo': 'kotak', 'kotak securities': 'kotak',
  'fyers': 'fyers', 'fytoken': 'fyers', 'tradedqty': 'fyers',
  'dhan hq': 'dhan', 'dhanhq': 'dhan', 'drvexpdt': 'dhan',
  'paytm money': 'paytm', 'paytmmoney': 'paytm',
  'motilal oswal': 'motilal',
  'sharekhan': 'sharekhan', 'trade tiger': 'sharekhan',
  'interactive brokers': 'ibkr', 'ibkr': 'ibkr',
  'thinkorswim': 'tdameritrade', 'td ameritrade': 'tdameritrade',
  'robinhood': 'robinhood',
  'webull': 'webull',
  'trading212': 'trading212', 'trading 212': 'trading212',
  'etoro': 'etoro',
}

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
