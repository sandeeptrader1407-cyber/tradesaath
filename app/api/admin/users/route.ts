import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()
  const search = req.nextUrl.searchParams.get('search') || ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || '1'))
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Base query on users table
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

  // Enrich with user_plans data
  const clerkIds = (users ?? []).map(u => u.clerk_id)
  const { data: plans } = clerkIds.length
    ? await sb.from('user_plans')
        .select('user_id, plan, session_quota, sessions_used, plan_expires_at')
        .in('user_id', clerkIds)
    : { data: [] }

  // Enrich with session counts and last active date.
  // Ordered DESC so first occurrence per user_id is the most recent session.
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

  // Total paid per user from payments
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
    return {
      clerk_id: u.clerk_id,
      email: u.email,
      name: u.name,
      plan: up?.plan ?? u.plan ?? 'free',
      session_quota: up?.session_quota ?? null,
      sessions_used: up?.sessions_used ?? 0,
      plan_expires_at: up?.plan_expires_at ?? null,
      session_count: sessionCountMap[u.clerk_id] ?? 0,
      last_active: lastActiveMap[u.clerk_id] ?? null,
      total_paid_rupees: Math.round((paidMap[u.clerk_id] || 0) / 100),
      created_at: u.created_at,
    }
  })

  return NextResponse.json({ users: enriched, total: count ?? 0, page, pageSize })
}
