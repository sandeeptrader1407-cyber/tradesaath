/**
 * Currency formatting utility for TradeSaath.
 *
 * Currently defaults to INR (₹) with en-IN locale.
 * TODO: When multi-currency support is added, detect currency from
 * the user's detected market (e.g., USD for US stocks, GBP for LSE)
 * and pass it through the stats API response.
 */

export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'EUR' | 'JPY' | 'SGD' | 'AUD' | 'CAD'

interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  locale: string
}

const CURRENCY_MAP: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  JPY: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
}

const DEFAULT_CURRENCY: CurrencyCode = 'INR'

/**
 * Format a number as currency.
 *
 * @param value - The numeric value to format
 * @param currency - Currency code (defaults to INR)
 * @param opts - Additional options
 * @returns Formatted string like "₹1,23,456" or "-₹500"
 */
export function formatCurrency(
  value: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  opts: { signed?: boolean; decimals?: number } = {}
): string {
  const config = CURRENCY_MAP[currency] || CURRENCY_MAP[DEFAULT_CURRENCY]
  const abs = Math.abs(value)
  const rounded = opts.decimals !== undefined
    ? abs.toFixed(opts.decimals)
    : String(Math.round(abs))

  // Use locale formatting for the number part
  const numStr = Number(rounded).toLocaleString(config.locale, {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  })

  const sign = opts.signed
    ? (value > 0 ? '+' : value < 0 ? '-' : '')
    : (value < 0 ? '-' : '')

  return `${sign}${config.symbol}${numStr}`
}

/**
 * Get currency symbol for a given code.
 */
export function currencySymbol(currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return (CURRENCY_MAP[currency] || CURRENCY_MAP[DEFAULT_CURRENCY]).symbol
}

/**
 * Get locale string for a given currency.
 */
export function currencyLocale(currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return (CURRENCY_MAP[currency] || CURRENCY_MAP[DEFAULT_CURRENCY]).locale
}

/**
 * Map detected market string to a likely currency.
 *
 * FIX (audit Finding F + N-bonus, 2026-05-04): returns null when the
 * market string is unknown/missing, so callers can fall through to the
 * resolveCurrency chain instead of silently defaulting to INR. The
 * single caller in app/api/dashboard/stats/route.ts handles the null.
 *
 * TODO: Expand as more markets are supported.
 */
export function marketToCurrency(market: string | null | undefined): CurrencyCode | null {
  const m = (market || '').toUpperCase()
  if (!m || m === 'UNKNOWN') return null
  if (m === 'NSE' || m === 'BSE' || m === 'MCX') return 'INR'
  if (m === 'NYSE' || m === 'NASDAQ' || m === 'AMEX' || m === 'CBOE') return 'USD'
  if (m === 'LSE') return 'GBP'
  if (m === 'TSE' || m === 'JPX') return 'JPY'
  if (m === 'SGX') return 'SGD'
  if (m === 'ASX') return 'AUD'
  if (m === 'TSX') return 'CAD'
  // European exchanges
  if (m === 'XETRA' || m === 'EURONEXT') return 'EUR'
  // Forex / Crypto markets — most platforms quote in USD
  if (m === 'FOREX' || m === 'FX' || m === 'CRYPTO') return 'USD'
  // EU as a generic catch (e.g. detectMarket returns 'EU' for DEGIRO/Saxo)
  if (m === 'EU') return 'EUR'
  // Unknown market — caller chain decides what to do
  return null
}

/* ─── Currency resolution chain (audit Finding F — 2026-05-04) ─────────
 *
 * Replaces the 14 sites of `extracted.detected_currency || 'INR'` with
 * a 5-step resolution chain. The previous hard-coded INR fallback meant
 * every non-Indian user saw ₹ in their dashboard regardless of file
 * content. This module orchestrates a safer cascade:
 *
 *   1. file-detected currency (from detectCurrency on raw text)
 *   2. market → currency mapping (marketToCurrency above)
 *   3. symbol-based detection (detectCurrencyFromSymbols below)
 *   4. middleware-set cookie (tradesaath-currency, geo-derived)
 *   5. Accept-Language header region code
 *   6. final default = USD (was INR — see FALLBACK_CURRENCY below)
 */

/**
 * Final fallback when no signal detected anywhere in the resolution
 * chain. Changed from 'INR' (audit Finding F, 2026-05-04) — global
 * default for genuinely unknown context. Easy to grep, easy to swap
 * if business requirements change.
 */
export const FALLBACK_CURRENCY: CurrencyCode = 'USD'

const ALL_CURRENCY_CODES: ReadonlyArray<CurrencyCode> = [
  'INR', 'USD', 'GBP', 'EUR', 'JPY', 'SGD', 'AUD', 'CAD',
]

/**
 * Type guard: validates that a string is a known CurrencyCode.
 * Used inside resolveCurrency to gate detected/cookie strings before
 * accepting them — prevents a user-edited cookie value (e.g. "PEPE")
 * from polluting the chain.
 */
