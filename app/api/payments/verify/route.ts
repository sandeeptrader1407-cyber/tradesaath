import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 })
    }

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

    // Update user plan if authenticated
    try {
      const { userId: clerkId } = await auth()
      if (clerkId) {
        // Get the plan from the payment record
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('plan')
          .eq('razorpay_order_id', razorpay_order_id)
          .single()

        const plan = payment?.plan || 'single'

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
      }
    } catch (userErr) {
      console.error('Failed to update user plan (non-critical):', userErr)
    }

    return NextResponse.json({ success: true, paymentId: razorpay_payment_id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed'
    console.error('Payment verify error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
