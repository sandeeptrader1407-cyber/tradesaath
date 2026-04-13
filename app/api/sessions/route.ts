import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/sessions — returns the user's trade sessions.
 * Single source of truth: `trade_sessions` table.
 * Writes go through lib/supabase/saveTradeSession (not this route).
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ sessions: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('trade_sessions')
      .select('id, created_at, trade_count, net_pnl, win_count, loss_count, win_rate, trades, analysis')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Sessions fetch error:', error)
      return NextResponse.json({ sessions: [] })
    }

    // Map fields to match the coach page's Session interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row shape varies
    const mapped = (data || []).map((s: any) => ({
      id: s.id,
      created_at: s.created_at,
      total_pnl: s.net_pnl || 0,
      trade_count: s.trade_count || 0,
      win_count: s.win_count || 0,
      loss_count: s.loss_count || 0,
      win_rate: s.win_rate || 0,
      dqs_score: s.analysis?.dqs?.score || s.analysis?.dqsScore || 0,
      analysis: s.analysis || null,
    }))

    return NextResponse.json({ sessions: mapped })
  } catch (err) {
    console.error('Sessions API error:', err)
    return NextResponse.json({ sessions: [] })
  }
}
