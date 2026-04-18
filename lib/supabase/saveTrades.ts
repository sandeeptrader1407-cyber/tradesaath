import { getSupabaseAdmin } from '@/lib/supabase'

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase dynamic row shapes, trade objects from multiple parsers */
export async function saveTradeSession({
  userId,
  anonId,
  trades,
  analysis,
  context,
  metadata,
  plan,
  paymentId,
}: {
  userId?: string
  anonId?: string
  trades: any[]
  analysis: any
  context: any
  metadata: any
  plan?: string
  paymentId?: string
}) {
  if (!userId && !anonId) {
    console.warn('saveTradeSession: no userId or anonId, skipping')
    return null
  }

  const supabase = getSupabaseAdmin()

  const netPnl = trades.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
  const wins = trades.filter((t: any) => (t.pnl || 0) > 0).length
  const losses = trades.filter((t: any) => (t.pnl || 0) < 0).length
  const grossWin = trades
    .filter((t: any) => (t.pnl || 0) > 0)
    .reduce((s: number, t: any) => s + t.pnl, 0)
  const grossLoss = Math.abs(
    trades
      .filter((t: any) => (t.pnl || 0) < 0)
      .reduce((s: number, t: any) => s + t.pnl, 0)
  )

  // Build insert row — include raw_file_id only if column exists (added by Module 1 migration)
  const insertRow: Record<string, any> = {
    user_id: userId || null,
    anon_id: anonId || null,
    session_key: crypto.randomUUID(),
    broker: metadata?.detected_broker || 'Unknown',
    broker_name: metadata?.detected_broker || 'Unknown',
    file_name: metadata?.file_name || 'upload',
    trade_date: metadata?.trade_date || new Date().toISOString().split('T')[0],
    detected_market: metadata?.detected_market || 'Unknown',
    detected_currency: metadata?.detected_currency || 'INR',
    detected_broker: metadata?.detected_broker || 'Unknown',
    trades: trades,
    analysis: analysis,
    context: context,
    trade_count: trades.length,
    net_pnl: netPnl,
    win_count: wins,
    loss_count: losses,
    win_rate: trades.length > 0 ? Math.round((wins / trades.length) * 10000) / 100 : 0,
    profit_factor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : 0,
    best_trade: trades.length > 0 ? Math.max(...trades.map((t: any) => t.pnl || 0)) : 0,
    worst_trade: trades.length > 0 ? Math.min(...trades.map((t: any) => t.pnl || 0)) : 0,
    plan: plan || 'free',
    payment_id: paymentId || null,
    raw_row_count: trades.length,
    parsed_count: trades.length,
  }
  // Include raw_file_id if provided (requires Module 1 DB migration)
  if (metadata?.raw_file_id) {
    insertRow.raw_file_id = metadata.raw_file_id
  }

  const { data, error } = await supabase
    .from('trade_sessions')
    .insert(insertRow)
    .select()
    .single()

  if (error) {
    console.error('Failed to save trade session:', error)
    throw error
  }

  return data
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export async function updateSessionAnalysis(sessionId: string, analysis: unknown) {
  try {
    const supabase = getSupabaseAdmin()
    await supabase
      .from('trade_sessions')
      .update({ analysis, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  } catch (err) {
    console.error('updateSessionAnalysis error:', err)
  }
}
