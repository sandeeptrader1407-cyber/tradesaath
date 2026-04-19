/**
 * Module 2, Layer 7 — Behavioral highlights (3-6 callouts).
 *
 * Pure rule-based generation. Sorted critical → warning → info.
 * Capped at 6 items.
 */

import type {
  DetectedPattern,
  DQSResult,
  SessionInsights,
  SessionMetrics,
  ViciousCycle,
} from '../types'

type Highlight = SessionInsights['behavioralHighlights'][number]

function severityFromCycle(
  s: ViciousCycle['severity']
): Highlight['severity'] {
  if (s === 'severe') return 'critical'
  if (s === 'moderate') return 'warning'
  return 'info'
}

function severityRank(s: Highlight['severity']): number {
  if (s === 'critical') return 0
  if (s === 'warning') return 1
  return 2
}

function countTag(patterns: DetectedPattern[], tag: string): number {
  let n = 0
  for (const p of patterns) if (p.tag === tag) n += 1
  return n
}

export function buildBehavioralHighlights(
  patterns: DetectedPattern[],
  cycles: ViciousCycle[],
  metrics: SessionMetrics,
  dqs: DQSResult
): Highlight[] {
  const out: Highlight[] = []

  // Cycle detected (emit only the dominant one — not every cycle)
  if (cycles.length > 0) {
    let dom = cycles[0]
    for (const c of cycles.slice(1)) {
      if (severityRank(severityFromCycle(c.severity)) <
          severityRank(severityFromCycle(dom.severity))) {
        dom = c
      }
    }
    out.push({
      icon: '🌀',
      title: 'Emotional Cycle Detected',
      description: dom.description,
      severity: severityFromCycle(dom.severity),
    })
  }

  // Overtrading — at least 3 overtrading tags
  const overtradingCount = countTag(patterns, 'overtrading')
  if (overtradingCount >= 3) {
    out.push({
      icon: '⚡',
      title: 'Overtrading',
      description: `${overtradingCount} trades in a compressed window`,
      severity: 'warning',
    })
  }

  // Revenge trading — 2+
  const revengeCount = countTag(patterns, 'revenge')
  if (revengeCount >= 2) {
    out.push({
      icon: '🔁',
      title: 'Revenge Trading',
      description: `${revengeCount} revenge entries after losses`,
      severity: 'critical',
    })
  }

  // Consistent sizing
  const psScore = Number(dqs.subScores?.positionSizing?.score) || 0
  if (psScore >= 85) {
    out.push({
      icon: '📏',
      title: 'Consistent Sizing',
      description: 'Position sizes within 30% of average',
      severity: 'info',
    })
  }

  // Clean session
  if ((Number(dqs.overall) || 0) >= 85) {
    out.push({
      icon: '✅',
      title: 'Clean Session',
      description: `Grade ${dqs.grade}, few or no mistakes`,
      severity: 'info',
    })
  }

  // Outsized loss — worst trade > 3% of peak capital
  const peak = Math.max(0, Number(metrics.peakCapitalAtOneTime) || 0)
  const worstAbs = Math.abs(Number(metrics.worstTradePnl) || 0)
  if (peak > 0 && worstAbs / peak > 0.03) {
    const pct = ((worstAbs / peak) * 100).toFixed(1)
    out.push({
      icon: '⚠️',
      title: 'Outsized Loss',
      description: `One trade lost ${pct}% of peak capital`,
      severity: 'critical',
    })
  }

  // High win rate
  if (metrics.winRate >= 0.7 && metrics.totalTrades >= 5) {
    const decided = metrics.winCount + metrics.lossCount
    out.push({
      icon: '🎯',
      title: 'High Win Rate',
      description: `Won ${metrics.winCount} of ${decided} trades`,
      severity: 'info',
    })
  }

  // Sort: critical first, then warning, then info. Stable within group.
  out.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))

  // Cap at 6
  return out.slice(0, 6)
}
