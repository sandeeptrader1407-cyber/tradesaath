import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

/**
 * Get or create an anonymous ID from cookies.
 * Used to track non-logged-in users so their data can be migrated on signup.
 */
export async function getOrCreateAnonId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get('tradesaath_anon_id')

  if (existing?.value) {
    return existing.value
  }

  const newId = uuidv4()
  cookieStore.set('tradesaath_anon_id', newId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  })

  return newId
}

/**
 * Read the anon_id cookie without creating one.
 */
export async function getAnonId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('tradesaath_anon_id')?.value || null
}

/**
 * Clear anon_id cookie (call after migrating data to a real user).
 */
export async function clearAnonId(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('tradesaath_anon_id')
}
