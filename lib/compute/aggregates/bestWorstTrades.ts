/**
 * Module 2, Layer 6 — Aggregate: Best/Worst Trades.
 *
 * top5Wins:    up to 5 winners, highest pnl first.
 * worst5Losses: up to 5 losers, most negative pnl first.
 *
 * A "winner" is trade.isWin; a "loser" is trade.isLoss. Breakevens are
 * excluded from both. If fewer than 5 exist, we return what we have.
 * worst5Losses additionally includes trade.detectedTag (may be null).
 */

import type {
  EnrichedTrade,
  BestWorstTrades,
  PatternTag,
} from '../types'

type WinEntry = BestWorstTrades['top5Wins'][number]
type LossEntry = BestWorstTrades['worst5Losses'][number]

function toEntry(t: EnrichedTrade): {
  tradeIndex: number
  symbol: string
  pnl: number
  date: string
  entryTime: string
} {
  return {
    tradeIndex: Number(t.tradeIndex) || 0,
    symbol: String(t.symbol ?? ''),
    pnl: Number(t.pnl) || 0,
    date: String((t as unknown as { date?: string }).date ?? ''),
    entryTime: String(
      (t as unknown as { entryTime?: string }).entryTime ?? ''
    ),
  }
}

export function computeBestWorstTrades(
  trades: EnrichedTrade[]
): BestWorstTrades {
  if (trades.length === 0) {
    return { top5Wins: [], worst5Losses: [] }
  }

  const wins: EnrichedTrade[] = []
  const losses: EnrichedTrade[] = []
  for (const t of trades) {
    if (t.isWin) wins.push(t)
    else if (t.isLoss) losses.push(t)
  }

  wins.sort((a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0))
  losses.sort((a, b) => (Number(a.pnl) || 0) - (Number(b.pnl) || 0))

  const top5Wins: WinEntry[] = wins.slice(0, 5).map((t) => toEntry(t))
  const worst5Losses: LossEntry[] = losses.slice(0, 5).map((t) => ({
    ...toEntry(t),
    tag: (t.detectedTag ?? null) as PatternTag | null,
  }))

  return { top5Wins, worst5Losses }
}
