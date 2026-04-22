import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await req.json()
  const targetUserId = params.userId
  const sb = getSupabaseAdmin()

  if (!targetUserId || !action) {
    return NextResponse.json({ error: 'userId and action required' }, { status: 400 })
  }

  const allowed = new Set(['reset_quota', 'set_pro', 'set_free'])
  if (!allowed.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  let payload: Record<string, unknown> = {}

  if (action === 'reset_quota') {
    const { error } = await sb
      .from('user_plans')
      .update({ sessions_used: 0 })
      .eq('user_id', targetUserId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    payload = { sessions_used_reset_to: 0 }
  }

  if (action === 'set_pro') {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error: planErr } = await sb
      .from('user_plans')
      .upsert(
        {
          user_id: targetUserId,
          plan: 'pro_monthly',
          plan_started_at: new Date().toISOString(),
          plan_expires_at: expiresAt,
          session_quota: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

    await sb.from('users').update({ plan: 'pro_monthly' }).eq('clerk_id', targetUserId)
    payload = { plan: 'pro_monthly', plan_expires_at: expiresAt }
  }

  if (action === 'set_free') {
    const { error: planErr } = await sb
      .from('user_plans')
      .upsert(
        {
          user_id: targetUserId,
          plan: 'free',
          plan_expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

    await sb.from('users').update({ plan: 'free' }).eq('clerk_id', targetUserId)
    payload = { plan: 'free' }
  }

  // Audit log
  await sb.from('admin_actions').insert({
    admin_clerk_id: adminId,
    target_user_id: targetUserId,
    action,
    payload,
  })

  return NextResponse.json({ success: true, action, payload })
}
