import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { PLANS, type PlanId } from '@/lib/config/pricing'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

const keyId = process.env.RAZORPAY_KEY_ID!
const keySecret = process.env.RAZORPAY_KEY_SECRET!

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
})

export async function POST(req: NextRequest) {
  try {
    // Require authentication — no anonymous orders
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limit: 5 per user per hour (prevent payment spam)
    const rl = await rateLimit(`payment:${clerkId}`, 5, 60 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const { plan } = await req.json()

    // Determine amount based on plan (from shared config)
    const planId = (plan || 'single') as string
    if (!(planId in PLANS) || planId === 'free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    const selectedPlan = PLANS[planId as Exclude<PlanId, 'free'>]

    console.log(`[Razorpay] Creating order: ${plan} — ₹${selectedPlan.price / 100}`)

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: selectedPlan.price,
      currency: 'INR',
      receipt: `ts_${Date.now()}`,
      notes: { plan, description: selectedPlan.description },
    })

    console.log(`[Razorpay] Order created: ${order.id}`)

    // Get user email for Razorpay prefill
    let userEmail = null
    try {
      const { data } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('clerk_id', clerkId)
        .single()
      if (data) userEmail = data.email
    } catch { /* email lookup failed — non-critical */ }

    // Save pending payment to Supabase
    try {
      await supabaseAdmin.from('payments').insert({
        razorpay_order_id: order.id,
        plan,
        amount: selectedPlan.price,
        currency: 'INR',
        status: 'pending',
        clerk_id: clerkId,
        email: userEmail,
        created_at: new Date().toISOString(),
      })
    } catch (dbErr) {
      console.error('Failed to save payment to DB (continuing):', dbErr)
    }

    return NextResponse.json({
      orderId: order.id,
      amount: selectedPlan.price,
      currency: 'INR',
      keyId,
      plan,
      description: selectedPlan.description,
      prefillEmail: userEmail,
    })
  } catch (err: unknown) {
    console.error('[Razorpay] Full error object:', JSON.stringify(err, null, 2))
    console.error('[Razorpay] Key ID exists:', !!process.env.RAZORPAY_KEY_ID)
    console.error('[Razorpay] Secret exists:', !!process.env.RAZORPAY_KEY_SECRET)
    console.error('[Razorpay] Key ID value:', process.env.RAZORPAY_KEY_ID?.slice(0, 15) + '...')

    // Razorpay SDK errors have statusCode and error fields
    const rzpErr = err as { statusCode?: number; error?: { code?: string; description?: string; reason?: string } }
    if (rzpErr.error?.description) {
      console.error('[Razorpay] API error:', rzpErr.error.description, '| reason:', rzpErr.error.reason)
    }

    const message = rzpErr.error?.description
      || (err instanceof Error ? err.message : 'Failed to create order')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
