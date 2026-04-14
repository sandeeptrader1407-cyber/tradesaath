export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/sessions/pending-analysis
 * Returns this user's sessions that have NO per-trade analysis rows yet,
 * ordered newest first. Powers the batch-analysis UI and the dashboard CTA.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = getSupabaseAdmin()

    // 1. Pull recent sessions for this user
    const { data: sessions, error } = await supabase
      .from('trade_sessions')
      .select('id, trade_date, created_at, trade_count, net_pnl')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const all = sessions || []
    if (all.length === 0) {
      return NextResponse.json({ pending: [], analysed: [], total: 0, analysedCount: 0, pendingCount: 0 })
    }

    // 2. Find which sessions already have trade_analysis rows
    const ids = all.map(s => s.id)
    const { data: analysisRows } = await supabase
      .from('trade_analysis')
      .select('session_id')
      .in('session_id', ids)

    const analysedSet = new Set<string>((analysisRows || []).map(r => r.session_id as string))

    const pending = all.filter(s => !analysedSet.has(s.id))
    const analysed = all.filter(s => analysedSet.has(s.id))

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
