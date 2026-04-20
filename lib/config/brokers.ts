/**
 * Shared Broker Registry — single source of truth for all broker detection.
 * Used by both client-side (universalParser.ts) and server-side (trade-parser.ts).
 */

export interface BrokerDef {
  id: string
  name: string
  /** Keywords used for broker detection (text search). All lowercase. */
  keywords: string[]
  /** Maps broker-specific CSV column names to standard field names. */
  columnMap: Record<string, string>
}

/**
 * Complete registry of supported brokers.
 * When adding a new broker, add it HERE — both parsers pick it up automatically.
 */
export const BROKER_REGISTRY: BrokerDef[] = [
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
  {
    id: 'finvasia',
    name: 'Finvasia',
    keywords: ['finvasia', 'shoonya'],
    columnMap: { symbol: 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'net amount': 'pnl' },
  },
  {
    id: 'flattrade',
    name: 'Flattrade',
    keywords: ['flattrade'],
    columnMap: { symbol: 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', price: 'price', 'net amount': 'pnl' },
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
  // ─── Crypto Exchanges ───
  {
    id: 'binance',
    name: 'Binance',
    keywords: ['binance', 'binance.com', 'realized_profit', 'trade_id', 'base_asset', 'quote_asset', 'usdt'],
    columnMap: { symbol: 'symbol', pair: 'symbol', side: 'tradeType', qty: 'quantity', quantity: 'quantity', 'executed qty': 'quantity', price: 'price', 'realized profit': 'pnl', realized_profit: 'pnl', fee: 'fees' },
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    keywords: ['coinbase', 'coinbase pro', 'coinbase advanced', 'portfolio', 'cbpro'],
    columnMap: { product: 'symbol', asset: 'symbol', side: 'tradeType', size: 'quantity', 'fill size': 'quantity', price: 'price', 'fill price': 'price', fee: 'fees', total: 'amount' },
  },
  {
    id: 'kraken',
    name: 'Kraken',
    keywords: ['kraken', 'kraken.com', 'txid', 'refid', 'aclass'],
    columnMap: { pair: 'symbol', type: 'tradeType', vol: 'quantity', price: 'price', fee: 'fees', cost: 'amount' },
  },
  // ─── Additional International Brokers ───
  {
    id: 'fidelity',
    name: 'Fidelity',
    keywords: ['fidelity', 'fidelity investments', 'fidelity.com', 'run date', 'settlement date', 'security description'],
    columnMap: { symbol: 'symbol', 'security description': 'symbol', action: 'tradeType', quantity: 'quantity', price: 'price', amount: 'amount', commission: 'fees' },
  },
  {
    id: 'schwab',
    name: 'Charles Schwab',
    keywords: ['schwab', 'charles schwab', 'schwab.com', 'schwab one'],
    columnMap: { symbol: 'symbol', description: 'symbol', action: 'tradeType', quantity: 'quantity', price: 'price', amount: 'amount', 'fees & comm': 'fees' },
  },
  {
    id: 'degiro',
    name: 'DEGIRO',
    keywords: ['degiro', 'flatex degiro', 'product', 'isin', 'beurs'],
    columnMap: { product: 'symbol', 'buy/sell': 'tradeType', quantity: 'quantity', 'koers': 'price', price: 'price', 'transaction costs': 'fees' },
  },
  {
    id: 'ig',
    name: 'IG',
    keywords: ['ig.com', 'ig group', 'ig markets', 'ig index', 'deal id', 'deal reference'],
    columnMap: { market: 'symbol', direction: 'tradeType', size: 'quantity', 'opening level': 'price', 'closing level': 'price', 'profit/loss': 'pnl' },
  },
  {
    id: 'saxo',
    name: 'Saxo Bank',
    keywords: ['saxo', 'saxo bank', 'saxotrader', 'instrument id'],
    columnMap: { instrument: 'symbol', 'buy/sell': 'tradeType', amount: 'quantity', price: 'price', 'p/l': 'pnl', commission: 'fees' },
  },
  {
    id: 'etrade',
    name: 'E*TRADE',
    keywords: ['etrade', 'e*trade', 'e-trade', 'morgan stanley'],
    columnMap: { symbol: 'symbol', 'transaction type': 'tradeType', quantity: 'quantity', price: 'price', amount: 'amount', commission: 'fees' },
  },
]

/**
 * High-specificity keyword map for instant broker matching.
 * If ANY of these appear in text, it's an immediate match.
 * Derived from BROKER_REGISTRY keywords but curated for precision.
 */
export const BROKER_INSTANT_MATCH: Record<string, string> = {
  // Zerodha
  'zerodha': 'zerodha', 'kite': 'zerodha', 'tradingsymbol': 'zerodha', 'order execution time': 'zerodha',
  // Upstox
  'upstox': 'upstox', 'rksv': 'upstox', 'instrument_name': 'upstox', 'exchange_timestamp': 'upstox',
  // Angel One
  'angel one': 'angelone', 'angel broking': 'angelone', 'smartapi': 'angelone', 'scripname': 'angelone',
  // Groww
  'groww': 'groww',
  // 5Paisa
  '5paisa': '5paisa', '5 paisa': '5paisa', 'scripcode': '5paisa',
  // ICICI Direct
  'icici direct': 'icicidirect', 'icicidirect': 'icicidirect', 'icici securities': 'icicidirect',
  // HDFC
  'hdfc securities': 'hdfc', 'hdfcsec': 'hdfc',
  // Kotak
  'kotak neo': 'kotak', 'kotak securities': 'kotak',
  // Fyers
  'fyers': 'fyers', 'fytoken': 'fyers', 'tradedqty': 'fyers',
  // Dhan
  'dhan hq': 'dhan', 'dhanhq': 'dhan', 'drvexpdt': 'dhan',
  // Paytm
  'paytm money': 'paytm', 'paytmmoney': 'paytm',
  // Motilal Oswal
  'motilal oswal': 'motilal',
  // Sharekhan
  'sharekhan': 'sharekhan', 'trade tiger': 'sharekhan',
  // Finvasia
  'finvasia': 'finvasia', 'shoonya': 'finvasia',
  // Flattrade
  'flattrade': 'flattrade',
  // Interactive Brokers
  'interactive brokers': 'ibkr', 'ibkr': 'ibkr',
  // TD Ameritrade
  'thinkorswim': 'tdameritrade', 'td ameritrade': 'tdameritrade',
  // Robinhood
  'robinhood': 'robinhood',
  // Webull
  'webull': 'webull',
  // Trading212
  'trading212': 'trading212', 'trading 212': 'trading212',
  // eToro
  'etoro': 'etoro',
  // Binance
  'binance': 'binance', 'binance.com': 'binance', 'base_asset': 'binance',
  // Coinbase
  'coinbase': 'coinbase', 'coinbase pro': 'coinbase', 'coinbase advanced': 'coinbase',
  // Kraken
  'kraken': 'kraken', 'kraken.com': 'kraken',
  // Fidelity
  'fidelity': 'fidelity', 'fidelity investments': 'fidelity',
  // Charles Schwab
  'charles schwab': 'schwab', 'schwab one': 'schwab',
  // DEGIRO
  'degiro': 'degiro', 'flatex degiro': 'degiro',
  // IG
  'ig markets': 'ig', 'ig group': 'ig', 'ig index': 'ig',
  // Saxo Bank
  'saxo bank': 'saxo', 'saxotrader': 'saxo',
  // E*TRADE
  'etrade': 'etrade', 'e*trade': 'etrade', 'e-trade': 'etrade',
}

/** Lookup a broker by id from the registry */
export function findBrokerById(id: string): BrokerDef | undefined {
  return BROKER_REGISTRY.find(b => b.id === id)
}

/**
 * Detect broker from raw text using the shared registry.
 * Returns the broker name (e.g. "Zerodha") or "Unknown".
 * Used by server-side trade-parser.ts.
 */
export function detectBrokerFromText(text: string): string {
  const t = text.toLowerCase()
  // Phase 1: instant match on high-specificity keywords
  for (const [keyword, brokerId] of Object.entries(BROKER_INSTANT_MATCH)) {
    if (t.includes(keyword)) {
      const broker = BROKER_REGISTRY.find(b => b.id === brokerId)
      if (broker) return broker.name
    }
  }
  // Phase 2: fallback to >=2 keyword match
  for (const broker of BROKER_REGISTRY) {
    const matchCount = broker.keywords.filter(kw => t.includes(kw)).length
    if (matchCount >= 2) return broker.name
  }
  return 'Unknown'
}
