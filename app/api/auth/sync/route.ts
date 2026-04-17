import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { syncUser } from '@/lib/supabase'
import { migrateAnonToUser } from '@/lib/supabase/migrateAnonData'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { email, name } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      )
    }

    // Always use the server-verified userId, never trust client-provided clerkId
    const user = await syncUser(userId, email, name || '')

    // Migrate anonymous data if anon cookie exists
    const anonId = req.cookies.get('tradesaath_anon_id')?.value
    let migrationResult = null
    if (anonId) {
      try {
        migrationResult = await migrateAnonToUser(anonId, userId)
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
    console.error('Auth sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
