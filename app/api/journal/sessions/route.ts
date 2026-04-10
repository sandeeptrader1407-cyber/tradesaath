import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: sessions, error } = await supabaseAdmin
      .from('trade_sessions')
      .select(
        'id, created_at, trade_date, detected_market, trade_count, net_pnl, win_count, loss_count, win_rate, trades, analysis'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Journal sessions error:', error)
      return NextResponse.json({ sessions: [] })
    }

    return NextResponse.json({ sessions: sessions || [] })
  } catch {
    return NextResponse.json({ sessions: [] })
  }
}
