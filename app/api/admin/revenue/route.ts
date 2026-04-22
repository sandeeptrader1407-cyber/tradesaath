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

  const { data: payments } = await sb
    .from('payments')
    .select('clerk_id, plan, amount, currency, created_at, razorpay_order_id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const all = payments ?? []

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const totalPaise = all.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const thisMonthPaise = all
    .filter(p => new Date(p.created_at) >= monthStart)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const lastMonthPaise = all
    .filter(p => {
      const d = new Date(p.created_at)
      return d >= lastMonthStart && d <= lastMonthEnd
    })
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)

  const momChange = lastMonthPaise > 0
    ? Math.round(((thisMonthPaise - lastMonthPaise) / lastMonthPaise) * 100)
    : null

  // Weekly buckets — last 12 weeks
  const weeklyMap: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const weekDate = new Date(now)
    weekDate.setDate(now.getDate() - i * 7)
    const key = startOfWeek(weekDate).toISOString().split('T')[0]
    weeklyMap[key] = 0
  }
  for (const p of all) {
    const key = startOfWeek(new Date(p.created_at)).toISOString().split('T')[0]
    if (key in weeklyMap) {
      weeklyMap[key] += Math.round((Number(p.amount) || 0) / 100)
    }
  }
  const weeklyRevenue = Object.entries(weeklyMap).map(([week, rupees]) => ({ week, rupees }))

  // Plan breakdown
  const planMap: Record<string, { count: number; totalPaise: number }> = {}
  for (const p of all) {
    const plan = p.plan || 'unknown'
    if (!planMap[plan]) planMap[plan] = { count: 0, totalPaise: 0 }
    planMap[plan].count++
    planMap[plan].totalPaise += Number(p.amount) || 0
  }
  const planBreakdown = Object.entries(planMap).map(([plan, v]) => ({
    plan,
    count: v.count,
    revenueRupees: Math.round(v.totalPaise / 100),
    pct: totalPaise > 0 ? Math.round((v.totalPaise / totalPaise) * 100) : 0,
  })).sort((a, b) => b.revenueRupees - a.revenueRupees)

  // Enrich recent payments with email from users table
  const recentRaw = all.slice(0, 20)
  const clerkIds = Array.from(new Set(recentRaw.map(p => p.clerk_id).filter(Boolean)))
  const { data: userRows } = clerkIds.length
    ? await sb.from('users').select('clerk_id, email').in('clerk_id', clerkIds)
    : { data: [] }
  const emailMap = new Map((userRows ?? []).map(u => [u.clerk_id, u.email]))

  const recentPayments = recentRaw.map(p => ({
    date: p.created_at,
    email: emailMap.get(p.clerk_id) ?? p.clerk_id ?? '—',
    plan: p.plan,
    amountRupees: Math.round((Number(p.amount) || 0) / 100),
    razorpay_order_id: p.razorpay_order_id,
  }))

  return NextResponse.json({
    totalRevenueRupees: Math.round(totalPaise / 100),
    thisMonthRupees: Math.round(thisMonthPaise / 100),
    lastMonthRupees: Math.round(lastMonthPaise / 100),
    momChangePct: momChange,
    weeklyRevenue,
    planBreakdown,
    recentPayments,
  })
}
