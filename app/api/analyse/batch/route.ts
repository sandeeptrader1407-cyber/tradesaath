export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit'
import { createBatch, getBatch, batchSummary } from '@/lib/analysis/analysisQueue'

/**
 * POST /api/analyse/batch — Start a batch analysis job
 * Body: { sessionIds: string[] }
 * Returns: { batchId, total }
 *
 * GET /api/analyse/batch?batchId=xxx — Poll batch status
 * Returns: { total, done, errors, running, pending, finished, jobs }
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const ip = getClientIp(request as unknown as Request)
    const rl = await rateLimit(`analyse-batch:${userId}:${ip}`, 10, 5 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await request.json().catch(() => ({}))
    const sessionIds: string[] = Array.isArray(body?.sessionIds)
      ? body.sessionIds.filter((s: unknown) => typeof s === 'string' && s.trim())
      : []

    if (!sessionIds.length) {
      return NextResponse.json({ error: 'sessionIds array required' }, { status: 400 })
    }

    if (sessionIds.length > 200) {
      return NextResponse.json({ error: 'Max 200 sessions per batch' }, { status: 400 })
    }

    const batchId = `batch_${userId}_${Date.now()}`
    await createBatch(batchId, userId, sessionIds)

    return NextResponse.json({
      success: true,
      batchId,
      total: sessionIds.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('analyse/batch POST error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const url = new URL(request.url)
    const batchId = url.searchParams.get('batchId')
    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 })

    const state = await getBatch(batchId)
    if (!state) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (state.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const summary = batchSummary(state)

    return NextResponse.json({
      ...summary,
      jobs: state.jobs.map(j => ({
        sessionId: j.sessionId,
        status: j.status,
        error: j.error,
        tradesAnalysed: j.result?.tradesAnalysed ?? 0,
        skipped: j.result?.skipped ?? false,
      })),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('analyse/batch GET error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
