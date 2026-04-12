import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, tradeIndex, notes } = body as {
      sessionId: string
      tradeIndex: number
      notes: string
    }

    if (!sessionId || typeof tradeIndex !== 'number') {
      return NextResponse.json({ error: 'Missing sessionId or tradeIndex' }, { status: 400 })
    }

    // Verify the session belongs to this user
    const { data: session } = await supabaseAdmin
      .from('trade_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Update the notes column in trade_analysis
    const { error } = await supabaseAdmin
      .from('trade_analysis')
      .update({ notes: notes || null })
      .eq('session_id', sessionId)
      .eq('trade_index', tradeIndex)

    if (error) {
      console.error('Failed to save trade note:', error)
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Trade notes error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
