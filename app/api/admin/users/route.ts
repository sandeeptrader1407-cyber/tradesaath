import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

type RiskLevel = 'at_risk' | 'cooling' | 'new' | 'active' | 'inactive'

const DAY_MS = 24 * 60 * 60 * 1000

function computeRisk(
  plan: string,
  lastActive: string | null,
  createdAt: string,
): RiskLevel {
  const now = Date.now()
  const created = new Date(createdAt).getTime()
  const lastActiveMs = lastActive ? new Date(lastActive).getTime() : null
  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly'

  // Grace period — brand-new user, no expectation yet
  if (now - created < 3 * DAY_MS) return 'new'

  // Paying user who has gone quiet
  if (isPro && (lastActiveMs === null || now - lastActiveMs >= 14 * DAY_MS)) return 'at_risk'

  // Recently active
  if (lastActiveMs !== null && now - lastActiveMs < 7 * DAY_MS) return 'active'

  // Has been active before but drifting
  if (lastActiveMs !== null && now - lastActiveMs >= 7 * DAY_MS) return 'cooling'

  // Free, never uploaded, past grace period
  return 'inactive'
}

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()
  const search = req.nextUrl.searchParams.get('search') || ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || '1'))
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = sb
    .from('users')
    .select('clerk_id, email, name, plan, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search) {
    query = query.ilike('email', `%${search}%`)
  }

  const { data: users, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clerkIds = (users ?? []).map(u => u.clerk_id)

  const { data: plans } = clerkIds.length
    ? await sb.from('user_plans')
        .select('user_id, plan, session_quota, sessions_used, plan_expires_at')
        .in('user_id', clerkIds)
    : { data: [] }

  const { data: sessionData } = clerkIds.length
    ? await sb.from('trade_sessions')
        .select('user_id, created_at')
        .in('user_id', clerkIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const planMap = new Map((plans ?? []).map(p => [p.user_id, p]))
  const sessionCountMap: Record<string, number> = {}
  const lastActiveMap: Record<string, string> = {}
  for (const s of sessionData ?? []) {
    sessionCountMap[s.user_id] = (sessionCountMap[s.user_id] || 0) + 1
    if (!lastActiveMap[s.user_id]) {
      lastActiveMap[s.user_id] = s.created_at
    }
  }

  const { data: payments } = clerkIds.length
    ? await sb.from('payments')
        .select('clerk_id, amount')
        .eq('status', 'completed')
        .in('clerk_id', clerkIds)
    : { data: [] }

  const paidMap: Record<string, number> = {}
  for (const p of payments ?? []) {
    paidMap[p.clerk_id] = (paidMap[p.clerk_id] || 0) + (Number(p.amount) || 0)
  }

  const enriched = (users ?? []).map(u => {
    const up = planMap.get(u.clerk_id)
    const effectivePlan = up?.plan ?? u.plan ?? 'free'
    const lastActive = lastActiveMap[u.clerk_id] ?? null
    return {
      clerk_id: u.clerk_id,
      email: u.email,
      name: u.name,
      plan: effectivePlan,
      session_quota: up?.session_quota ?? null,
      sessions_used: up?.sessions_used ?? 0,
      plan_expires_at: up?.plan_expires_at ?? null,
      session_count: sessionCountMap[u.clerk_id] ?? 0,
      last_active: lastActive,
      risk: computeRisk(effectivePlan, lastActive, u.created_at) as RiskLevel,
      total_paid_rupees: Math.round((paidMap[u.clerk_id] || 0) / 100),
      created_at: u.created_at,
    }
  })

  return NextResponse.json({ users: enriched, total: count ?? 0, page, pageSize })
}
