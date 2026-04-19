/**
 * Module 2, Layer 7 — Narrative generator (code, no AI).
 *
 * 3-4 sentence session summary. Chosen pattern based on
 * (totalTrades, totalPnl, dqs.overall, cycles, biggestDrag).
 *
 * Keep output under 500 characters. Purely deterministic.
 */

import type {
  EnrichedTrade,
  SessionMetrics,
  ViciousCycle,
  DQSResult,
} from '../types'
import { formatCurrency } from '../../utils/currency'

function severityRank(s: ViciousCycle['severity']): number {
  if (s === 'severe') return 3
  if (s === 'moderate') return 2
  return 1
}

function dominantCycle(cycles: ViciousCycle[]): ViciousCycle | null {
  if (!cycles.length) return null
  let best = cycles[0]
  for (const c of cycles.slice(1)) {
    const bR = severityRank(best.severity)
    const cR = severityRank(c.severity)
    if (cR > bR) best = c
    else if (cR === bR && Math.abs(c.totalCost) > Math.abs(best.totalCost)) {
      best = c
    }
  }
  return best
}

function cap500(s: string): string {
  return s.length > 500 ? s.slice(0, 497) + '...' : s
}

export function buildNarrative(
  trades: EnrichedTrade[],
  metrics: SessionMetrics,
  cycles: ViciousCycle[],
  dqs: DQSResult
): string {
  if (metrics.totalTrades === 0) return 'No trades in this session.'

  const pnlStr = formatCurrency(metrics.totalPnl, 'INR', { signed: true })
  const n = metrics.totalTrades
  const wins = metrics.winCount
  const overall = Number(dqs.overall) || 0
  const grade = dqs.grade || 'F'
  const drag = dqs.biggestDrag?.factorName || ''
  const turningRef =
    metrics.turningPointIndex !== null
      ? `The turning point was trade #${metrics.turningPointIndex + 1}.`
      : ''

  // 1) Flat session — take this branch early so tiny P&L doesn't look
  //    like a "win" or "loss".
  const capRef = Math.max(1, metrics.peakCapitalAtOneTime || 0)
  const flatThreshold = capRef * 0.01
  if (Math.abs(metrics.totalPnl) < flatThreshold) {
    const disc =
      overall >= 80
        ? 'Discipline held (grade ' + grade + ').'
        : overall >= 65
          ? 'Mixed discipline (grade ' + grade + ').'
          : 'Discipline slipped (grade ' + grade + ').'
    return cap500(
      `Flat session. ${n} trades, roughly breakeven. ${disc}`
    )
  }

  // 2) Profitable + strong discipline
  if (metrics.totalPnl > 0 && overall >= 80) {
    return cap500(
      `Strong disciplined session. Traded ${n} times, won ${wins}, stayed within normal sizing. Grade ${grade} — this is the pattern to repeat.`
    )
  }

  // 3) Profitable but loose execution
  if (metrics.totalPnl > 0 && overall < 70) {
    const dragLine = drag ? ` Clean up ${drag} to protect this edge.` : ''
    return cap500(
      `Profitable session but execution was loose. Made ${pnlStr} on ${n} trades, but discipline slipped (grade ${grade}).${dragLine}`
    )
  }

  // 3b) Profitable, moderate discipline (70-79) — not strong, not loose
  if (metrics.totalPnl > 0) {
    return cap500(
      `Profitable session. Made ${pnlStr} on ${n} trades (${wins} winners), grade ${grade}.`
    )
  }

  // 4) Losing + emotional cycle
  if (metrics.totalPnl < 0 && cycles.length > 0) {
    const cyc = dominantCycle(cycles)
    if (cyc) {
      return cap500(
        `Tough session — ${pnlStr} loss driven by a ${cyc.severity} emotional cycle: ${cyc.description}. ${turningRef}`.trim()
      )
    }
  }

  // 5) Losing, no cycle
  if (metrics.totalPnl < 0) {
    const dragLine = drag ? ` Biggest drag: ${drag}.` : ''
    return cap500(
      `Losing session — ${pnlStr} down across ${n} trades. Grade ${grade}.${dragLine}`
    )
  }

  // Safety fallback (shouldn't reach here)
  return cap500(`${n} trades, ${pnlStr}, grade ${grade}.`)
}
