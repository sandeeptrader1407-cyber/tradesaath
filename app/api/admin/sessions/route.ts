import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
const CURRENT_ANALYSIS_VERSION = 4

function sessionStatus(analysis: unknown): 'analysed' | 'pending' | 'failed' {
  if (!analysis || typeof analysis !== 'object') return 'pending'
  const a = analysis as Record<string, unknown>
  const v = Number(a.analysed_version)
  const hasTs = typeof a.analysed_at === 'string' && a.analysed_at.length > 0
  if (hasTs && Number.isFinite(v) && v >= CURRENT_ANALYSIS_VERSION) return 'analysed'
  return 'pending'
}

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()
  const statusFilter = req.nextUrl.searchParams.get('status') || 'all'

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [totalRes, todayRes, sessionsRes] = await Promise.all([
    sb.from('trade_sessions').select('id', { count: 'exact', head: true }),
    sb.from('trade_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    sb.from('trade_sessions')
      .select('id, user_id, trade_date, detected_broker, trade_count, net_pnl, analysis, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const allSessions = sessionsRes.data ?? []

  // Compute status per session
  const withStatus = allSessions.map(s => ({
    id: s.id,
    user_id: s.user_id,
    trade_date: s.trade_date,
    detected_broker: s.detected_broker ?? '—',
    trade_count: s.trade_count ?? 0,
    net_pnl: Number(s.net_pnl ?? 0),
    status: sessionStatus(s.analysis),
    created_at: s.created_at,
  }))

  const pendingCount = withStatus.filter(s => s.status === 'pending').length

  let filtered = withStatus
  if (statusFilter !== 'all') {
    filtered = withStatus.filter(s => s.status === statusFilter)
  }

  // Enrich with user email
  const userIds = Array.from(new Set(filtered.slice(0, 50).map(s => s.user_id).filter(Boolean)))
  const { data: users } = userIds.length
    ? await sb.from('users').select('clerk_id, email').in('clerk_id', userIds)
    : { data: [] }
  const emailMap = new Map((users ?? []).map(u => [u.clerk_id, u.email]))

  const enriched = filtered.slice(0, 50).map(s => ({
    ...s,
    email: emailMap.get(s.user_id) ?? s.user_id ?? '—',
  }))

  return NextResponse.json({
    total: totalRes.count ?? 0,
    today: todayRes.count ?? 0,
    pending: pendingCount,
    sessions: enriched,
  })
}
