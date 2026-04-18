export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit'
import { analyseSession } from '@/lib/analysis/sessionAnalyser'

/* ─── POST /api/analyse/session ─── */

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const ip = getClientIp(request as unknown as Request)
    const rl = rateLimit(`analyse-session:${userId}:${ip}`, 200, 15 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    const force = !!body?.force
    const includeAICoaching = !!body?.includeAICoaching
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const result = await analyseSession({ sessionId, userId, force, includeAICoaching })

    if (!result.success) {
      const status = result.error === 'Session not found' ? 404
        : result.error === 'Forbidden' ? 403
        : result.error === 'No trades on this session' ? 400
        : 500
      return NextResponse.json({ error: result.error, tradesAnalysed: result.tradesAnalysed }, { status })
    }

    return NextResponse.json({
      success: true,
      sessionId,
      tradesAnalysed: result.tradesAnalysed,
      skipped: result.skipped ?? false,
      reason: result.reason,
      mode: 'code',
    })

  } catch (err: unknown) {
    console.error('analyse/session error:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
