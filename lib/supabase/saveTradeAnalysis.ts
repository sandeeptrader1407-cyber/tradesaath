import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Save per-trade AI analysis to the trade_analysis table.
 * Non-blocking — wrapped in try/catch, never throws.
 */
export async function saveTradeAnalysis(sessionId: string, trades: any[], anonId?: string) {
  if (!sessionId || !trades?.length) return

  try {
    const supabase = getSupabaseAdmin()

    const rows = trades.map((t: any, i: number) => ({
      session_id: sessionId,
      trade_index: i,
      anon_id: anonId || null,
      symbol: t.symbol || null,
      side: t.side || null,
      entry_price: t.entry_price ?? null,
      exit_price: t.exit_price ?? null,
      quantity: t.quantity ?? null,
      pnl: t.pnl ?? null,
      entry_time: t.entry_time || null,
      exit_time: t.exit_time || null,
      tag: t.tag || null,
      tag_label: t.tag_label || null,
      quick_summary: t.quick_summary || null,
      psychology_coaching: t.psychology_coaching || null,
      counterfactual: t.counterfactual || null,
      technical_analysis: t.technical_analysis || null,
      cycle_stage: t.cycle_stage || null,
      notes: null,
    }))

    const { error } = await supabase
      .from('trade_analysis')
      .insert(rows)

    if (error) {
      console.error('Trade analysis save error:', error.message)
    } else {
      console.log(`Saved ${rows.length} trade analyses for session ${sessionId}`)
    }
  } catch (err) {
    console.error('Trade analysis save exception:', err)
  }
}
