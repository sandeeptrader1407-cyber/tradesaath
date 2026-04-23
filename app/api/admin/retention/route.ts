import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

const DAY_MS = 24 * 60 * 60 * 1000

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
  const now = Date.now()
  const twelveWeeksAgo = new Date(now - 84 * DAY_MS)

  // Fetch all users signed up in the last 12 weeks
  const { data: recentUsers, error: usersErr } = await sb
    .from('users')
    .select('clerk_id, created_at')
    .gte('created_at', twelveWeeksAgo.toISOString())
    .order('created_at', { ascending: true })

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })

  if (!recentUsers || recentUsers.length === 0) {
    return NextResponse.json({ cohorts: [], avgD1Rate: 0, avgD7Rate: 0, avgD30Rate: 0 })
  }

  // Group users into weekly cohorts
  const cohortMap: Record<string, { clerk_id: string; created_at: string }[]> = {}
  for (const u of recentUsers) {
    const week = startOfWeek(new Date(u.created_at)).toISOString().split('T')[0]
    if (!cohortMap[week]) cohortMap[week] = []
    cohortMap[week].push(u)
  }

  // Fetch trade sessions for all these users within the 12-week window + 30 days buffer
  const allUserIds = Array.from(new Set(recentUsers.map(u => u.clerk_id)))
  const { data: sessions } = allUserIds.length
    ? await sb
        .from('trade_sessions')
        .select('user_id, created_at')
        .in('user_id', allUserIds)
        .gte('created_at', twelveWeeksAgo.toISOString())
    : { data: [] }

  // Index sessions by user
  const sessionsByUser: Record<string, number[]> = {}
  for (const s of sessions ?? []) {
    if (!sessionsByUser[s.user_id]) sessionsByUser[s.user_id] = []
    sessionsByUser[s.user_id].push(new Date(s.created_at).getTime())
  }

  // Compute D1 / D7 / D30 per cohort
  const cohortResults = Object.entries(cohortMap)
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([week, users]) => {
      const d1Set = new Set<string>()
      const d7Set = new Set<string>()
      const d30Set = new Set<string>()

      for (const user of users) {
        const joinMs = new Date(user.created_at).getTime()
        for (const sessMs of sessionsByUser[user.clerk_id] ?? []) {
          const delta = sessMs - joinMs
          if (delta < 0) continue
          if (delta <= DAY_MS)      d1Set.add(user.clerk_id)
          if (delta <= 7 * DAY_MS)  d7Set.add(user.clerk_id)
          if (delta <= 30 * DAY_MS) d30Set.add(user.clerk_id)
        }
      }

      return {
        cohort_week: week,
        signed_up: users.length,
        active_d1: d1Set.size,
        active_d7: d7Set.size,
        active_d30: d30Set.size,
      }
    })

  // Average retention rates across mature cohorts
  let d1Sum = 0, d1Count = 0
  let d7Sum = 0, d7Count = 0
  let d30Sum = 0, d30Count = 0

  for (const c of cohortResults) {
    if (c.signed_up === 0) continue
    const weekAgeMs = now - new Date(c.cohort_week).getTime()
    if (weekAgeMs >= DAY_MS)      { d1Sum  += c.active_d1  / c.signed_up; d1Count++ }
    if (weekAgeMs >= 7 * DAY_MS)  { d7Sum  += c.active_d7  / c.signed_up; d7Count++ }
    if (weekAgeMs >= 30 * DAY_MS) { d30Sum += c.active_d30 / c.signed_up; d30Count++ }
  }

  return NextResponse.json({
    cohorts: cohortResults,
    avgD1Rate:  d1Count  > 0 ? Math.round((d1Sum  / d1Count)  * 100) : 0,
    avgD7Rate:  d7Count  > 0 ? Math.round((d7Sum  / d7Count)  * 100) : 0,
    avgD30Rate: d30Count > 0 ? Math.round((d30Sum / d30Count) * 100) : 0,
  })
}
