import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ journey: null })

    const { data } = await supabaseAdmin
      .from('user_journeys')
      .select('*')
      .eq('user_id', userId)
      .single()

    return NextResponse.json({ journey: data })
  } catch {
    return NextResponse.json({ journey: null })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()

    const { error } = await supabaseAdmin
      .from('user_journeys')
      .upsert(
        {
          user_id: userId,
          experience: body.experience,
          instruments: body.instruments,
          challenge: body.challenge,
          goal: body.goal,
          perfect_day: body.perfectDay,
          one_change: body.oneChange,
          step_1_beginning: body.step1Beginning || null,
          step_2_dark_days: body.step2DarkDays || null,
          step_3_shift: body.step3Shift || null,
          step_4_today: body.step4Today || null,
          step_5_truth: body.step5Truth || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Journey save error:', error.message)
      return NextResponse.json({ error: 'Failed to save journey' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save journey' }, { status: 500 })
  }
}
