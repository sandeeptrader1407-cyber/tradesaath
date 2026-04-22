import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('feature_flags')
    .select('key, value, updated_by, updated_at')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flags: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, value } = await req.json()
  if (!key || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'key (string) and value (boolean) required' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from('feature_flags')
    .upsert(
      { key, value, updated_by: adminId, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await sb.from('admin_actions').insert({
    admin_clerk_id: adminId,
    target_user_id: 'system',
    action: 'toggle_flag',
    payload: { key, value },
  })

  return NextResponse.json({ success: true })
}
