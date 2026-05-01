import { getSupabaseAdmin } from '@/lib/supabase'
import { deduplicateTrades } from '@/lib/intake/tradePairer'

export type DedupStats = {
  tradesAdded: number
  tradesSkipped: number
  sessionMerged: boolean
  existingSessionId?: string
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase dynamic row shapes, trade objects from multiple parsers */

/** Compute aggregate stats from a trades array */
/** An open/unmatched position: no exit price and zero P&L. */
function isOpenPosition(t: any): boolean {
  const exitPrice = t.exit_price ?? t.exit ?? t.exitPrice
  const pnl = t.pnl ?? 0
  const hasNoExit = !exitPrice || Number(exitPrice) === 0
  return hasNoExit && Number(pnl) === 0
}

function computeSessionStats(trades: any[]) {
  const openPositions = trades.filter(isOpenPosition)
  const closed = trades.filter(t => !isOpenPosition(t))

  const netPnl = closed.reduce((s: number, t: any) => s + (t.pnl || 0), 0)
  const wins = closed.filter((t: any) => (t.pnl || 0) > 0).length
  const losses = closed.filter((t: any) => (t.pnl || 0) < 0).length
  const grossWin = closed
    .filter((t: any) => (t.pnl || 0) > 0)
    .reduce((s: number, t: any) => s + t.pnl, 0)
  const grossLoss = Math.abs(
    closed
      .filter((t: any) => (t.pnl || 0) < 0)
      .reduce((s: number, t: any) => s + t.pnl, 0)
  )
  return {
    net_pnl: netPnl,
    win_count: wins,
    loss_count: losses,
    win_rate: closed.length > 0 ? Math.round((wins / closed.length) * 10000) / 100 : 0,
    profit_factor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : 0,
    best_trade: closed.length > 0 ? Math.max(...closed.map((t: any) => t.pnl || 0)) : 0,
    worst_trade: closed.length > 0 ? Math.min(...closed.map((t: any) => t.pnl || 0)) : 0,
    // trade_count reflects closed trades only; open_position_count is stored for UI display
    trade_count: closed.length,
    open_position_count: openPositions.length,
  }
}

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
}): Promise<(any & { _dedupStats?: DedupStats }) | null> {
  if (!userId && !anonId) {
    console.warn('saveTradeSession: no userId or anonId, skipping')
    return null
  }

  const supabase = getSupabaseAdmin()
  const tradeDate = metadata?.trade_date || new Date().toISOString().split('T')[0]
  const lookupId = userId || anonId

  // --- Level 3: Check for existing session on same user + date ---
  let existingSession: any = null
  if (lookupId) {
    const col = userId ? 'user_id' : 'anon_id'
    const { data: existing } = await supabase
      .from('trade_sessions')
      .select('id, trades, trade_count')
      .eq(col, lookupId)
      .eq('trade_date', tradeDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      existingSession = existing
      console.log(`[SaveTrades] Found existing session ${existing.id} for ${tradeDate} with ${existing.trade_count} trades`)
    }
  }

  // --- Level 2: Trade-level deduplication ---
  let uniqueTrades = trades
  let skippedCount = 0

  if (existingSession && Array.isArray(existingSession.trades)) {
    // Deduplicate against existing session's trades
    const result = deduplicateTrades(trades, existingSession.trades)
    uniqueTrades = result.unique
    skippedCount = result.skipped
    console.log(`[SaveTrades] Dedup: ${trades.length} incoming -> ${uniqueTrades.length} unique, ${skippedCount} duplicates skipped`)

    if (uniqueTrades.length === 0) {
      // All trades are duplicates -- nothing to add
      console.log(`[SaveTrades] All ${trades.length} trades are duplicates of session ${existingSession.id}, skipping`)
      return {
        id: existingSession.id,
        _dedupStats: {
          tradesAdded: 0,
          tradesSkipped: skippedCount,
          sessionMerged: false,
          existingSessionId: existingSession.id,
        },
      }
    }
  } else if (!existingSession && lookupId) {
    // No existing session for this date, but check ALL user trades for cross-session dupes
    try {
      const col = userId ? 'user_id' : 'anon_id'
      const { data: allSessions } = await supabase
        .from('trade_sessions')
        .select('trades')
        .eq(col, lookupId)
        .not('trades', 'is', null)
        .limit(20) // cap to avoid pulling too much data

      if (allSessions && allSessions.length > 0) {
        const allExistingTrades = allSessions.flatMap((s: any) => s.trades || [])
        if (allExistingTrades.length > 0) {
          const result = deduplicateTrades(trades, allExistingTrades)
          uniqueTrades = result.unique
          skippedCount = result.skipped
          if (skippedCount > 0) {
            console.log(`[SaveTrades] Cross-session dedup: ${skippedCount} duplicates removed from ${trades.length} trades`)
          }
        }
      }
    } catch (dedupErr) {
      console.warn('[SaveTrades] Cross-session dedup failed (non-blocking):', dedupErr)
    }
  }

  // Level 3: MERGE into existing session
  if (existingSession && uniqueTrades.length > 0) {
    const mergedTrades = [...(existingSession.trades || []), ...uniqueTrades]
    const stats = computeSessionStats(mergedTrades)

    const { data, error } = await supabase
      .from('trade_sessions')
      .update({
        trades: mergedTrades,
        analysis, // update analysis with full set
        ...stats,
        raw_row_count: mergedTrades.length,
        parsed_count: mergedTrades.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSession.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to merge trade session:', error)
      throw error
    }

    console.log(`[SaveTrades] Merged ${uniqueTrades.length} new trades into session ${existingSession.id} (total: ${mergedTrades.length})`)
    return {
      ...data,
      _dedupStats: {
        tradesAdded: uniqueTrades.length,
        tradesSkipped: skippedCount,
        sessionMerged: true,
        existingSessionId: existingSession.id,
      },
    }
  }

  // No existing session: INSERT new one (with deduped trades)
  const stats = computeSessionStats(uniqueTrades)

  const insertRow: Record<string, any> = {
    user_id: userId || null,
    anon_id: anonId || null,
    session_key: crypto.randomUUID(),
    broker: metadata?.detected_broker || 'Unknown',
    broker_name: metadata?.detected_broker || 'Unknown',
    file_name: metadata?.file_name || 'upload',
    trade_date: tradeDate,
    detected_market: metadata?.detected_market || 'Unknown',
    detected_currency: metadata?.detected_currency || 'INR',
    detected_broker: metadata?.detected_broker || 'Unknown',
    trades: uniqueTrades,
    analysis: analysis,
    context: context,
    ...stats,
    plan: plan || 'free',
    payment_id: paymentId || null,
    raw_row_count: uniqueTrades.length,
    parsed_count: uniqueTrades.length,
  }
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

  return {
    ...data,
    _dedupStats: {
      tradesAdded: uniqueTrades.length,
      tradesSkipped: skippedCount,
      sessionMerged: false,
    },
  }
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
