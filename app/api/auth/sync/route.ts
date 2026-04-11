import { NextRequest, NextResponse } from 'next/server'
import { syncUser } from '@/lib/supabase'
import { migrateAnonToUser } from '@/lib/supabase/migrateAnonData'

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

    // Migrate anonymous data if anon cookie exists
    const anonId = req.cookies.get('tradesaath_anon_id')?.value
    let migrationResult = null
    if (anonId) {
      try {
        migrationResult = await migrateAnonToUser(anonId, clerkId)
      } catch (migErr) {
        console.error('Anon migration failed (non-blocking):', migErr)
      }
    }

    // Build response — clear anon cookie if it existed
    const response = NextResponse.json({ user, migrated: migrationResult })
    if (anonId) {
      response.cookies.set('tradesaath_anon_id', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
    }

    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
