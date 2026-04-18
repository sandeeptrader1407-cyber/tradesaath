// Simple in-memory cache for dashboard stats (60s TTL)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cache stores dynamic response shape
export const statsCache = new Map<string, { data: any; expiresAt: number }>()

/** Call this to invalidate a user's cached dashboard stats */
export function bustDashboardCache(userId: string) {
  statsCache.delete(`stats:${userId}`)
}
