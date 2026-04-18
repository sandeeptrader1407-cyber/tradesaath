export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

interface CouponRow {
  id: string
  code: string
  plan: string
  duration_days: number
  max_uses: number | null
  current_uses: number | null
  is_active: boolean
  expires_at: string | null
}

/**
 * POST /api/coupons/redeem
 * Body: { code: string }
 * Auth: required (Clerk)
 *
 * Validates and applies a coupon code, granting the user the specified
 * plan for `duration_days`. Each user may redeem any single coupon once.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limit: 5 attempts per user per hour
    const rl = rateLimit(`coupon:${userId}`, 5, 60 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await req.json().catch(() => ({}))
    const rawCode = typeof body?.code === 'string' ? body.code : ''
    const code = rawCode.trim().toUpperCase()

    if (!code) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // 1. Look up coupon (case-insensitive — codes are stored uppercase)
    const { data: coupon, error: lookupErr } = await supabaseAdmin
      .from('coupons')
      .select('id, code, plan, duration_days, max_uses, current_uses, is_active, expires_at')
      .eq('code', code)
      .maybeSingle<CouponRow>()

    if (lookupErr || !coupon) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
    }

    // 2. Validate
    if (!coupon.is_active) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }
    const used = coupon.current_uses ?? 0
    const max = coupon.max_uses ?? 0
    if (max > 0 && used >= max) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // 3. Already redeemed by this user?
    const { data: existing } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'You have already redeemed this code' }, { status: 400 })
    }

    // 4. Insert redemption (UNIQUE constraint protects against races)
    const { error: redeemErr } = await supabaseAdmin
      .from('coupon_redemptions')
      .insert({ coupon_id: coupon.id, user_id: userId })

    if (redeemErr) {
      return NextResponse.json({ error: 'Could not redeem code' }, { status: 500 })
    }

    // 5. Increment current_uses
    await supabaseAdmin
      .from('coupons')
      .update({ current_uses: used + 1 })
      .eq('id', coupon.id)

    // 6. Upsert user_plans with new plan + expiry
    const expiresAt = new Date(Date.now() + coupon.duration_days * 24 * 60 * 60 * 1000)
    const { error: planErr } = await supabaseAdmin
      .from('user_plans')
      .upsert(
        {
          user_id: userId,
          plan: coupon.plan,
          plan_started_at: new Date().toISOString(),
          plan_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (planErr) {
      return NextResponse.json({ error: 'Could not activate plan' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plan: coupon.plan,
      durationDays: coupon.duration_days,
      expiresAt: expiresAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }
}
