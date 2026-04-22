import { getSupabaseAdmin } from '@/lib/supabase'

interface LogEntry {
  userId: string
  route: string
  model: string
  inputTokens: number
  outputTokens: number
}

export function logAiUsage(entry: LogEntry): void {
  const cost = (entry.inputTokens * 3 + entry.outputTokens * 15) / 1_000_000
  void Promise.resolve(
    getSupabaseAdmin().from('ai_usage_log').insert({
      user_id: entry.userId,
      route: entry.route,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      estimated_cost_usd: cost,
    })
  ).catch((err: unknown) => console.warn('[AI_USAGE_LOG] failed:', err))
}
