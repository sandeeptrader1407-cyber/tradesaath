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
    if (!clerkId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { trades, analysis, broker } = body

    if (!trades || !analysis) {
      return NextResponse.json({ error: 'Missing trades or analysis' }, { status: 400 })
    }

    // Compute summary fields for quick queries
    const totalPnl = trades.reduce((s: number, t: { pnl: number }) => s + (t.pnl || 0), 0)
    const tradeCount = trades.length
    const wins = trades.filter((t: { pnl: number }) => t.pnl > 0).length
    const winRate = tradeCount > 0 ? Math.round(wins / tradeCount * 100) : 0
    const dqsScore = analysis.dqsScore || 0

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        clerk_id: clerkId,
        broker: broker || null,
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
      // If the table doesn't have the right columns yet, log details
      if (error.message?.includes('column')) {
        console.error('Schema issue — sessions table may need columns: clerk_id, trades (jsonb), analysis (jsonb), total_pnl, trade_count, win_rate, dqs_score')
      }
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
    }

    return NextResponse.json({ session: data })
  } catch (err) {
    console.error('Session save API error:', err)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}
