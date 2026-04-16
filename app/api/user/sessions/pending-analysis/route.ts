export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/sessions/pending-analysis
 * Returns this user's sessions that still need per-trade analysis.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = getSupabaseAdmin()

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

    // Must match the CURRENT pipeline version (same constant as in analyse/session route).
    const CURRENT_ANALYSIS_VERSION = 3

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAnalysed = (a: any, _tradeCount: number) => {
      if (!a || typeof a !== 'object') return false
      // Primary gate: must have analysed_at AND version >= CURRENT.
      // If the version was reset to 0 in Supabase, old sessions must re-process.
      const hasTimestamp = typeof a.analysed_at === 'string' && a.analysed_at.length > 0
      const version = Number(a.analysed_version)
      if (hasTimestamp && Number.isFinite(version) && version >= CURRENT_ANALYSIS_VERSION) return true
      // Everything else is pending — old pipeline, partial analysis, missing fields.
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strip = ({ analysis: _a, ...rest }: any) => rest

    const all = sessions || []
    if (all.length === 0) {
      return NextResponse.json({ pending: [], analysed: [], total: 0, analysedCount: 0, pendingCount: 0 })
    }

    const pending = all.filter(s => !isAnalysed(s.analysis, s.trade_count || 0)).map(strip)
    const analysed = all.filter(s => isAnalysed(s.analysis, s.trade_count || 0)).map(strip)

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
