/**
 * Module 2, Layer 6 — Aggregate: Equity Curve with Drawdown.
 *
 * One EquityCurvePoint per trade, in session order (by tradeIndex ASC).
 * Uses pre-computed cumulativePnlAfter + drawdownFromPeak from Layer 1.
 * isNewPeak is recomputed here (a running max over cumulativePnlAfter)
 * to stay honest — we do not read trade.isNewPeak (it is not a field
 * on EnrichedTrade).
 *
 * timestamp format: "YYYY-MM-DD HH:MM" (matches StandardTrade.date +
 * entryTime). If either is missing we emit whatever is present.
 */

import type { EnrichedTrade, EquityCurvePoint } from '../types'

export function computeEquityCurve(
  trades: EnrichedTrade[]
): EquityCurvePoint[] {
  if (trades.length === 0) return []
  const sorted = [...trades].sort(
    (a, b) => (Number(a.tradeIndex) || 0) - (Number(b.tradeIndex) || 0)
  )

  const out: EquityCurvePoint[] = []
  let runningPeak = -Infinity
  for (const t of sorted) {
    const cum = Number(t.cumulativePnlAfter) || 0
    const isNewPeak = cum > runningPeak
    if (isNewPeak) runningPeak = cum
    const date = String((t as unknown as { date?: string }).date ?? '')
    const entryTime = String(
      (t as unknown as { entryTime?: string }).entryTime ?? ''
    )
    const timestamp =
      date && entryTime ? `${date} ${entryTime}` : date || entryTime
    out.push({
      tradeIndex: Number(t.tradeIndex) || 0,
      tradeNumber: (Number(t.tradeIndex) || 0) + 1,
      timestamp,
      cumulativePnl: cum,
      drawdownFromPeak: Number(t.drawdownFromPeak) || 0,
      isNewPeak,
    })
  }
  return out
}
