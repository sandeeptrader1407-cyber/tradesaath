'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR'

export const SUPPORTED_CURRENCIES: readonly Currency[] = ['USD', 'EUR', 'GBP', 'INR'] as const

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
}

const COOKIE_NAME = 'tradesaath-currency'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

interface CurrencyContextValue {
  currency: Currency
  setCurrency: (next: Currency) => void
  /** True after the client has read the cookie — useful to avoid flash. */
  hydrated: boolean
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

function readCookieCurrency(): Currency {
  if (typeof document === 'undefined') return 'USD'
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  if (!match) return 'USD'
  const raw = decodeURIComponent(match[1]).toUpperCase()
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(raw) ? (raw as Currency) : 'USD'
}

function writeCookieCurrency(next: Currency): void {
  if (typeof document === 'undefined') return
  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(next)}; ` +
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}; ` +
    `Path=/; SameSite=Lax`
}

interface CurrencyProviderProps {
  children: ReactNode
  /** Optional default — usually the cookie wins immediately on mount. */
  initial?: Currency
}

export function CurrencyProvider({ children, initial = 'USD' }: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState<Currency>(initial)
  const [hydrated, setHydrated] = useState(false)

  // Read cookie on mount (middleware sets it from IP geo).
  useEffect(() => {
    setCurrencyState(readCookieCurrency())
    setHydrated(true)
  }, [])

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next)
    writeCookieCurrency(next)
  }, [])

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, hydrated }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('useCurrency must be used within <CurrencyProvider>')
  }
  return ctx
}
