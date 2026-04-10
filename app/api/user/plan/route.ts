import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/plan
 * Returns the current user's plan from Supabase.
 * Checks user_plans table first (with expiration), falls back to users table.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ plan: 'free', authenticated: false })
    }

    // Check user_plans table first (set by payment flow)
    const { data: planData } = await supabaseAdmin
      .from('user_plans')
      .select('plan, plan_expires_at')
      .eq('user_id', clerkId)
      .single()

    if (planData) {
      // Check expiration for subscription plans
      if (planData.plan_expires_at && new Date(planData.plan_expires_at) < new Date()) {
        return NextResponse.json({ plan: 'free', authenticated: true, expired: true })
      }
      return NextResponse.json({
        plan: planData.plan || 'free',
        authenticated: true,
      })
    }

    // Fallback: check users table
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('clerk_id', clerkId)
      .single()

    return NextResponse.json({
      plan: userData?.plan || 'free',
      authenticated: true,
    })
  } catch {
    return NextResponse.json({ plan: 'free', authenticated: false })
  }
}
