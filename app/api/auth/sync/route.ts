import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { syncUser } from '@/lib/supabase'
import { migrateAnonToUser } from '@/lib/supabase/migrateAnonData'

const InputSchema = z.object({
  email:     z.string().email(),
  name:      z.string().optional(),
  createdAt: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const parsed = InputSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const { email, name, createdAt } = parsed.data

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

    // Set new-user cookie if the account was created within the last 60 s.
    // Readable by JS (httpOnly: false) so dashboard can show the welcome toast.
    if (createdAt) {
      const ageMs = Date.now() - new Date(createdAt).getTime()
      if (ageMs < 60_000) {
        response.cookies.set('ts-new-user', '1', {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 300,
          path: '/',
        })
      }
    }

    return response
  } catch (err: unknown) {
    console.error('Auth sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
