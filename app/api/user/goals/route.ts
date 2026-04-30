import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv, KV_AVAILABLE } from '@/lib/kv'

export const runtime = 'nodejs'

export interface UserGoals {
  monthlyPnlTarget?: number
  weeklySessionTarget?: number
  monthlySessionTarget?: number
}

function goalsKey(userId: string): string {
  return `goals:${userId}`
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ goals: {} })
    if (!KV_AVAILABLE) return NextResponse.json({ goals: {} })

    const data = await kv.get<UserGoals>(goalsKey(userId))
    return NextResponse.json({ goals: data || {} })
  } catch {
    return NextResponse.json({ goals: {} })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json() as Partial<UserGoals>
    const goals: UserGoals = {}
    if (typeof body.monthlyPnlTarget === 'number') goals.monthlyPnlTarget = body.monthlyPnlTarget
    if (typeof body.weeklySessionTarget === 'number') goals.weeklySessionTarget = body.weeklySessionTarget
    if (typeof body.monthlySessionTarget === 'number') goals.monthlySessionTarget = body.monthlySessionTarget

    if (!KV_AVAILABLE) return NextResponse.json({ success: true })

    await kv.set(goalsKey(userId), goals)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
  }
}
