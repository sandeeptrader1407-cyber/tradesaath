/**
 * Module 2, Layer 6 — Aggregate: Time Slot Metrics (30-min + 60-min).
 *
 * Groups by trade.timeSlot30min or trade.timeSlot60min (pre-computed in
 * enrichTrade). Slot strings are of the form "HH:MM-HH:MM".
 *
 * Trades whose entryTime is empty AND whose hourOfDay is 0 are skipped —
 * they would otherwise all bucket into "00:00" and pollute the data.
 * Legitimate 00:00 trades are unusual for intraday equities.
 *
 * Only slots that have at least 1 trade are returned. Sorted by
 * startHour ASC then startMinute ASC.
 */

import type { EnrichedTrade, TimeSlotMetrics } from '../types'

function parseSlot(slot: string): { startHour: number; startMinute: number } {
  const m = /^(\d{1,2}):(\d{1,2})-/.exec(slot)
  if (!m) return { startHour: 0, startMinute: 0 }
  return { startHour: Number(m[1]) || 0, startMinute: Number(m[2]) || 0 }
}

function hasUsableTime(t: EnrichedTrade): boolean {
  const et = String((t as unknown as { entryTime?: string }).entryTime ?? '')
  if (!et.trim() && (t.hourOfDay ?? 0) === 0) return false
  return true
}

function aggregate(
  trades: EnrichedTrade[],
  slotKey: 'timeSlot30min' | 'timeSlot60min'
): TimeSlotMetrics[] {
  if (trades.length === 0) return []
  const groups = new Map<string, EnrichedTrade[]>()
  for (const t of trades) {
    if (!hasUsableTime(t)) continue
    const slot = String(t[slotKey] ?? '')
    if (!slot) continue
    const arr = groups.get(slot)
    if (arr) arr.push(t)
    else groups.set(slot, [t])
  }

  const out: TimeSlotMetrics[] = []
  for (const [slot, group] of Array.from(groups.entries())) {
    const { startHour, startMinute } = parseSlot(slot)
    let winCount = 0
    let totalPnl = 0
    for (const t of group) {
      if (t.isWin) winCount += 1
      totalPnl += Number(t.pnl) || 0
    }
    const tradeCount = group.length
    out.push({
      slot,
      startHour,
      startMinute,
      tradeCount,
      winCount,
      winRate: tradeCount > 0 ? winCount / tradeCount : 0,
      totalPnl,
      avgPnl: totalPnl / tradeCount,
    })
  }

  out.sort((a, b) => {
    if (a.startHour !== b.startHour) return a.startHour - b.startHour
    return a.startMinute - b.startMinute
  })
  return out
}

export function computeTimeSlots30min(
  trades: EnrichedTrade[]
): TimeSlotMetrics[] {
  return aggregate(trades, 'timeSlot30min')
}

export function computeTimeSlots60min(
  trades: EnrichedTrade[]
): TimeSlotMetrics[] {
  return aggregate(trades, 'timeSlot60min')
}