export function isValidCurrency(s: unknown): s is CurrencyCode {
  return typeof s === 'string' && ALL_CURRENCY_CODES.includes(s as CurrencyCode)
}

/* ─── Symbol-based detection ───────────────────────────────────────── */

const INDIAN_SYMBOL_WHITELIST: ReadonlySet<string> = new Set([
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX',
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ITC', 'SBIN', 'WIPRO',
  'HDFC', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'BAJFINANCE',
  'ADANIENT', 'ADANIPORTS', 'NTPC', 'POWERGRID', 'COALINDIA',
  'HDFCLIFE', 'JSWSTEEL', 'IDEA', 'YESBANK', 'PNB', 'IRCTC',
  'NYKAA', 'PAYTM', 'RVNL', 'VEDL',
])

const INDIAN_FNO_SUBSTRINGS: ReadonlyArray<string> = [
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX',
]

const US_TICKER_RE = /^[A-Z]{1,5}$/
const INDIAN_SUFFIX_RE = /(\.NS|\.BO|-EQ)$/i
const CRYPTO_PAIR_RE = /^([A-Z]{3,5})(USDT|USDC|USD|BTC|ETH|EUR)$/
const CRYPTO_PAIR_SLASH_RE = /^([A-Z]{3,5})\/(USDT|USDC|USD|BTC|ETH|EUR)$/
const FOREX_PAIR_RE = /^([A-Z]{3})(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD)$/
const FOREX_PAIR_SLASH_RE = /^([A-Z]{3})\/(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD)$/

function cryptoQuoteToCurrency(quote: string): CurrencyCode | null {
  if (quote === 'USDT' || quote === 'USDC' || quote === 'USD') return 'USD'
  if (quote === 'EUR') return 'EUR'
  // BTC / ETH quote → crypto-only pair, no fiat answer
  return null
}

function forexQuoteToCurrency(quote: string): CurrencyCode | null {
  if (isValidCurrency(quote)) return quote
  // CHF / NZD quoted but not in CurrencyCode union — return null and let
  // the chain fall through (we don't model those in formatCurrency yet).
  return null
}

/**
 * Inspect a list of trade symbols and infer the trading currency by
 * majority vote. Returns null when the evidence is weak (empty list,
 * single symbol, mixed signals, or no recognisable patterns).
 *
 * Scoring rules:
 *   • US stock ticker (1-5 char A-Z) → vote USD
 *   • Symbol in Indian whitelist OR ending in .NS/.BO/-EQ → vote INR
 *   • Indian F&O substring (NIFTY/BANKNIFTY/etc.) → vote INR
 *   • Crypto pair (XXX[USDT|USDC|USD|BTC|ETH|EUR]) → vote on quote
 *   • Forex pair (XXX[USD|EUR|GBP|JPY|...]) → STRICT: only count
 *     forex votes if 100% of forex symbols agree on the same quote.
 *     Otherwise drop all forex votes and let the chain fall through.
 *   • Unrecognised symbol → ignore (no vote)
 *
 * Final answer: the currency with ≥60% of recognised votes wins.
 */
export function detectCurrencyFromSymbols(symbols: string[]): CurrencyCode | null {
  if (!symbols || symbols.length < 2) return null

  const votes: Partial<Record<CurrencyCode, number>> = {}
  const forexVotes: CurrencyCode[] = []

  const tally = (c: CurrencyCode): void => {
    votes[c] = (votes[c] || 0) + 1
  }

  for (const raw of symbols) {
    if (!raw || typeof raw !== 'string') continue
    const sym = raw.trim().toUpperCase()
    if (!sym) continue

    // Indian whitelist or suffix
    if (INDIAN_SYMBOL_WHITELIST.has(sym) || INDIAN_SUFFIX_RE.test(sym)) {
      tally('INR')
      continue
    }
    // Indian F&O substring (covers NIFTY/BANKNIFTY-prefixed option names)
    if (INDIAN_FNO_SUBSTRINGS.some((sub) => sym.includes(sub))) {
      tally('INR')
      continue
    }
    // Crypto pair (must check before forex — both can match XXX+USD)
    const cMatch = sym.match(CRYPTO_PAIR_RE) || sym.match(CRYPTO_PAIR_SLASH_RE)
    if (cMatch) {
      const c = cryptoQuoteToCurrency(cMatch[2])
      if (c) tally(c)
      continue
    }
    // Forex pair — accumulate separately, decide at the end
    const fMatch = sym.match(FOREX_PAIR_RE) || sym.match(FOREX_PAIR_SLASH_RE)
    if (fMatch) {
      const c = forexQuoteToCurrency(fMatch[2])
      if (c) forexVotes.push(c)
      continue
    }
    // US stock pattern (after Indian whitelist and pair patterns to
    // avoid false-positives like "USDT" matching as a 4-char US ticker).
    // Also skip bare currency codes — these are malformed-input artifacts,
    // not stock tickers.
    if (US_TICKER_RE.test(sym) && !isValidCurrency(sym)) {
      tally('USD')
      continue
    }
    // Unrecognised — skip (don't pollute the tally)
  }

  // Forex: only count if 100% agree (per spec — forex is contentious)
  if (forexVotes.length > 0) {
    const allAgree = forexVotes.every((c) => c === forexVotes[0])
    if (allAgree) {
      votes[forexVotes[0]] = (votes[forexVotes[0]] || 0) + forexVotes.length
    }
    // Otherwise drop all forex votes silently
  }

  const totalVotes = Object.values(votes).reduce<number>((s, n) => s + (n || 0), 0)
  if (totalVotes === 0) return null

  // Find leader; return only if leader has ≥60% of recognised votes.
  let leader: CurrencyCode | null = null
  let leaderCount = 0
  for (const code of ALL_CURRENCY_CODES) {
    const n = votes[code] || 0
    if (n > leaderCount) {
      leader = code
      leaderCount = n
    }
  }
  if (!leader) return null
  if (leaderCount / totalVotes < 0.6) return null
  return leader
}

