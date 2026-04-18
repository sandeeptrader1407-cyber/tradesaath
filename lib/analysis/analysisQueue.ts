/**
 * TradeSaath — In-memory analysis queue with concurrency control.
 * Processes sessions in parallel (up to CONCURRENCY limit) to stay
 * within Vercel serverless function timeouts.
 *
 * Future: migrate to QStash or Inngest for durable queuing at scale.
 */

import { analyseSession, type AnalyseSessionResult } from '@/lib/analysis/sessionAnalyser'

const CONCURRENCY = 3

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

export interface BatchState {
  id: string
  userId: string
  jobs: QueueJob[]
  startedAt: number
  finishedAt?: number
}

// In-memory store keyed by batch ID
const batches = new Map<string, BatchState>()

/** Clean up batches older than 10 minutes to prevent memory leaks */
function cleanupOldBatches() {
  const cutoff = Date.now() - 10 * 60 * 1000
  batches.forEach((batch, id) => {
    if (batch.startedAt < cutoff) batches.delete(id)
  })
}

/** Create a new batch and start processing in the background */
export function createBatch(batchId: string, userId: string, sessionIds: string[]): BatchState {
  cleanupOldBatches()

  const jobs: QueueJob[] = sessionIds.map(sid => ({
    sessionId: sid,
    userId,
    status: 'pending' as JobStatus,
  }))

  const state: BatchState = {
    id: batchId,
    userId,
    jobs,
    startedAt: Date.now(),
  }

  batches.set(batchId, state)

  // Fire-and-forget — runs in background
  processBatch(state).catch(err => {
    console.error(`Batch ${batchId} processing error:`, err)
  })

  return state
}

/** Get current state of a batch */
export function getBatchState(batchId: string): BatchState | undefined {
  return batches.get(batchId)
}

/** Process all jobs in a batch with concurrency control */
async function processBatch(state: BatchState) {
  const queue = [...state.jobs]
  const running: Promise<void>[] = []

  async function processJob(job: QueueJob) {
    job.status = 'running'
    job.startedAt = Date.now()
    try {
      const result = await analyseSession({
        sessionId: job.sessionId,
        userId: job.userId,
      })
      job.result = result
      job.status = result.success ? 'done' : 'error'
      if (!result.success) job.error = result.error
    } catch (err) {
      job.status = 'error'
      job.error = err instanceof Error ? err.message : 'Unknown error'
    }
    job.finishedAt = Date.now()
  }

  // Process with concurrency limit
  let idx = 0
  while (idx < queue.length) {
    // Fill up to CONCURRENCY slots
    while (running.length < CONCURRENCY && idx < queue.length) {
      const job = queue[idx++]
      const p = processJob(job).then(() => {
        const i = running.indexOf(p)
        if (i >= 0) running.splice(i, 1)
      })
      running.push(p)
    }
    // Wait for at least one to finish before filling more
    if (running.length >= CONCURRENCY) {
      await Promise.race(running)
    }
  }

  // Wait for remaining
  await Promise.all(running)
  state.finishedAt = Date.now()
}

/** Summary stats for a batch */
export function batchSummary(state: BatchState) {
  const total = state.jobs.length
  const done = state.jobs.filter(j => j.status === 'done').length
  const errors = state.jobs.filter(j => j.status === 'error').length
  const running = state.jobs.filter(j => j.status === 'running').length
  const pending = state.jobs.filter(j => j.status === 'pending').length
  const finished = !!state.finishedAt
  return { total, done, errors, running, pending, finished, startedAt: state.startedAt, finishedAt: state.finishedAt }
}
