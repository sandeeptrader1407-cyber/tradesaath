/**
 * Module 2, Layer 4 — DQS Sub-score: Risk Management (weight 25%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 662-665:
 *   maxLoss            = max of |pnl| over losing trades
 *   sessionAvgLoss     = mean of |pnl| over losing trades
 *   riskRatio          = sessionAvgLoss > 0 ? maxLoss / sessionAvgLoss : 1
 *   riskManagement     = clamp(100 - Math.max(0, (riskRatio - 1.5)) * 30)
 *
 * Formula is mirrored EXACTLY — no new scoring logic. The `detail`
 * and `suggestion` fields are NEW (not present in legacy DQS<number>
 * shape) but are composed from the same underlying data only.
 *
 * Intuition: one loss that dwarfs the session average is the
 * fingerprint of a broken risk control. Penalise once a single loss
 * goes beyond 1.5× session-avg loss, at 30 points per multiple.
 *
 * Inputs used:  trades[].pnl
 * Inputs unused: patterns[], cycles[] (accepted for API symmetry)
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  DQSSubScore,
} from '../types'

export const RISK_MANAGEMENT_WEIGHT = 25

export function scoreRiskManagement(
  trades: EnrichedTrade[],
  _patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  if (trades.length === 0) {
    return {
      name: 'Risk Management',
      score: 100,
      weight: RISK_MANAGEMENT_WEIGHT,
      detail: 'No trades to score.',
      suggestion: 'Keep single-trade risk below 1.5× your average loss.',
    }
  }

  const losingAbs = trades
    .map((t) => Number(t.pnl) || 0)
    .filter((p) => p < 0)
    .map((p) => Math.abs(p))

  // No losing trades — risk was perfect by construction.
  if (losingAbs.length === 0) {
    return {
      name: 'Risk Management',
      score: 100,
      weight: RISK_MANAGEMENT_WEIGHT,
      detail: 'No losses — risk control held across the entire session.',
      suggestion: 'Keep enforcing your 1.5× single-trade-loss ceiling.',
    }
  }

  const maxLoss = Math.max(...losingAbs)
  const sessionAvgLoss =
    losingAbs.reduce((a, b) => a + b, 0) / losingAbs.length
  const riskRatio = sessionAvgLoss > 0 ? maxLoss / sessionAvgLoss : 1

  const raw = 100 - Math.max(0, riskRatio - 1.5) * 30
  const score = Math.max(0, Math.min(100, raw))

  const detail =
    riskRatio > 1.5
      ? `Worst loss ₹${Math.round(maxLoss).toLocaleString('en-IN')} is ${riskRatio.toFixed(2)}× your session-average loss of ₹${Math.round(sessionAvgLoss).toLocaleString('en-IN')}.`
      : `Worst loss is ${riskRatio.toFixed(2)}× session average — within your 1.5× risk budget.`

  const suggestion =
    score < 60
      ? 'Set a hard per-trade stop at 1.5× your average loss. One blow-up trade should never define the session.'
      : score < 85
        ? 'Tighten the stop on your biggest outlier — one more cap-move pushes this into A-grade.'
        : 'Risk sizing is dialled in. Keep enforcing the 1.5× ceiling.'

  return {
    name: 'Risk Management',
    score: Math.round(score),
    weight: RISK_MANAGEMENT_WEIGHT,
    detail,
    suggestion,
  }
}
