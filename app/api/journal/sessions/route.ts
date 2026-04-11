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

    // Enrich sessions: merge trade_analysis rows into trades if available
    const sessionIds = (sessions || []).map((s: any) => s.id)
    let tradeAnalysisMap: Record<string, any[]> = {}

    if (sessionIds.length > 0) {
      const { data: analyses } = await supabaseAdmin
        .from('trade_analysis')
        .select('session_id, trade_index, tag, tag_label, quick_summary, psychology_coaching, counterfactual, technical_analysis, cycle_stage')
        .in('session_id', sessionIds)
        .order('trade_index', { ascending: true })

      if (analyses) {
        for (const a of analyses) {
          if (!tradeAnalysisMap[a.session_id]) tradeAnalysisMap[a.session_id] = []
          tradeAnalysisMap[a.session_id].push(a)
        }
      }
    }

    // Merge AI analysis into each session's trades
    const enriched = (sessions || []).map((s: any) => {
      const aiRows = tradeAnalysisMap[s.id]
      if (aiRows && Array.isArray(s.trades)) {
        const mergedTrades = s.trades.map((t: any, i: number) => {
          const ai = aiRows.find((a: any) => a.trade_index === i)
          return ai ? { ...t, tag: ai.tag || t.tag, tag_label: ai.tag_label || t.tag_label, quick_summary: ai.quick_summary, psychology_coaching: ai.psychology_coaching, counterfactual: ai.counterfactual, technical_analysis: ai.technical_analysis, cycle_stage: ai.cycle_stage } : t
        })
        return { ...s, trades: mergedTrades }
      }
      // Fallback: merge from analysis.trade_analyses if trade_analysis table has no rows yet
      if (s.analysis?.trade_analyses && Array.isArray(s.trades)) {
        const mergedTrades = s.trades.map((t: any, i: number) => {
          const ai = (s.analysis.trade_analyses as any[])?.find((a: any) => a.trade_index === i)
          return ai ? { ...t, ...ai } : t
        })
        return { ...s, trades: mergedTrades }
      }
      return s
    })

    return NextResponse.json({ sessions: enriched })
  } catch {
    return NextResponse.json({ sessions: [] })
  }
}