/* ─── Accept-Language parsing ──────────────────────────────────────── */

const REGION_TO_CURRENCY: Readonly<Record<string, CurrencyCode>> = {
  US: 'USD', CA: 'USD', // CA could be CAD but most users prefer USD displays
  IN: 'INR',
  GB: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
  JP: 'JPY',
  AU: 'AUD',
  SG: 'SGD',
}

// TODO: parseAcceptLanguage uses position-based priority (first token wins),
// not q-value-based. This is correct for ~95% of real headers but breaks
// for explicit q-weighted headers like "en;q=0.5,de;q=1.0". Improving this
// is a low-priority follow-up — current logic catches the common case.
/**
 * Parse the top-priority language tag's region from an Accept-Language
 * header and map to a currency. Returns null when the header is missing,
 * malformed, or the region isn't in our map.
 *
 * Examples:
 *   "en-US,en;q=0.9"           → USD (region US)
 *   "de-DE,de;q=0.9,en;q=0.8"  → EUR (region DE)
 *   "en"                       → null (no region tag)
 *   "fr-CH"                    → null (Switzerland not mapped)
 *   null                       → null
 */
export function parseAcceptLanguage(header: string | null): CurrencyCode | null {
  if (!header || typeof header !== 'string') return null
  // Take the first comma-delimited tag, strip the optional ;q= weight.
  const first = header.split(',')[0]?.split(';')[0]?.trim()
  if (!first) return null
  // Parse "lang-REGION" — region is the part after the dash.
  const dash = first.indexOf('-')
  if (dash < 0) return null
  const region = first.slice(dash + 1).trim().toUpperCase()
  if (!region) return null
  return REGION_TO_CURRENCY[region] ?? null
}

/* ─── Resolution orchestrator ──────────────────────────────────────── */

interface ResolveCurrencyOpts {
  /** Currency string detected from file content (e.g. detectCurrency output). */
  detectedCurrency?: string | null
  /** Market detected from file content (e.g. 'NSE', 'NYSE', 'Forex'). */
  detectedMarket?: string | null
  /** Trade symbols extracted from the file. */
  symbols?: string[]
  /** Value of the tradesaath-currency cookie (set by middleware from Edge geo). */
  cookieCurrency?: string | null
  /** Raw Accept-Language header from the upload request. */
  acceptLanguage?: string | null
}

/**
 * Run the 5-step currency resolution chain. Returns the first non-null
 * step's result, falling back to FALLBACK_CURRENCY ('USD') if every
 * step yields no answer.
 *
 * Async signature is future-proofing for the day step 4 needs to query
 * a users.country column. Today it doesn't await anything; safe to
 * call in any async context.
 */
export async function resolveCurrency(opts: ResolveCurrencyOpts): Promise<CurrencyCode> {
  // Step 1: file-detected currency, if it's a known code
  if (isValidCurrency(opts.detectedCurrency)) return opts.detectedCurrency

  // Step 2: market → currency
  const fromMarket = marketToCurrency(opts.detectedMarket ?? null)
  if (fromMarket) return fromMarket

  // Step 3: symbol-based detection
  const fromSymbols = detectCurrencyFromSymbols(opts.symbols ?? [])
  if (fromSymbols) return fromSymbols

  // Step 4: cookie set by middleware from Vercel Edge geo
  if (isValidCurrency(opts.cookieCurrency)) return opts.cookieCurrency

  // Step 5: Accept-Language header
  const fromHeader = parseAcceptLanguage(opts.acceptLanguage ?? null)
  if (fromHeader) return fromHeader

  // Step 6: explicit fallback
  return FALLBACK_CURRENCY
}
