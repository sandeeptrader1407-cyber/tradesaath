import { getSupabaseClient } from '@/lib/supabase'
import type { ParseResult } from '@/lib/parsers/universalParser'

export async function saveTradeSession({
  sessionKey,
  userId,
  parseResult,
  context,
  fileName,
}: {
  sessionKey: string
  userId?: string
  parseResult: ParseResult
  context: Record<string, string>
  fileName: string
}): Promise<string | null> {
  try {
    const supabase = getSupabaseClient()
    const rawDate = parseResult.trades[0]?.date ?? null
    // Ensure trade_date is a valid date or null
    let tradeDate: string | null = null
    if (rawDate) {
      const d = new Date(rawDate)
      if (!isNaN(d.getTime())) {
        tradeDate = d.toISOString().split('T')[0]
      }
    }

    const { data, error } = await supabase
      .from('trade_sessions')
      .insert({
        session_key: sessionKey,
        user_id: userId ?? null,
        broker: parseResult.broker,
        broker_name: parseResult.brokerName,
        file_name: fileName,
        trade_date: tradeDate,
        trades: parseResult.trades,
        raw_row_count: parseResult.rawRowCount,
        parsed_count: parseResult.parsedCount,
        context,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to save trade session:', error)
      return null
    }
    return data.id
  } catch (err) {
    console.error('saveTradeSession error:', err)
    return null
  }
}

export async function updateSessionAnalysis(sessionId: string, analysis: unknown) {
  try {
    const supabase = getSupabaseClient()
    await supabase
      .from('trade_sessions')
      .update({ analysis, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  } catch (err) {
    console.error('updateSessionAnalysis error:', err)
  }
}
