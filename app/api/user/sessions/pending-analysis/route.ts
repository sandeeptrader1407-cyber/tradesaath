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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAnalysed = (a: any, tradeCount: number) => {
      if (!a || typeof a !== 'object') return false
      // Primary: explicit marker set by /api/analyse/session on success
      if (typeof a.analysed_at === 'string' && a.analysed_at.length > 0) return true
      // Fallback for older sessions: require trade_analyses covers trade_count
      if (!Array.isArray(a.trade_analyses)) return false
      if (a.trade_analyses.length === 0) return false
      const expected = Math.max(1, Number(tradeCount) || 0)
      return a.trade_analyses.length >= expected - 2
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
