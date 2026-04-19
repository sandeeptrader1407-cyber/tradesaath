/**
 * Feature flags for TradeSaath.
 *
 * Read from env vars at module load. All flags default to OFF so
 * shipping new flags never changes behaviour unless explicitly
 * enabled in the deployment environment.
 *
 * Rollout pattern for risky changes:
 *   1. Ship code with flag off (default)
 *   2. Turn on SHADOW_MODE in prod — both paths run, old serves,
 *      differences are logged for a week
 *   3. Turn on the main flag once diffs are resolved
 *   4. Delete the old path + flag in a follow-up
 */

export const FLAGS = {
  /**
   * Module 2 compute pipeline — when true, session analysis runs
   * through `lib/compute/analyse.ts` instead of the legacy
   * `lib/analysis/patternDetector` + `buildAnalysisJSON`.
   *
   * Enable via env:  NEXT_PUBLIC_USE_MODULE_2=true
   */
  USE_MODULE_2_COMPUTE:
    process.env.NEXT_PUBLIC_USE_MODULE_2 === 'true',

  /**
   * Shadow mode — when true, both pipelines run. The OLD result is
   * served to the user (safe default), and a one-line diff is logged
   * as `[MODULE_2_SHADOW]` so we can compare on real traffic before
   * flipping `USE_MODULE_2_COMPUTE`.
   *
   * Server-side only (no NEXT_PUBLIC_ prefix). Takes precedence over
   * USE_MODULE_2_COMPUTE — if shadow mode is on, the old path wins.
   *
   * Enable via env:  MODULE_2_SHADOW_MODE=true
   */
  MODULE_2_SHADOW_MODE:
    process.env.MODULE_2_SHADOW_MODE === 'true',
} as const

export type FlagName = keyof typeof FLAGS
