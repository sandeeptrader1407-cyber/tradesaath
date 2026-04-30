/**
 * Rate limiter backed by Vercel KV (Upstash Redis).
 *
 * Replaces the old in-memory Map which was useless on serverless —
 * each cold start got a fresh Map, so limits never accumulated.
 *
 * Requires KV_REST_API_URL + KV_REST_API_TOKEN env vars (set automatically
 * when you link a Vercel KV store in the dashboard).
 *
 * Falls back to a permissive in-memory Map if KV is not configured,
 * so local dev and preview deploys without KV still work.
 */

import { kv, KV_AVAILABLE } from '@/lib/kv'

interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number
}

// ---------- In-memory fallback (dev / preview without KV) ----------
interface RateLimitEntry { count: number; resetAt: number }
const memStore = new Map<string, RateLimitEntry>()

function rateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetIn: windowMs }
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetIn: entry.resetAt - now }
  }
  entry.count++
  return { success: true, remaining: limit - entry.count, resetIn: entry.resetAt - now }
}

// ---------- KV-backed rate limiter (production) ----------
async function rateLimitKV(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const rlKey = `rl:${key}`
  const windowSec = Math.ceil(windowMs / 1000)

  try {
    // INCR + conditional EXPIRE is atomic enough for rate limiting.
    // If the key is new, INCR creates it with value 1.
    const count = await kv.incr(rlKey)

    if (count === 1) {
      // First request in this window — set expiry
      await kv.expire(rlKey, windowSec)
    }

    // Get TTL to report remaining time
    const ttl = await kv.ttl(rlKey)
    const resetIn = (ttl > 0 ? ttl : windowSec) * 1000

    if (count > limit) {
      return { success: false, remaining: 0, resetIn }
    }

    return { success: true, remaining: limit - count, resetIn }
  } catch (err) {
    // KV failure → allow the request (fail open)
    console.error('[RateLimit] KV error, allowing request:', err)
    return { success: true, remaining: limit, resetIn: windowMs }
  }
}

// ---------- Public API ----------

/** Rate-limit a key. Async — must be awaited. */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (!KV_AVAILABLE) return rateLimitMemory(key, limit, windowMs)
  return rateLimitKV(key, limit, windowMs)
}

/** Extract client IP from Next.js request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Standard 429 Too Many Requests response */
export function rateLimitResponse(resetIn: number) {
  const retryAfter = Math.ceil(resetIn / 1000)
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  )
}
