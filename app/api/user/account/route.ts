import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function DELETE() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const sb = getSupabaseAdmin()

    // Delete in cascade-safe order:
    // trade_analysis has ON DELETE CASCADE from trade_sessions, so deleting
    // sessions also removes per-trade analysis rows automatically.
    await sb.from('trade_sessions').delete().eq('user_id', userId)
    await sb.from('raw_files').delete().eq('user_id', userId)
    await sb.from('user_journeys').delete().eq('user_id', userId)
    await sb.from('user_plans').delete().eq('user_id', userId)
    await sb.from('coupon_redemptions').delete().eq('user_id', userId)
    await sb.from('ai_usage_log').delete().eq('user_id', userId)
    await sb.from('users').delete().eq('clerk_id', userId)

    // Remove the user from Clerk — this invalidates all active sessions
    const clerk = await clerkClient()
    await clerk.users.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Account deletion failed'
    console.error('[DELETE /api/user/account]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
