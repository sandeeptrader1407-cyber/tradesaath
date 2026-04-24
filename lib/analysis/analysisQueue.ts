/**
 * TradeSaath — KV-backed analysis queue with concurrency control.
 *
 * Key schema (all keys TTL = 15 min):
 *   batch:{id}:meta            → BatchMeta JSON
 *   batch:{id}:job:{sessionId} → QueueJob JSON  (one key per job — no read-modify-write)
 *   batch:{id}:done            → integer counter (kv.incr — atomic)
 *   batch:{id}:failed          → integer counter (kv.incr — atomic)
 *
 * Requires KV_REST_API_URL + KV_REST_API_TOKEN in all environments.
 * Local dev: add these to .env.local (Vercel KV works locally).
 *
 * Future: migrate processing to QStash/Inngest for durable execution at scale.
 */

import { kv } from '@vercel/kv'
import { analyseSession, type AnalyseSessionResult } from '@/lib/analysis/sessionAnalyser'

const CONCURRENCY = 3
const BATCH_TTL = 15 * 60 // seconds

function assertKvConfigured() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('KV_REST_API_URL (or UPSTASH_REDIS_REST_URL) and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_TOKEN) must be set.')
  }
}

export type JobStatus = 'pending' | 'running' | 'done' | 'error'

export interface QueueJob {
  sessionId: string
  userId: string
  status: JobStatus
  result?: AnalyseSessionResult
  error?: string
  startedAt?: number
  finishedAt?: number
}

interface BatchMeta {
  id: string
  userId: string
  sessionIds: string[]
  startedAt: number
  finishedAt?: number
}

export interface BatchState {
  id: string
  userId: string
  jobs: QueueJob[]
  startedAt: number
  finishedAt?: number
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

function metaKey(id: string) { return `batch:${id}:meta` }
function jobKey(id: string, sessionId: string) { return `batch:${id}:job:${sessionId}` }
function doneKey(id: string) { return `batch:${id}:done` }
function failedKey(id: string) { return `batch:${id}:failed` }

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create a new batch and start background processing. */
export async function createBatch(batchId: string, userId: string, sessionIds: string[]): Promise<void> {
  assertKvConfigured()
  const meta: BatchMeta = { id: batchId, userId, sessionIds, startedAt: Date.now() }

  // Write meta + all job initial states + counters in one pipeline round-trip
  const pipeline = kv.pipeline()
  pipeline.set(metaKey(batchId), JSON.stringify(meta), { ex: BATCH_TTL })
  for (const sessionId of sessionIds) {
    const job: QueueJob = { sessionId, userId, status: 'pending' }
    pipeline.set(jobKey(batchId, sessionId), JSON.stringify(job), { ex: BATCH_TTL })
  }
  pipeline.set(doneKey(batchId), 0, { ex: BATCH_TTL })
  pipeline.set(failedKey(batchId), 0, { ex: BATCH_TTL })
  await pipeline.exec()

  // Fire-and-forget — runs while response is already sent
  processBatchKv(batchId, userId, sessionIds).catch(err => {
    console.error(`Batch ${batchId} processing error:`, err)
  })
}

/** Fetch current state of a batch. Returns null if not found or expired. */
export async function getBatch(batchId: string): Promise<BatchState | null> {
  assertKvConfigured()
  const metaRaw = await kv.get<string | BatchMeta>(metaKey(batchId))
  if (!metaRaw) return null
  const meta: BatchMeta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw

  // Single pipeline round-trip: all job keys + done + failed counters
  const pipeline = kv.pipeline()
  for (const sessionId of meta.sessionIds) {
    pipeline.get(jobKey(batchId, sessionId))
  }
  pipeline.get(doneKey(batchId))
  pipeline.get(failedKey(batchId))

  const results = await pipeline.exec()
  const jobRaws = results.slice(0, meta.sessionIds.length)

  const jobs: QueueJob[] = jobRaws.map((raw, i) => {
    if (!raw) return { sessionId: meta.sessionIds[i], userId: meta.userId, status: 'pending' as JobStatus }
    return typeof raw === 'string' ? JSON.parse(raw) : raw as QueueJob
  })

  return {
    id: meta.id,
    userId: meta.userId,
    jobs,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
  }
}

/** Compute summary stats from a BatchState (synchronous — no DB calls). */
export function batchSummary(state: BatchState) {
  const total = state.jobs.length
  const done = state.jobs.filter(j => j.status === 'done').length
  const errors = state.jobs.filter(j => j.status === 'error').length
  const running = state.jobs.filter(j => j.status === 'running').length
  const pending = state.jobs.filter(j => j.status === 'pending').length
  const finished = !!state.finishedAt
  return { total, done, errors, running, pending, finished, startedAt: state.startedAt, finishedAt: state.finishedAt }
}

// ─── KV Processing ────────────────────────────────────────────────────────────

/**
 * Merge patch into the stored job and write it back.
 * Safe to read-modify-write here: each job key has exactly one writer
 * (the worker assigned to that sessionId), so there is no concurrent contention.
 */
async function updateBatchJob(batchId: string, sessionId: string, patch: Partial<QueueJob>): Promise<void> {
  const key = jobKey(batchId, sessionId)
  const existing = await kv.get<string | QueueJob>(key)
  const current: QueueJob = existing
    ? (typeof existing === 'string' ? JSON.parse(existing) : existing)
    : { sessionId, userId: patch.userId ?? '', status: 'pending' }
  await kv.set(key, JSON.stringify({ ...current, ...patch }), { ex: BATCH_TTL })
}

async function processBatchKv(batchId: string, userId: string, sessionIds: string[]) {
  const queue = [...sessionIds]
  const running: Promise<void>[] = []

  async function processOne(sessionId: string) {
    await updateBatchJob(batchId, sessionId, { userId, status: 'running', startedAt: Date.now() })

    try {
      const result = await analyseSession({ sessionId, userId })
      await updateBatchJob(batchId, sessionId, {
        status: result.success ? 'done' : 'error',
        result,
        error: result.success ? undefined : result.error,
        finishedAt: Date.now(),
      })
      // kv.incr is atomic — safe under concurrent invocations
      if (result.success) {
        await kv.incr(doneKey(batchId))
      } else {
        await kv.incr(failedKey(batchId))
      }
    } catch (err) {
      await updateBatchJob(batchId, sessionId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        finishedAt: Date.now(),
      })
      await kv.incr(failedKey(batchId))
    }
  }

  let idx = 0
  while (idx < queue.length) {
    while (running.length < CONCURRENCY && idx < queue.length) {
      const sessionId = queue[idx++]
      const p = processOne(sessionId).then(() => {
        const i = running.indexOf(p)
        if (i >= 0) running.splice(i, 1)
      })
      running.push(p)
    }
    if (running.length >= CONCURRENCY) await Promise.race(running)
  }

  await Promise.all(running)

  // Stamp finishedAt on the meta key
  try {
    const metaRaw = await kv.get<string | BatchMeta>(metaKey(batchId))
    if (metaRaw) {
      const meta: BatchMeta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw
      meta.finishedAt = Date.now()
      await kv.set(metaKey(batchId), JSON.stringify(meta), { ex: BATCH_TTL })
    }
  } catch {
    // Non-critical: batch results are still correct; only finishedAt is missing
  }
}
