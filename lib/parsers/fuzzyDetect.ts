import type { ColumnRole, ColumnMapping } from './types'

// Synonyms ordered by preference — more precise time columns first
const SYNONYMS: Record<Exclude<ColumnRole, 'ignore'>, string[]> = {
  date: [
    'order_execution_time', 'orderdatetime', 'execution_time', 'order_time',
    'order_timestamp', 'fill_time', 'executed_at', 'trade_time', 'timestamp',
    'datetime', 'entry_time', 'exit_time', 'close_time', 'open_time',
    'created_at', 'time', 'date', 'trade_date', 'order_date', 'fill_date',
  ],
  symbol: [
    'symbol', 'tradingsymbol', 'trading_symbol', 'instrument', 'scrip',
    'ticker', 'stock', 'contract', 'name', 'script', 'isin', 'security',
    'asset', 'pair', 'market', 'coin', 'token', 'underlying',
    'instrument_name', 'scrip_name', 'stock_name',
  ],
  side: [
    'side', 'trade_type', 'type', 'buy_sell', 'action', 'order_side',
    'direction', 'bs', 'transaction_type', 'order_type', 'buysell',
    'buy_or_sell', 'entry_exit', 'long_short',
  ],
  qty: [
    'qty', 'quantity', 'tradedqty', 'traded_qty', 'filled_qty', 'volume',
    'lots', 'size', 'shares', 'amount', 'trade_qty', 'fill_qty',
    'executed_qty', 'no_of_shares', 'num_shares', 'units',
  ],
  price: [
    'price', 'tradeprice', 'trade_price', 'avg_price', 'fill_price',
    'rate', 'executed_price', 'avg_fill_price', 'entry_price', 'exit_price',
    'ltp', 'last_price', 'execution_price', 'fill_rate', 'average_price',
    'net_price', 'traded_price',
  ],
  pnl: [
    'pnl', 'pl', 'profit', 'loss', 'profit_loss', 'realized_pnl',
    'realised_pnl', 'net', 'net_pnl', 'gain', 'return', 'mtm',
    'mark_to_market', 'net_amount', 'profit_and_loss',
  ],
}

const REQUIRED_ROLES: ColumnRole[] = ['date', 'symbol', 'side', 'qty', 'price']

function similarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.includes(b) || b.includes(a)) return 0.75
  // Simple character overlap
  const aChars = new Set(a.split(''))
  const bChars = new Set(b.split(''))
  let overlap = 0
  for (const c of Array.from(aChars)) {
    if (bChars.has(c)) overlap++
  }
  const maxLen = Math.max(aChars.size, bChars.size)
  if (maxLen === 0) return 0
  const score = overlap / maxLen
  return score > 0.7 ? score * 0.5 : 0
}

interface Match {
  header: string
  role: ColumnRole
  score: number
}

export function fuzzyDetectColumns(headers: string[]): {
  mapping: ColumnMapping
  confidence: number
  missingFields: string[]
} {
  const normalized = headers.map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))

  // Score each header against each role
  const allMatches: Match[] = []

  for (let i = 0; i < headers.length; i++) {
    const norm = normalized[i]
    for (const [role, synonyms] of Object.entries(SYNONYMS) as [Exclude<ColumnRole, 'ignore'>, string[]][]) {
      let bestScore = 0
      for (const syn of synonyms) {
        const score = similarity(norm, syn)
        if (score > bestScore) bestScore = score
      }
      if (bestScore > 0.3) {
        allMatches.push({ header: headers[i], role, score: bestScore })
      }
    }
  }

  // Boost score for date-role matches that contain "time"/"execution"/"timestamp"
  // (these are more precise than plain "date" columns)
  for (const m of allMatches) {
    if (m.role === 'date' && /time|execution|timestamp|datetime/i.test(m.header)) {
      m.score = Math.min(m.score + 0.05, 1.05)
    }
  }

  // Greedy assignment: highest scores first
  allMatches.sort((a, b) => b.score - a.score)

  const mapping: ColumnMapping = {}
  const assignedHeaders = new Set<string>()
  const assignedRoles = new Set<string>()

  for (const match of allMatches) {
    if (assignedHeaders.has(match.header) || assignedRoles.has(match.role)) continue
    mapping[match.header] = match.role
    assignedHeaders.add(match.header)
    assignedRoles.add(match.role)
  }

  // Mark unassigned headers as ignore
  for (const h of headers) {
    if (!mapping[h]) mapping[h] = 'ignore'
  }

  // Compute confidence
  const requiredScores: number[] = []
  const missingFields: string[] = []

  for (const role of REQUIRED_ROLES) {
    const match = allMatches.find((m) => mapping[m.header] === role)
    if (match) {
      requiredScores.push(match.score)
    } else {
      missingFields.push(role)
    }
  }

  const confidence = requiredScores.length > 0
    ? requiredScores.reduce((s, v) => s + v, 0) / REQUIRED_ROLES.length
    : 0

  return { mapping, confidence, missingFields }
}

export { REQUIRED_ROLES }
