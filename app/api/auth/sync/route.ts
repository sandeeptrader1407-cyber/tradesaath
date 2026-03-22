import { NextRequest, NextResponse } from 'next/server'
import { syncUser } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { clerkId, email, name } = await req.json()

    if (!clerkId || !email) {
      return NextResponse.json(
        { error: 'clerkId and email are required' },
        { status: 400 }
      )
    }

    const user = await syncUser(clerkId, email, name || '')
    return NextResponse.json({ user })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
