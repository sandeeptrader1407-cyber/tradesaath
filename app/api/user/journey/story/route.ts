import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const maxDuration = 60

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rl = rateLimit(`journey-story:${userId}`, 5, 60 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await request.json()
    const { step1Beginning, step2DarkDays, step3Shift, step4Today, step5Truth } = body as Record<string, string>

    // Fetch trade data summary
    const { data: sessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('id, created_at, trade_count, net_pnl, win_rate, win_count, loss_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    let tradeSummary = 'No trading data yet — story based on narrative only.'
    if (sessions && sessions.length > 0) {
      const totalTrades = sessions.reduce((s, x) => s + (x.trade_count || 0), 0)
      const totalPnl = sessions.reduce((s, x) => s + (x.net_pnl || 0), 0)
      const avgWr = Math.round(sessions.reduce((s, x) => s + (x.win_rate || 0), 0) / sessions.length)
      const totalWins = sessions.reduce((s, x) => s + (x.win_count || 0), 0)
      const totalLosses = sessions.reduce((s, x) => s + (x.loss_count || 0), 0)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted = [...sessions].sort((a: any, b: any) => (b.net_pnl || 0) - (a.net_pnl || 0))
      const bestDay = sorted[0]
      const worstDay = sorted[sorted.length - 1]

      const firstDate = new Date(sessions[sessions.length - 1].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      const latestDate = new Date(sessions[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

      tradeSummary = `REAL TRADING DATA:
- Total sessions: ${sessions.length}
- Total trades: ${totalTrades}
- Net P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-IN')} INR
- Average win rate: ${avgWr}%
- Total wins: ${totalWins}, Total losses: ${totalLosses}
- Best session: ${bestDay.net_pnl >= 0 ? '+' : ''}${(bestDay.net_pnl || 0).toLocaleString('en-IN')} INR on ${new Date(bestDay.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
- Worst session: ${(worstDay.net_pnl || 0).toLocaleString('en-IN')} INR on ${new Date(worstDay.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
- Trading since: ${firstDate}
- Latest session: ${latestDate}`
    }

    const prompt = `You are a cinematic writer crafting a deeply personal trading journey story. The trader has shared their story in 5 chapters, and you have their actual trading data. Weave both together into a beautiful, motivating, honest narrative.

THE TRADER'S 5 CHAPTERS:
1. THE BEGINNING: ${step1Beginning || '(not shared)'}
2. THE DARK DAYS: ${step2DarkDays || '(not shared)'}
3. THE SHIFT: ${step3Shift || '(not shared)'}
4. TODAY: ${step4Today || '(not shared)'}
5. YOUR TRUTH: ${step5Truth || '(not shared)'}

${tradeSummary}

WRITING RULES:
- Write in second person ("You started..." "You survived...")
- 300-500 words, cinematic narrative style
- Reference SPECIFIC numbers from their data naturally (sessions, trades, P&L amounts, dates)
- Be honest about struggles — don't sugarcoat losses or dark periods
- Celebrate their self-awareness and growth
- Weave their personal words with data — "You said your worst period was [their words]. The data confirms it — [specific numbers]"
- End with a powerful, personal closing that ties their "truth" to their journey
- Use occasional Hindi words naturally if it fits ("safar", "himmat", "seekh")
- Make it feel like reading the opening of a movie about their life
- NO generic motivational quotes. Every line must be PERSONAL to THIS trader.
- If no trade data available, focus purely on their narrative — their words are enough to tell a powerful story.

Return ONLY the story text. No JSON, no markdown headers, no backticks. Just the story.`

    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const story = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Save to database
    await supabaseAdmin
      .from('user_journeys')
      .update({
        generated_story: story,
        story_generated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return NextResponse.json({ story })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Story generation failed'
    console.error('Journey story error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
