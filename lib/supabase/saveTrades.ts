import { createClient } from '@supabase/supabase-js'
import type { ParseResult } from '@/lib/parsers/universalParser'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  const tradeDate = parseResult.trades[0]?.date ?? null

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
}

export async function updateSessionAnalysis(sessionId: string, analysis: unknown) {
  await supabase
    .from('trade_sessions')
    .update({ analysis, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}
