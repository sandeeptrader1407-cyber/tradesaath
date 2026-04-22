import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()

  const [
    usersRes,
    proUsersRes,
    todaySessionsRes,
    paymentsRes,
    recentUsersRes,
    recentPaymentsRes,
  ] = await Promise.all([
    sb.from('users').select('id', { count: 'exact', head: true }),
    sb.from('user_plans')
      .select('id', { count: 'exact', head: true })
      .in('plan', ['pro_monthly', 'pro_yearly'])
      .or('plan_expires_at.is.null,plan_expires_at.gt.' + new Date().toISOString()),
    sb.from('trade_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
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
  ])

  const totalRevenuePaise = (paymentsRes.data ?? []).reduce(
    (s, r) => s + (Number(r.amount) || 0), 0
  )

  return NextResponse.json({
    totalUsers: usersRes.count ?? 0,
    totalRevenueRupees: Math.round(totalRevenuePaise / 100),
    activeProUsers: proUsersRes.count ?? 0,
    sessionsToday: todaySessionsRes.count ?? 0,
    recentUsers: recentUsersRes.data ?? [],
    recentPayments: (recentPaymentsRes.data ?? []).map(p => ({
      ...p,
      amountRupees: Math.round((Number(p.amount) || 0) / 100),
    })),
  })
}
