import { auth } from '@clerk/nextjs/server'

const ADMIN_IDS = [process.env.ADMIN_CLERK_USER_ID_1].filter(Boolean) as string[]

export async function requireAdmin(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId || !ADMIN_IDS.includes(userId)) return null
  return userId
}
