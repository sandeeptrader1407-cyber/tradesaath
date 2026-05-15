import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

interface RecentParse {
  id: string
  created_at: string
  parser_used: string | null
  parser_model_name: string | null
  parser_cost_usd: number | null
  parser_duration_ms: number | null
  trade_count: number | null
  net_pnl: number | null
}

interface ParserBreakdown {
  parser: string
  count: number
  totalCostUsd: number
  avgCostUsd: number
  avgDurationMs: number
}

interface ParserMetricsResponse {
  totalCost24h: number
  totalCost7d: number
  totalCost30d: number
  totalParses24h: number
  totalParses7d: number
  totalParses30d: number
  byParser: ParserBreakdown[]
  recent: RecentParse[]
}

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const since24h = new Date(now - day).toISOString()
  const since7d = new Date(now - 7 * day).toISOString()
  const since30d = new Date(now - 30 * day).toISOString()

  // Fetch only rows with parser_used set (skip pre-AI legacy sessions).
  // Limit to last 30 days for performance.
  const { data: parses, error } = await sb
    .from('trade_sessions')
    .select('id, created_at, parser_used, parser_model_name, parser_cost_usd, parser_duration_ms, trade_count, net_pnl')
    .gte('created_at', since30d)
    .not('parser_used', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('[admin/parser-metrics] query error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const rows = (parses ?? []) as RecentParse[]

  // Aggregate by time window
  let totalCost24h = 0
  let totalCost7d = 0
  let totalCost30d = 0
  let totalParses24h = 0
  let totalParses7d = 0
  let totalParses30d = 0

  for (const r of rows) {
    const cost = r.parser_cost_usd ?? 0
    const ts = r.created_at
    totalCost30d += cost
    totalParses30d += 1
    if (ts >= since7d) {
      totalCost7d += cost
      totalParses7d += 1
    }
    if (ts >= since24h) {
      totalCost24h += cost
      totalParses24h += 1
    }
  }

  // Group by parser_used
  const grouped: Record<string, { count: number; totalCost: number; totalDuration: number }> = {}
  for (const r of rows) {
    const key = r.parser_used ?? 'unknown'
    if (!grouped[key]) grouped[key] = { count: 0, totalCost: 0, totalDuration: 0 }
    grouped[key].count += 1
    grouped[key].totalCost += r.parser_cost_usd ?? 0
    grouped[key].totalDuration += r.parser_duration_ms ?? 0
  }

  const byParser: ParserBreakdown[] = Object.entries(grouped)
    .map(([parser, g]) => ({
      parser,
      count: g.count,
      totalCostUsd: g.totalCost,
      avgCostUsd: g.count > 0 ? g.totalCost / g.count : 0,
      avgDurationMs: g.count > 0 ? g.totalDuration / g.count : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Recent 100 for table
  const recent = rows.slice(0, 100)

  const response: ParserMetricsResponse = {
    totalCost24h,
    totalCost7d,
    totalCost30d,
    totalParses24h,
    totalParses7d,
    totalParses30d,
    byParser,
    recent,
  }

  return NextResponse.json(response)
}
