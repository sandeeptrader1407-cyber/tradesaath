import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()

  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const [
    usersRes,
    proUsersRes,
    todaySessionsRes,
    totalSessionsRes,
    paymentsRes,
    recentUsersRes,
    recentPaymentsRes,
    weeklySignupsRes,
    recentSignupsRes,
    recentUploadsRes,
  ] = await Promise.all([
    sb.from('users').select('id', { count: 'exact', head: true }),
    sb.from('user_plans')
      .select('id', { count: 'exact', head: true })
      .in('plan', ['pro_monthly', 'pro_yearly'])
      .or('plan_expires_at.is.null,plan_expires_at.gt.' + new Date().toISOString()),
    sb.from('trade_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    sb.from('trade_sessions').select('id', { count: 'exact', head: true }),
    sb.from('payments')
      .select('amount')
      .eq('status', 'completed'),
    sb.from('users')
      .select('clerk_id, email, name, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    sb.from('payments')
      .select('clerk_id, email, plan, amount, currency, created_at, razorpay_order_id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10),
    sb.from('users')
      .select('created_at')
      .gte('created_at', eightWeeksAgo.toISOString()),
    // Activity feed: signups in last 48 h
    sb.from('users')
      .select('name, email, created_at')
      .gte('created_at', fortyEightHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    // Activity feed: uploads in last 48 h
    sb.from('trade_sessions')
      .select('user_id, detected_broker, created_at')
      .gte('created_at', fortyEightHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const totalRevenuePaise = (paymentsRes.data ?? []).reduce(
    (s, r) => s + (Number(r.amount) || 0), 0
  )

  const totalUsers = usersRes.count ?? 0
  const activeProUsers = proUsersRes.count ?? 0
  const totalSessions = totalSessionsRes.count ?? 0

  const conversionRate = totalUsers > 0
    ? Math.round((activeProUsers / totalUsers) * 1000) / 10
    : 0
  const avgSessionsPerUser = totalUsers > 0
    ? Math.round((totalSessions / totalUsers) * 10) / 10
    : 0

  // Weekly signups — last 8 weeks
  const now = new Date()
  const weeklyMap: Record<string, number> = {}
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const key = startOfWeek(d).toISOString().split('T')[0]
    weeklyMap[key] = 0
  }
  for (const u of weeklySignupsRes.data ?? []) {
    const key = startOfWeek(new Date(u.created_at)).toISOString().split('T')[0]
    if (key in weeklyMap) weeklyMap[key]++
  }
  const weeklySignups = Object.entries(weeklyMap).map(([week, count]) => ({ week, count }))

  // Enrich recentUsers with live plan from user_plans
  const recentUserIds = (recentUsersRes.data ?? []).map(u => u.clerk_id)
  const { data: recentPlans } = recentUserIds.length
    ? await sb.from('user_plans').select('user_id, plan').in('user_id', recentUserIds)
    : { data: [] }
  const recentPlanMap = new Map((recentPlans ?? []).map(p => [p.user_id, p.plan]))
  const enrichedUsers = (recentUsersRes.data ?? []).map(u => ({
    ...u,
    plan: recentPlanMap.get(u.clerk_id) ?? u.plan ?? 'free',
  }))

  // Build activity feed — merge signups + uploads, sort DESC, top 20
  const signupEvents = (recentSignupsRes.data ?? []).map(u => ({
    event_type: 'signup' as const,
    label: u.name || u.email,
    email: u.email,
    created_at: u.created_at,
  }))

  const uploadUserIds = Array.from(
    new Set((recentUploadsRes.data ?? []).map(s => s.user_id).filter(Boolean))
  )
  const { data: uploadUsers } = uploadUserIds.length
    ? await sb.from('users').select('clerk_id, email').in('clerk_id', uploadUserIds)
    : { data: [] }
  const uploadEmailMap = new Map((uploadUsers ?? []).map(u => [u.clerk_id, u.email]))

  const uploadEvents = (recentUploadsRes.data ?? []).map(s => ({
    event_type: 'upload' as const,
    label: s.detected_broker || 'Unknown broker',
    email: uploadEmailMap.get(s.user_id) ?? '',
    created_at: s.created_at,
  }))

  const activityFeed = [...signupEvents, ...uploadEvents]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)

  return NextResponse.json({
    totalUsers,
    totalRevenueRupees: Math.round(totalRevenuePaise / 100),
    activeProUsers,
    sessionsToday: todaySessionsRes.count ?? 0,
    conversionRate,
    avgSessionsPerUser,
    weeklySignups,
    recentUsers: enrichedUsers,
    recentPayments: (recentPaymentsRes.data ?? []).map(p => ({
      ...p,
      amountRupees: Math.round((Number(p.amount) || 0) / 100),
    })),
    activityFeed,
  })
}
