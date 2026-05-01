/**
 * Fetch OHLCV candles from Yahoo Finance (no API key needed).
 * Used to enrich trade sessions with market context.
 * Cache-first: check Supabase before fetching.
 */

import { getSupabaseAdmin } from '@/lib/supabase'

export interface Candle {
  time: string   // "HH:MM" in IST
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketContext {
  symbol: string
  date: string
  candles: Candle[]
  sessionTrend: 'strongly_up' | 'up' | 'flat' | 'down' | 'strongly_down'
  openPrice: number
  closePrice: number
  highOfDay: number
  lowOfDay: number
  totalRangePercent: number
}

// Map detected market/symbol to Yahoo Finance ticker
function toYahooSymbol(symbol: string, market: string): string {
  const s = symbol.toUpperCase().trim()
  // Indian indices
  if (s.includes('NIFTY') && s.includes('BANK')) return '^NSEBANK'
  if (s === 'NIFTY' || s === 'NIFTY50' || s.includes('NIFTY 50')) return '^NSEI'
  if (s.includes('FINNIFTY')) return 'NIFTY_FIN_SERVICE.NS'
  if (s.includes('MIDCPNIFTY')) return '^NSEI'
  // F&O options — use the underlying index
  if (s.includes('BANKNIFTY')) return '^NSEBANK'
  if (s.includes('NIFTY')) return '^NSEI'
  // US indices
  if (s === 'SPX' || s.includes('SP500') || s.includes('S&P')) return '^GSPC'
  if (s === 'NDX' || s.includes('NASDAQ')) return '^IXIC'
  if (s === 'DJI' || s.includes('DOW')) return '^DJI'
  // NSE stocks — append .NS
  if (market === 'NSE' || market === 'BSE') return `${s}.NS`
  // Crypto
  if (s.includes('BTC') || s.includes('BITCOIN')) return 'BTC-USD'
  if (s.includes('ETH')) return 'ETH-USD'
  // Default: try as-is
  return s
}

// Compute trend from open to close
function computeTrend(open: number, close: number, _rangePercent: number):
  MarketContext['sessionTrend'] {
  const change = ((close - open) / open) * 100
  if (change > 1.5) return 'strongly_up'
  if (change > 0.3) return 'up'
  if (change < -1.5) return 'strongly_down'
  if (change < -0.3) return 'down'
  return 'flat'
}

export async function fetchMarketContext(
  symbol: string,
  date: string,   // YYYY-MM-DD
  market: string, // 'NSE' | 'NYSE' etc
): Promise<MarketContext | null> {
  const yahooSym = toYahooSymbol(symbol, market)

  // ── Cache read ──────────────────────────────────
  try {
    const sb = getSupabaseAdmin()
    const { data: cached } = await sb
      .from('market_candles')
      .select('candles_json')
      .eq('symbol', yahooSym)
      .eq('trade_date', date)
      .eq('interval_min', 5)
      .maybeSingle()

    if (cached?.candles_json) {
      const candles = cached.candles_json as Candle[]
      if (candles.length > 0) {
        const openPrice  = candles[0].open
        const closePrice = candles[candles.length - 1].close
        const highOfDay  = Math.max(...candles.map(c => c.high))
        const lowOfDay   = Math.min(...candles.map(c => c.low))
        const rangePercent = openPrice > 0
          ? ((highOfDay - lowOfDay) / openPrice) * 100 : 0
        console.log(`[MARKET] Cache hit: ${yahooSym} ${date} (${candles.length} candles)`)
        return {
          symbol: yahooSym, date, candles,
          sessionTrend: computeTrend(openPrice, closePrice, rangePercent),
          openPrice, closePrice, highOfDay, lowOfDay,
          totalRangePercent: Math.round(rangePercent * 100) / 100,
        }
      }
    }
  } catch (cacheErr) {
    console.warn('[MARKET] Cache read failed (non-blocking):', cacheErr)
  }

  // ── Yahoo Finance fetch ─────────────────────────
  try {
    const startTs = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)
    const endTs   = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?period1=${startTs}&period2=${endTs}&interval=5m&includePrePost=false`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[] = result.timestamp || []
    const closes: number[]  = result.indicators?.quote?.[0]?.close  || []
    const opens: number[]   = result.indicators?.quote?.[0]?.open   || []
    const highs: number[]   = result.indicators?.quote?.[0]?.high   || []
    const lows: number[]    = result.indicators?.quote?.[0]?.low    || []
    const volumes: number[] = result.indicators?.quote?.[0]?.volume || []

    const candles: Candle[] = []
    for (let i = 0; i < timestamps.length; i++) {
      if (!closes[i] || !opens[i]) continue
      // Convert UTC timestamp to IST (UTC+5:30)
      const d = new Date(timestamps[i] * 1000)
      const istHours   = (d.getUTCHours() + 5) % 24
      const istMinutes = (d.getUTCMinutes() + 30) % 60
      const carryHour  = d.getUTCMinutes() + 30 >= 60 ? 1 : 0
      const h = (istHours + carryHour) % 24
      const m = istMinutes
      candles.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        open:   Math.round(opens[i]   * 100) / 100,
        high:   Math.round(highs[i]   * 100) / 100,
        low:    Math.round(lows[i]    * 100) / 100,
        close:  Math.round(closes[i]  * 100) / 100,
        volume: volumes[i] || 0,
      })
    }

    if (candles.length === 0) return null

    // ── Cache write (fire-and-forget) ──────────────
    getSupabaseAdmin()
      .from('market_candles')
      .upsert({
        symbol: yahooSym,
        trade_date: date,
        interval_min: 5,
        candles_json: candles,
      }, { onConflict: 'symbol,trade_date,interval_min' })
      .then(
        () => console.log(`[MARKET] Cached ${candles.length} candles for ${yahooSym} ${date}`),
        (e: unknown) => console.warn('[MARKET] Cache write failed:', e),
      )

    const openPrice  = candles[0].open
    const closePrice = candles[candles.length - 1].close
    const highOfDay  = Math.max(...candles.map(c => c.high))
    const lowOfDay   = Math.min(...candles.map(c => c.low))
    const rangePercent = openPrice > 0
      ? ((highOfDay - lowOfDay) / openPrice) * 100 : 0

    return {
      symbol: yahooSym,
      date,
      candles,
      sessionTrend: computeTrend(openPrice, closePrice, rangePercent),
      openPrice,
      closePrice,
      highOfDay,
      lowOfDay,
      totalRangePercent: Math.round(rangePercent * 100) / 100,
    }
  } catch {
    return null
  }
}

// Get the candle closest to a given time string "HH:MM"
export function getCandleAtTime(
  candles: Candle[],
  time: string,
): Candle | null {
  if (!candles.length || !time) return null
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  const target = h * 60 + m
  let best: Candle | null = null
  let bestDiff = Infinity
  for (const c of candles) {
    const [ch, cm] = c.time.split(':').map(Number)
    const diff = Math.abs(ch * 60 + cm - target)
    if (diff < bestDiff) { bestDiff = diff; best = c }
  }
  return bestDiff <= 10 ? best : null // within 10 minutes
}

// What happened AFTER a trade exit — did price keep going or reverse?
export function getPostExitMove(
  candles: Candle[],
  exitTime: string,
  side: 'BUY' | 'SELL', // the trade's direction
  lookforwardMinutes = 15,
): { direction: 'continued' | 'reversed' | 'flat'; magnitude: number } | null {
  const exitCandle = getCandleAtTime(candles, exitTime)
  if (!exitCandle) return null
  const [eh, em] = exitCandle.time.split(':').map(Number)
  const exitMins = eh * 60 + em
  const laterCandles = candles.filter(c => {
    const [ch, cm] = c.time.split(':').map(Number)
    const mins = ch * 60 + cm
    return mins > exitMins && mins <= exitMins + lookforwardMinutes
  })
  if (!laterCandles.length) return null
  const lastClose = laterCandles[laterCandles.length - 1].close
  const move = ((lastClose - exitCandle.close) / exitCandle.close) * 100
  const absMagnitude = Math.abs(Math.round(move * 100) / 100)
  // For a BUY trade: if price went up after you sold = reversed (you exited too early)
  // For a SELL trade: if price went down after you covered = reversed (you exited too early)
  const continued = side === 'BUY' ? move < -0.1 : move > 0.1
  const reversed  = side === 'BUY' ? move >  0.1 : move < -0.1
  return {
    direction: continued ? 'continued' : reversed ? 'reversed' : 'flat',
    magnitude: absMagnitude,
  }
}

export interface TradeEnrichment {
  entryCandle:  Candle | null
  exitCandle:   Candle | null
  postExitMove: { direction: 'continued' | 'reversed' | 'flat'; magnitude: number } | null
  trendAtEntry: 'with_trend' | 'counter_trend' | 'flat' | 'unknown'
  entryContext: string   // human-readable sentence
  exitContext:  string   // human-readable sentence
}

export function enrichTrade(
  trade: Record<string, unknown>,
  ctx: MarketContext,
): TradeEnrichment {
  const entryTime = String(trade.entry_time ?? trade.time ?? '')
  const exitTime  = String(trade.exit_time  ?? '')
  const side      = String(trade.side ?? 'BUY').toUpperCase() as 'BUY' | 'SELL'

  const entryCandle = getCandleAtTime(ctx.candles, entryTime)
  const exitCandle  = exitTime ? getCandleAtTime(ctx.candles, exitTime) : null
  const postExitMove = exitTime
    ? getPostExitMove(ctx.candles, exitTime, side, 15)
    : null

  // Was entry with or against the session trend?
  let trendAtEntry: TradeEnrichment['trendAtEntry'] = 'unknown'
  if (entryCandle && ctx.candles.length >= 6) {
    const [eh, em] = entryCandle.time.split(':').map(Number)
    const entryMins = eh * 60 + em
    const priorCandles = ctx.candles.filter(c => {
      const [ch, cm] = c.time.split(':').map(Number)
      const mins = ch * 60 + cm
      return mins >= entryMins - 20 && mins < entryMins
    })
    if (priorCandles.length >= 2) {
      const priorMove = priorCandles[priorCandles.length - 1].close
        - priorCandles[0].open
      const risingMarket = priorMove > 0
      if (side === 'BUY')  trendAtEntry = risingMarket ? 'with_trend' : 'counter_trend'
      if (side === 'SELL') trendAtEntry = risingMarket ? 'counter_trend' : 'with_trend'
      if (Math.abs(priorMove / Math.max(1, priorCandles[0].open)) < 0.001)
        trendAtEntry = 'flat'
    }
  }

  const trendLabel = ctx.sessionTrend === 'strongly_up'   ? 'strongly rising'
    : ctx.sessionTrend === 'up'           ? 'rising'
    : ctx.sessionTrend === 'strongly_down' ? 'strongly falling'
    : ctx.sessionTrend === 'down'         ? 'falling'
    : 'range-bound'

  const entryCtxParts: string[] = []
  if (entryCandle) {
    entryCtxParts.push(`Market was ${trendLabel} at entry (${entryCandle.time}).`)
  }
  if (trendAtEntry === 'counter_trend') {
    entryCtxParts.push(`Your ${side === 'BUY' ? 'long' : 'short'} was against the prior 20-min move.`)
  } else if (trendAtEntry === 'with_trend') {
    entryCtxParts.push(`Entry was aligned with the short-term trend.`)
  }

  const exitCtxParts: string[] = []
  if (postExitMove) {
    if (postExitMove.direction === 'reversed') {
      exitCtxParts.push(
        `Price moved ${postExitMove.magnitude.toFixed(1)}% in your favour within 15 min of your exit — you exited before the move.`
      )
    } else if (postExitMove.direction === 'continued') {
      exitCtxParts.push(
        `Price continued ${postExitMove.magnitude.toFixed(1)}% against you after exit — your direction was wrong, not just your timing.`
      )
    } else {
      exitCtxParts.push(`Market moved sideways after your exit.`)
    }
  }

  return {
    entryCandle,
    exitCandle,
    postExitMove,
    trendAtEntry,
    entryContext: entryCtxParts.join(' '),
    exitContext:  exitCtxParts.join(' '),
  }
}
