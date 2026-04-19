/**
 * Module 2, Layer 6 — Aggregate: Holding Time Distribution.
 *
 * Groups by trade.holdingCategory. Returns ONLY buckets with trades
 * (UI can pad with zero-count buckets if it wants). Sorted in natural
 * duration order: scalp, quick, normal, extended, positional.
 */

import type { EnrichedTrade, HoldingTimeDistribution } from '../types'

type Bucket = 'scalp' | 'quick' | 'normal' | 'extended' | 'positional'

const BUCKET_ORDER: Bucket[] = [
  'scalp',
  'quick',
  'normal',
  'extended',
  'positional',
]

const BUCKET_LABELS: Record<Bucket, string> = {
  scalp: 'Scalp (<2m)',
  quick: 'Quick (2-10m)',
  normal: 'Normal (10-60m)',
  extended: 'Extended (1-4h)',
  positional: 'Positional (>4h)',
}

export function computeHoldingDistribution(
  trades: EnrichedTrade[]
): HoldingTimeDistribution[] {
  if (trades.length === 0) return []
  const groups = new Map<Bucket, EnrichedTrade[]>()
  for (const t of trades) {
    const bucket = t.holdingCategory as Bucket | undefined
    if (!bucket || !BUCKET_ORDER.includes(bucket)) continue
    const arr = groups.get(bucket)
    if (arr) arr.push(t)
    else groups.set(bucket, [t])
  }

  const out: HoldingTimeDistribution[] = []
  for (const bucket of BUCKET_ORDER) {
    const group = groups.get(bucket)
    if (!group || group.length === 0) continue
    let winCount = 0
    let totalPnl = 0
    for (const t of group) {
      if (t.isWin) winCount += 1
      totalPnl += Number(t.pnl) || 0
    }
    const tradeCount = group.length
    out.push({
      bucket,
      label: BUCKET_LABELS[bucket],
      tradeCount,
      winRate: tradeCount > 0 ? winCount / tradeCount : 0,
      avgPnl: totalPnl / tradeCount,
      totalPnl,
    })
  }
  return out
}
