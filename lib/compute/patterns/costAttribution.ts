/**
 * COST ATTRIBUTION — ported from legacy patternDetector.ts.
 *
 * Per-trade cost (MISTAKE tag on a losing trade):
 *   baseCost = max(0, |pnl| - sessionAvgLoss)
 *   cost     = baseCost × confidenceMultiplier(confidence)
 *
 * 85% gross-loss cap:
 *   If Σ cost > grossLoss × 0.85, scale down proportionally so the
 *   sum equals grossLoss × 0.85.  wasCapped=true in that case.
 *
 * 'disciplined' and 'win' always carry cost=0.
 */

import type { DetectedPattern, EnrichedTrade } from '../types'
import { confidenceMultiplier, MISTAKE_TAGS } from './signals'

export interface CostAttributionResult {
  patterns: DetectedPattern[]
  totalCost: number
  wasCapped: boolean
}

export function attributeCosts(
  patterns: DetectedPattern[],
  enrichedTrades: EnrichedTrade[]
): CostAttributionResult {
  // Compute session avg loss from enrichedTrades (same formula as detectors)
  const losingAbs: number[] = []
  for (const t of enrichedTrades) {
    const p = Number(t.pnl) || 0
    if (p < 0) losingAbs.push(Math.abs(p))
  }
  const sessionAvgLoss =
    losingAbs.length > 0
      ? losingAbs.reduce((a, b) => a + b, 0) / losingAbs.length
      : 0
  const grossLoss = losingAbs.reduce((a, b) => a + b, 0)

  // Pass 1: assign raw cost per pattern.
  const withCost = patterns.map((p) => {
    if (!MISTAKE_TAGS.has(p.tag)) {
      return { ...p, cost: 0 }
    }
    const trade = enrichedTrades[p.tradeIndex]
    if (!trade) return { ...p, cost: 0 }
    const pnl = Number(trade.pnl) || 0
    if (pnl >= 0) return { ...p, cost: 0 }
    const baseCost = Math.max(0, Math.abs(pnl) - sessionAvgLoss)
    const cost = baseCost * confidenceMultiplier(p.confidence)
    return { ...p, cost }
  })

  // Pass 2: 85% gross-loss cap — proportional scale-down.
  const rawTotal = withCost.reduce((a, p) => a + p.cost, 0)
  const maxAllowed = grossLoss * 0.85
  let wasCapped = false
  let finalPatterns = withCost
  if (rawTotal > maxAllowed && rawTotal > 0 && maxAllowed > 0) {
    const scale = maxAllowed / rawTotal
    finalPatterns = withCost.map((p) => ({
      ...p,
      cost: p.cost > 0 ? Math.round(p.cost * scale * 100) / 100 : 0,
    }))
    wasCapped = true
  }

  const totalCost = finalPatterns.reduce((a, p) => a + p.cost, 0)
  return { patterns: finalPatterns, totalCost, wasCapped }
}
