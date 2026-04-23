import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const sb = getSupabaseAdmin()

    const [plansRes, usersRes, sessionCountRes] = await Promise.all([
      sb.from('user_plans')
        .select('plan, session_quota, sessions_used, plan_expires_at, plan_started_at')
        .eq('user_id', userId)
        .maybeSingle(),
      sb.from('users')
        .select('plan, email, name')
        .eq('clerk_id', userId)
        .maybeSingle(),
      sb.from('trade_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    const plan = plansRes.data?.plan ?? usersRes.data?.plan ?? 'free'

    // Check if subscription plan is expired
    const expiresAt = plansRes.data?.plan_expires_at ?? null
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false
    const effectivePlan = isExpired ? 'free' : plan

    return NextResponse.json({
      plan: effectivePlan,
      session_quota: plansRes.data?.session_quota ?? null,
      sessions_used: plansRes.data?.sessions_used ?? 0,
      plan_expires_at: expiresAt,
      plan_started_at: plansRes.data?.plan_started_at ?? null,
      session_count: sessionCountRes.count ?? 0,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}
