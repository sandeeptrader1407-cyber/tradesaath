import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ sessions: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('clerk_id', clerkId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Sessions fetch error:', error)
      return NextResponse.json({ sessions: [] })
    }

    return NextResponse.json({ sessions: data || [] })
  } catch (err) {
    console.error('Sessions API error:', err)
    return NextResponse.json({ sessions: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()

    // If user is not logged in, return success but don't save
    if (!clerkId) {
      return NextResponse.json({ saved: false, reason: 'not_authenticated' })
    }

    const body = await req.json()
    const { trades, analysis, broker, market, trade_date, plan_used } = body

    if (!trades || !analysis) {
      return NextResponse.json({ error: 'Missing trades or analysis' }, { status: 400 })
    }

    // Compute summary fields for quick queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalPnl = trades.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
    const tradeCount = trades.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wins = trades.filter((t: any) => t.pnl > 0).length
    const winRate = tradeCount > 0 ? Math.round(wins / tradeCount * 100) : 0

    // Extract DQS score from analysis if available
    const dqsScore = analysis?.dqs?.score || 0

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        clerk_id: clerkId,
        date: trade_date || null,
        broker: broker || null,
        market: market || null,
        raw_trades_json: trades,
        analysis_json: analysis,
        plan_used: plan_used || 'free',
        // Legacy fields for backward compat
        trades: trades,
        analysis: analysis,
        total_pnl: totalPnl,
        trade_count: tradeCount,
        win_rate: winRate,
        dqs_score: dqsScore,
      })
      .select()
      .single()

    if (error) {
      console.error('Session save error:', error)
      if (error.message?.includes('column')) {
        console.error('Schema issue — sessions table may need new columns: date, market, raw_trades_json (jsonb), analysis_json (jsonb), plan_used (text)')
      }
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
    }

    return NextResponse.json({ saved: true, session: data })
  } catch (err) {
    console.error('Session save API error:', err)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}
