export const runtime = 'nodejs'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // 1. Read raw body as text (required for HMAC verification)
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature || !rawBody) {
      return NextResponse.json({ error: 'Missing signature or body' }, { status: 400 })
    }

    // 2. Verify HMAC SHA256 signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (expectedSignature !== signature) {
      console.error('[Razorpay Webhook] Signature mismatch — rejecting')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // 3. Parse verified body
    const event = JSON.parse(rawBody)
    const eventType = event.event as string
    console.log(`[Razorpay Webhook] Event: ${eventType}, payment_id: ${event.payload?.payment?.entity?.id}`)

    // 4. Handle payment.captured
    if (eventType === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      if (!payment) {
        console.error('[Razorpay Webhook] payment.captured but no payment entity')
        return NextResponse.json({ received: true, error: 'No payment entity' }, { status: 200 })
      }

      const razorpayPaymentId = payment.id as string
      const razorpayOrderId = payment.order_id as string
      const clerkId = payment.notes?.clerk_id as string | undefined
      const plan = payment.notes?.plan as string | undefined

      // Idempotency: check if already processed
      const { data: existing } = await supabaseAdmin
        .from('payments')
        .select('status, amount')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .eq('status', 'completed')
        .maybeSingle()

      if (existing) {
        console.log(`[Razorpay Webhook] Payment ${razorpayPaymentId} already completed — skipping`)
        return NextResponse.json({ received: true, duplicate: true })
      }

      // Verify payment amount matches what we expected (prevent amount tampering)
      const { data: orderRow } = await supabaseAdmin
        .from('payments')
        .select('amount')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle()

      const paidAmountPaise = payment.amount as number
      const expectedAmountPaise = orderRow?.amount ?? null
      if (expectedAmountPaise && paidAmountPaise < expectedAmountPaise) {
        console.error(`[Razorpay Webhook] Amount mismatch! Expected ${expectedAmountPaise} paise, got ${paidAmountPaise} paise for order ${razorpayOrderId}`)
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
      }

      // Update payment record (created by create-order)
      const { error: updateErr } = await supabaseAdmin
        .from('payments')
        .update({
          razorpay_payment_id: razorpayPaymentId,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', razorpayOrderId)

      if (updateErr) {
        console.error(`[Razorpay Webhook] Failed to update payment ${razorpayOrderId}:`, updateErr.message)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }

      // Update user plan — only if we have clerk_id from notes
      if (clerkId && plan) {
        try {
          // Upsert users table
          await supabaseAdmin
            .from('users')
            .upsert({
              clerk_id: clerkId,
              plan,
              plan_updated_at: new Date().toISOString(),
            }, { onConflict: 'clerk_id' })

          // Upsert user_plans table (same pattern as verify route)
          const expiresAt = plan === 'single' ? null :
            plan === 'pro_monthly' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) :
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

          await supabaseAdmin
            .from('user_plans')
            .upsert({
              user_id: clerkId,
              plan,
              razorpay_payment_id: razorpayPaymentId,
              plan_started_at: new Date().toISOString(),
              plan_expires_at: expiresAt?.toISOString() || null,
              session_quota: plan === 'single' ? 50 : null,
              sessions_used: 0,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })

          console.log(`[Razorpay Webhook] User ${clerkId} upgraded to ${plan}`)
        } catch (userErr) {
          console.error(`[Razorpay Webhook] Failed to update user plan for ${clerkId}:`, userErr)
          // Don't return 500 — payment is already marked completed
        }
      } else {
        // No clerk_id in notes — try to find it from the payment record
        const { data: paymentRow } = await supabaseAdmin
          .from('payments')
          .select('clerk_id, plan')
          .eq('razorpay_order_id', razorpayOrderId)
          .maybeSingle()

        if (paymentRow?.clerk_id && paymentRow?.plan) {
          try {
            await supabaseAdmin
              .from('users')
              .upsert({
                clerk_id: paymentRow.clerk_id,
                plan: paymentRow.plan,
                plan_updated_at: new Date().toISOString(),
              }, { onConflict: 'clerk_id' })

            const expiresAt = paymentRow.plan === 'single' ? null :
              paymentRow.plan === 'pro_monthly' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) :
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

            await supabaseAdmin
              .from('user_plans')
              .upsert({
                user_id: paymentRow.clerk_id,
                plan: paymentRow.plan,
                razorpay_payment_id: razorpayPaymentId,
                plan_started_at: new Date().toISOString(),
                plan_expires_at: expiresAt?.toISOString() || null,
                session_quota: paymentRow.plan === 'single' ? 50 : null,
                sessions_used: 0,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' })

            console.log(`[Razorpay Webhook] User ${paymentRow.clerk_id} upgraded to ${paymentRow.plan} (from DB lookup)`)
          } catch (userErr) {
            console.error(`[Razorpay Webhook] Failed to update user plan from DB lookup:`, userErr)
          }
        } else {
          console.warn(`[Razorpay Webhook] No clerk_id found for order ${razorpayOrderId} — plan not updated`)
        }
      }

      return NextResponse.json({ received: true, processed: true })
    }

    // 5. Handle payment.failed
    if (eventType === 'payment.failed') {
      const payment = event.payload?.payment?.entity
      console.error(`[Razorpay Webhook] Payment failed:`, {
        id: payment?.id,
        order_id: payment?.order_id,
        error_code: payment?.error_code,
        error_description: payment?.error_description,
      })

      if (payment?.order_id) {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'failed' })
          .eq('razorpay_order_id', payment.order_id)
      }

      return NextResponse.json({ received: true, status: 'failed_recorded' })
    }

    // 6. All other events — acknowledge but ignore
    console.log(`[Razorpay Webhook] Ignoring event: ${eventType}`)
    return NextResponse.json({ received: true, ignored: true })

  } catch (err: unknown) {
    console.error('[Razorpay Webhook] Unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
