import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1)
  const thirtyDaysAgo = new Date(todayStart)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  const { data: allLogs } = await sb
    .from('ai_usage_log')
    .select('user_id, route, model, input_tokens, output_tokens, estimated_cost_usd, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true })

  const logs = allLogs ?? []

  // Period totals
  const todayLogs = logs.filter(l => new Date(l.created_at) >= todayStart)
  const monthLogs = logs.filter(l => new Date(l.created_at) >= monthStart)

  const sumCost = (arr: typeof logs) =>
    arr.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0)

  const spendToday = sumCost(todayLogs)
  const spendMonth = sumCost(monthLogs)
  const spendAllTime = await sb
    .from('ai_usage_log')
    .select('estimated_cost_usd')
    .then(r => (r.data ?? []).reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0))

  // Daily cost for last 30 days
  const dailyMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    dailyMap[d.toISOString().split('T')[0]] = 0
  }
  for (const l of logs) {
    const day = l.created_at.split('T')[0]
    if (day in dailyMap) {
      dailyMap[day] = (dailyMap[day] || 0) + Number(l.estimated_cost_usd || 0)
    }
  }
  const dailyCost = Object.entries(dailyMap).map(([date, cost]) => ({
    date,
    cost: Number(cost.toFixed(6)),
  }))

  // Top 10 users by cost this month
  const userCostMap: Record<string, number> = {}
  for (const l of monthLogs) {
    userCostMap[l.user_id] = (userCostMap[l.user_id] || 0) + Number(l.estimated_cost_usd || 0)
  }
  const topUserIds = Object.entries(userCostMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  const { data: topUsers } = topUserIds.length
    ? await sb.from('users').select('clerk_id, email').in('clerk_id', topUserIds)
    : { data: [] }
  const emailMap = new Map((topUsers ?? []).map(u => [u.clerk_id, u.email]))

  const topByUser = Object.entries(userCostMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, cost]) => ({
      user_id: userId,
      email: emailMap.get(userId) ?? userId,
      cost_usd: Number(cost.toFixed(6)),
    }))

  // Route breakdown this month
  const routeMap: Record<string, number> = {}
  for (const l of monthLogs) {
    routeMap[l.route] = (routeMap[l.route] || 0) + Number(l.estimated_cost_usd || 0)
  }
  const byRoute = Object.entries(routeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([route, cost]) => ({ route, cost_usd: Number(cost.toFixed(6)) }))

  return NextResponse.json({
    spendToday: Number(spendToday.toFixed(6)),
    spendMonth: Number(spendMonth.toFixed(6)),
    spendAllTime: Number(Number(spendAllTime).toFixed(6)),
    dailyCost,
    topByUser,
    byRoute,
  })
}
