/**
 * Module 2, Layer 4 — DQS Sub-score: Rule Following (weight 5%).
 *
 * PORT SOURCE: lib/analysis/patternDetector.ts, lines 689-698:
 *   ruleFollowing = 100
 *   if (overtradingDetected) ruleFollowing -= 25
 *   walk trades; consec++ on losers, reset on winners
 *     if consec >= 3  → hit = true
 *     else if (hit)   → afterThresh++
 *   if (hit && afterThresh > 0) ruleFollowing -= min(40, afterThresh * 5)
 *   ruleFollowing = clamp(ruleFollowing)
 *
 * overtradingDetected in legacy derives from `n > avgDailyTrades * 1.5`.
 * Without a user baseline plumbed to this layer, we infer from patterns:
 * any trade tagged 'overtrading' implies the upstream detector evaluated
 * overtradingDetected=true (the pattern layer's rule). This exactly
 * reproduces the legacy outcome on the session-only (no-baseline) path
 * — which is the only path the current compute pipeline uses.
 *
 * Inputs used:  trades[].pnl (for the streak walk), patterns[] (tag)
 * Inputs unused: cycles[]
 */

import type {
  EnrichedTrade,
  DetectedPattern,
  ViciousCycle,
  DQSSubScore,
} from '../types'

export const RULE_FOLLOWING_WEIGHT = 5

export function scoreRuleFollowing(
  trades: EnrichedTrade[],
  patterns: DetectedPattern[],
  _cycles: ViciousCycle[]
): DQSSubScore {
  const n = trades.length
  if (n === 0) {
    return {
      name: 'Rule Following',
      score: 100,
      weight: RULE_FOLLOWING_WEIGHT,
      detail: 'No trades to score.',
      suggestion:
        'Cap daily trades at 1.2× your norm and stop trading after 3 consecutive losses.',
    }
  }

  const overtradingDetected = patterns.some((p) => p.tag === 'overtrading')

  // Walk trades once to count trades-after-3-in-a-row-losses.
  let consec = 0
  let afterThresh = 0
  let hit = false
  for (const t of trades) {
    const pnl = Number(t.pnl) || 0
    if (pnl < 0) consec += 1
    else consec = 0
    if (consec >= 3) hit = true
    else if (hit) afterThresh += 1
  }

  let score = 100
  if (overtradingDetected) score -= 25
  if (hit && afterThresh > 0) score -= Math.min(40, afterThresh * 5)
  score = Math.max(0, Math.min(100, score))

  const parts: string[] = []
  if (overtradingDetected) parts.push('overtrading detected')
  if (hit) {
    parts.push(
      `${afterThresh} trade${afterThresh === 1 ? '' : 's'} after 3-in-a-row losses`
    )
  }
  const detail =
    parts.length > 0
      ? `Rules broken: ${parts.join('; ')}.`
      : 'No rule breaks — session stayed within daily volume and post-loss cooldowns.'

  const suggestion =
    score < 60
      ? 'Two rule breaks compounded today. Write down your daily trade cap and your "stop after 3 losses" rule where you can see them.'
      : score < 85
        ? 'One rule slipped — likely the 3-loss cooldown. Hard-stop next time.'
        : 'Rule-following is automatic — that compounds over months.'

  return {
    name: 'Rule Following',
    score: Math.round(score),
    weight: RULE_FOLLOWING_WEIGHT,
    detail,
    suggestion,
  }
}
