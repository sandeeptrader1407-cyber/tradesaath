import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv, KV_AVAILABLE } from '@/lib/kv'

export const runtime = 'nodejs'

function todayKey(userId: string): string {
  const today = new Date().toISOString().split('T')[0]
  return `intentions:${userId}:${today}`
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ intentions: [], completed: false })

    if (!KV_AVAILABLE) return NextResponse.json({ intentions: [], completed: false })

    const data = await kv.get<string[]>(todayKey(userId))
    const intentions = Array.isArray(data) ? data : []
    return NextResponse.json({ intentions, completed: intentions.length > 0 })
  } catch {
    return NextResponse.json({ intentions: [], completed: false })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json() as { intentions?: string[] }
    const intentions = Array.isArray(body.intentions) ? body.intentions : []

    if (!KV_AVAILABLE) return NextResponse.json({ success: true })

    await kv.set(todayKey(userId), intentions, { ex: 86400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save intentions' }, { status: 500 })
  }
}
