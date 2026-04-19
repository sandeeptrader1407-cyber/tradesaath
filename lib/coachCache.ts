/**
 * Coach plan cache invalidation hook.
 *
 * `/api/coach` currently generates a fresh Anthropic call on every POST and
 * does not use Next.js fetch cache tags, so this function is a no-op at the
 * network layer today. It exists so that when a session is re-analysed we
 * have a clean seam to invalidate coach-plan caches — both for future
 * network-layer caching (via `{ next: { tags: [`coach-plan-${userId}`] } }`)
 * and for any additional caches (Redis, KV, etc.) added later.
 *
 * Wrapped in try/catch because `revalidateTag` throws outside a
 * request/action context (e.g. standalone test harnesses, scripts). The
 * hook is forward-compat safety, not critical path.
 */

import { revalidateTag } from 'next/cache'

export function bustCoachPlanCache(userId: string): void {
  try {
    revalidateTag(`coach-plan-${userId}`)
  } catch {
    /* non-blocking — revalidateTag unavailable outside request context */
  }
}
