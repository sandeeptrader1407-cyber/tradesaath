import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ sessions: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('clerk_id', clerkId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Sessions fetch error:', error)
      return NextResponse.json({ sessions: [] })
    }

    return NextResponse.json({ sessions: data || [] })
  } catch (err) {
    console.error('Sessions API error:', err)
    return NextResponse.json({ sessions: [] })
  }
}
