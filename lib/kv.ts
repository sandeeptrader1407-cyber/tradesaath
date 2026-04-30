/**
 * Shared KV client — bridges @vercel/kv naming (KV_REST_API_URL) with
 * Upstash direct naming (UPSTASH_REDIS_REST_URL).
 *
 * Priority: KV_REST_API_* (set by Vercel marketplace) →
 *           UPSTASH_REDIS_REST_* (set manually / Upstash dashboard).
 *
 * Falls back to no-op when neither is configured (local dev without KV).
 */

import { createClient } from '@vercel/kv'

const kvUrl   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || ''
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const kv = createClient({ url: kvUrl, token: kvToken })

export const KV_AVAILABLE = !!(kvUrl && kvToken)
