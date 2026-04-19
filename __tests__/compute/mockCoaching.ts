/**
 * Test-only coaching providers for analyse.test.ts.
 *
 * The production wiring (Step 8B) passes a real Anthropic-backed
 * provider into analyseSession. For tests, we use these mocks to
 * verify the orchestrator's contract with any CoachingProvider:
 *
 *   - ctx is passed correctly
 *   - string result ends up on insights.aiCoaching
 *   - non-string result is coerced to ''
 *   - thrown errors become warnings (non-fatal)
 *   - slow providers are aborted by coachingTimeoutMs
 */

import type {
  CoachingProvider,
  CoachingContext,
} from '@/lib/compute/analyse'

/** Returns a deterministic coaching line derived from ctx. */
export const mockCoachingProvider: CoachingProvider = async (
  ctx: CoachingContext
) => {
  const n = ctx.trades.length
  const pnl = ctx.metrics.totalPnl
  return `Coach: ${n} trades, pnl=${pnl}, dqs=${ctx.dqs.overall}`
}

/** Sleeps `delayMs` before resolving — used to test timeout path. */
export function slowCoachingProvider(delayMs = 500): CoachingProvider {
  return async () => {
    await new Promise((r) => setTimeout(r, delayMs))
    return 'too-slow'
  }
}

/** Always throws — used to test warning-on-failure path. */
export const failingCoachingProvider: CoachingProvider = async () => {
  throw new Error('boom')
}

/** Returns a non-string value (simulates a misbehaving provider). */
export const nonStringCoachingProvider: CoachingProvider = async () => {
  // Intentionally wrong shape — orchestrator must coerce to ''
  return 12345 as unknown as string
}

/** Captures the ctx passed to it so tests can inspect it. */
export function capturingCoachingProvider(): {
  provider: CoachingProvider
  getCapturedCtx: () => CoachingContext | null
} {
  let captured: CoachingContext | null = null
  return {
    provider: async (ctx) => {
      captured = ctx
      return 'captured'
    },
    getCapturedCtx: () => captured,
  }
}
