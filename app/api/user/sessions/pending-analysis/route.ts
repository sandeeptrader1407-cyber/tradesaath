export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/sessions/pending-analysis
 * Returns this user's sessions that have NOT yet been analysed, ordered newest
 * first. Powers the batch-analysis UI and the dashboard CTA.
 *
 * Analysed detection: reads trade_sessions.analysis (JSONB, one row per
 * session). Previously we scanned trade_analysis and hit Supabase's default
 * 1000-row cap once users had many analysed sessions, which caused already-
 * analysed sessions to re-analyse on refresh.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = getSupabaseAdmin()

    // Pull recent sessions for this user — include the analysis JSONB so we can
    // classify pending vs analysed in-memory without a second query.
    const { data: sessions, error } = await supabase
      .from('trade_sessions')
      .select('id, trade_date, created_at, trade_count, net_pnl, analysis')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAnalysed = (a: any) =>
      !!a &&
      typeof a === 'object' &&
      (typeof a.session_summary === 'string' ||
        (Array.isArray(a.trade_analyses) && a.trade_analyses.length > 0))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripAnalysis = ({ analysis: _a, ...rest }: any) => rest

    const all = sessions || []
    if (all.length === 0) {
      return NextResponse.json({ pending: [], analysed: [], total: 0, analysedCount: 0, pendingCount: 0 })
    }

    const pending = all.filter(s => !isAnalysed(s.analysis)).map(stripAnalysis)
    const analysed = all.filter(s => isAnalysed(s.analysis)).map(stripAnalysis)

    return NextResponse.json({
      pending,
      analysed,
      total: all.length,
      analysedCount: analysed.length,
      pendingCount: pending.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
