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
 * TODO: Expand as more markets are supported.
 */
export function marketToCurrency(market: string): CurrencyCode {
  const m = (market || '').toUpperCase()
  if (m === 'NSE' || m === 'BSE' || m === 'MCX') return 'INR'
  if (m === 'NYSE' || m === 'NASDAQ' || m === 'AMEX' || m === 'CBOE') return 'USD'
  if (m === 'LSE') return 'GBP'
  if (m === 'TSE' || m === 'JPX') return 'JPY'
  if (m === 'SGX') return 'SGD'
  if (m === 'ASX') return 'AUD'
  if (m === 'TSX') return 'CAD'
  // European exchanges
  if (m === 'XETRA' || m === 'EURONEXT') return 'EUR'
  // Default to INR for now (primary user base)
  return 'INR'
}
