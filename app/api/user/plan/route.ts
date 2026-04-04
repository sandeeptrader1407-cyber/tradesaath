import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/user/plan
 * Returns the current user's plan from Supabase.
 * If not authenticated, returns { plan: 'free' }.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ plan: 'free', authenticated: false })
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('clerk_id', clerkId)
      .single()

    if (error || !data) {
      return NextResponse.json({ plan: 'free', authenticated: true })
    }

    return NextResponse.json({
      plan: data.plan || 'free',
      authenticated: true,
    })
  } catch {
    return NextResponse.json({ plan: 'free', authenticated: false })
  }
}
