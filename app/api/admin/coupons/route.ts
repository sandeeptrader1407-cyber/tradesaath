import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/isAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = getSupabaseAdmin()

  const { data: coupons, error } = await sb
    .from('coupons')
    .select('id, code, plan, duration_days, max_uses, current_uses, is_active, created_at, expires_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Redemptions for each coupon
  const couponIds = (coupons ?? []).map(c => c.id)
  const { data: redemptions } = couponIds.length
    ? await sb
        .from('coupon_redemptions')
        .select('coupon_id, user_id, redeemed_at')
        .in('coupon_id', couponIds)
        .order('redeemed_at', { ascending: false })
    : { data: [] }

  // Enrich redemptions with emails
  const userIds = Array.from(new Set((redemptions ?? []).map(r => r.user_id).filter(Boolean)))
  const { data: users } = userIds.length
    ? await sb.from('users').select('clerk_id, email').in('clerk_id', userIds)
    : { data: [] }
  const emailMap = new Map((users ?? []).map(u => [u.clerk_id, u.email]))

  const redemptionsByCoupon: Record<string, { user_id: string; email: string; redeemed_at: string }[]> = {}
  for (const r of redemptions ?? []) {
    if (!redemptionsByCoupon[r.coupon_id]) redemptionsByCoupon[r.coupon_id] = []
    redemptionsByCoupon[r.coupon_id].push({
      user_id: r.user_id,
      email: emailMap.get(r.user_id) ?? r.user_id,
      redeemed_at: r.redeemed_at,
    })
  }

  const enriched = (coupons ?? []).map(c => ({
    ...c,
    redemptions: redemptionsByCoupon[c.id] ?? [],
  }))

  return NextResponse.json({ coupons: enriched })
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { code, plan, duration_days, max_uses, expires_at } = body

  if (!code || !plan || !duration_days) {
    return NextResponse.json({ error: 'code, plan, and duration_days are required' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('coupons')
    .insert({
      code: String(code).toUpperCase().trim(),
      plan,
      duration_days: Number(duration_days),
      max_uses: max_uses ? Number(max_uses) : null,
      expires_at: expires_at || null,
      current_uses: 0,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupon: data })
}

export async function PATCH(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, is_active } = await req.json()
  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'id and is_active required' }, { status: 400 })
  }

  const sb = getSupabaseAdmin()
  const { error } = await sb
    .from('coupons')
    .update({ is_active })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
