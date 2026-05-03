import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

const InputSchema = z.object({
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
})

/**
 * Payment Verification Route
 *
 * This route handles TWO flows:
 *
 * 1. CLIENT-SIDE VERIFICATION (used in development + production):
 *    After Razorpay checkout success, the frontend POSTs the payment details
 *    here. We verify the HMAC signature and update the DB.
 *    This works on localhost — no webhook needed.
 *
 * 2. WEBHOOK VERIFICATION (production only):
 *    Razorpay can also POST to this endpoint as a webhook.
 *    Configure in Razorpay Dashboard → Webhooks → https://tradesaath.vercel.app/api/payments/verify
 *    This won't work on localhost since Razorpay can't reach it.
 *    For local testing, the client-side flow (option 1) is sufficient.
 *
 * Test card for Razorpay TEST mode:
 *   Card: 4111 1111 1111 1111
 *   Expiry: any future date (e.g. 12/30)
 *   CVV: any 3 digits (e.g. 123)
 *   OTP: 1234
 */

export async function POST(req: NextRequest) {
  try {
    const parsed = InputSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data

    // Verify HMAC SHA256 signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      console.error('[Razorpay] Payment signature mismatch — possible tampering')
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    console.log(`[Razorpay] Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`)

    // --- Ownership check: the authenticated user must own this payment ---
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Fetch the payment record — check ownership + idempotency in one query
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('clerk_id, plan, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .single()

    if (payErr || !payment) {
      console.error(`[Razorpay] Payment record not found for order ${razorpay_order_id}`)
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })
    }

    if (payment.clerk_id !== clerkId) {
      console.error(`[Razorpay] Ownership mismatch: payment belongs to ${payment.clerk_id}, request from ${clerkId}`)
      return NextResponse.json({ error: 'Payment ownership mismatch' }, { status: 403 })
    }

    // Idempotency: if already completed, return success without re-processing
    if (payment.status === 'completed') {
      console.log(`[Razorpay] Payment ${razorpay_order_id} already completed — idempotent return`)
      return NextResponse.json({ success: true, paymentId: razorpay_payment_id })
    }

    // Update payment status in Supabase
    try {
      await supabaseAdmin
        .from('payments')
        .update({
          razorpay_payment_id,
          razorpay_signature,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', razorpay_order_id)
    } catch (dbErr) {
      console.error('Failed to update payment in DB:', dbErr)
    }

    // Update user plan (payment already fetched above with ownership check)
    try {
        const plan = payment.plan || 'single'

        // UPSERT: handles case where user row doesn't exist yet (webhook race)
        const { error: upsertErr } = await supabaseAdmin
          .from('users')
          .upsert({
            clerk_id: clerkId,
            plan,
            plan_updated_at: new Date().toISOString(),
          }, { onConflict: 'clerk_id' })

        if (upsertErr) {
          console.error(`[Razorpay] Failed to upsert user plan for ${clerkId}:`, upsertErr.message)
        } else {
          console.log(`[Razorpay] User ${clerkId} upgraded to plan: ${plan}`)
        }

        // Also upsert into user_plans table for plan tracking
        const expiresAt = plan === 'single' ? null :
          plan === 'pro_monthly' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) :
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

        await supabaseAdmin
          .from('user_plans')
          .upsert({
            user_id: clerkId,
            plan,
            razorpay_payment_id: razorpay_payment_id,
            plan_started_at: new Date().toISOString(),
            plan_expires_at: expiresAt?.toISOString() || null,
            // Single plan: 50 session quota; Pro plans: unlimited (NULL)
            session_quota: plan === 'single' ? 50 : null,
            sessions_used: 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

        // Update the latest trade_session with payment info
        const { data: latestSession } = await supabaseAdmin
          .from('trade_sessions')
          .select('id')
          .eq('user_id', clerkId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (latestSession) {
          await supabaseAdmin
            .from('trade_sessions')
            .update({ plan, payment_id: razorpay_payment_id })
            .eq('id', latestSession.id)
        }
    } catch (userErr) {
      console.error('Failed to update user plan (non-critical):', userErr)
    }

    return NextResponse.json({ success: true, paymentId: razorpay_payment_id })
  } catch (err: unknown) {
    console.error('Payment verify error:', err)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}
