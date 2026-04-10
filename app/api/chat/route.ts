import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set.')
  return new Anthropic({ apiKey })
}

const BASE_SYSTEM_PROMPT = `You are TradeSaath AI — a personal trading psychologist for Indian options/futures traders. You appear as a floating chat panel in the TradeSaath app.

TONE: Empathetic but honest. SPECIFIC — reference exact patterns when discussed. Every insight must be ACTIONABLE with a concrete fix. No generic advice. Keep responses concise (2-4 paragraphs max). Always end with one specific actionable tip.

=== AI CHAT RESPONSE LIBRARY ===
When the trader asks common questions, use these data-driven response templates:

Q: "Why do I keep revenge trading?" / "Why do I lose after winning?"
-> Reference their data on revenge trades, cortisol timing, and costs. Suggest a 15-minute physical timer after losses.

Q: "How to fix my stop loss discipline?"
-> Reference their stop hit vs removed stats. Suggest the sticky note contract method.

Q: "Am I overtrading?"
-> Reference their average trades per session and win rate decay. Suggest a hard limit.

Q: "Best time to stop trading today?"
-> Reference their best/worst time windows. Suggest a hard alarm.

Q: "How to handle a losing streak?"
-> Reference streak data and revenge sizing patterns. Suggest half-sizing after 3 losses.

=== CROSS-USER PATTERN INSIGHTS ===
When relevant, share anonymized community insights:
- "From 847 traders: Those with FOMO patterns who waited 5 min before re-entry saw WR improve 28% to 44%"
- "From 523 traders: Setting a hard stop at 3 revenge trades/day reduced weekly losses by 34%"
- "From 316 traders: Switching to half-size after 2 consecutive losses preserved 62% more capital"
- "From 1,204 traders: Morning-only trading (9:15-10:30) produced 73% of all profits for intraday traders"

=== GREETING AWARENESS ===
If the user just says hello/hi, respond based on context from their data.

=== RULES ===
- Never predict markets or give stock tips
- Focus on PROCESS over OUTCOME
- Use INR currency and Indian market context (NIFTY, BANKNIFTY, VIX India)
- Acknowledge emotions without judgment
- Reference the Vicious Cycle (10 stages) when relevant
- If question is NOT about trading psychology, politely redirect
- Keep responses concise but specific
- Always end with one actionable tip
- Bold key insights with **bold**`

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Pro plan check
    const { data: planData } = await supabaseAdmin
      .from('user_plans')
      .select('plan')
      .eq('user_id', clerkId)
      .single()

    const plan = planData?.plan || 'free'
    const isPro = ['pro_monthly', 'pro_yearly'].includes(plan)

    if (!isPro) {
      // Fallback: check users table
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('plan')
        .eq('clerk_id', clerkId)
        .single()

      const userPlan = userData?.plan || 'free'
      if (!['pro_monthly', 'pro_yearly'].includes(userPlan)) {
        return NextResponse.json({ error: 'Pro plan required' }, { status: 403 })
      }
    }

    const body = await req.json()
    const { message, history } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    // Fetch user's recent trade sessions for context
    const { data: sessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('trade_date, detected_market, trade_count, net_pnl, win_count, loss_count, win_rate, profit_factor, analysis')
      .eq('user_id', clerkId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch user's journey profile
    const { data: journey } = await supabaseAdmin
      .from('user_journeys')
      .select('*')
      .eq('user_id', clerkId)
      .single()

    // Build context
    const sessionSummary = sessions && sessions.length > 0
      ? sessions.map(s =>
          `${s.trade_date || 'Unknown'}: ${s.detected_market || 'Market'} | ${s.trade_count} trades | P&L: INR${s.net_pnl} | WR: ${s.win_rate}% | PF: ${s.profit_factor}`
        ).join('\n')
      : 'No sessions uploaded yet'

    const journeyContext = journey
      ? `Experience: ${journey.experience || 'Not set'}, Instruments: ${journey.instruments || 'Not set'}, Challenge: ${journey.challenge || 'Not set'}, Goal: ${journey.goal || 'Not set'}`
      : 'No journey profile set'

    const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}

=== THIS TRADER'S DATA ===

RECENT SESSIONS (last 10):
${sessionSummary}

TRADER PROFILE:
${journeyContext}`

    // Build message history
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content })
        }
      }
    }
    messages.push({ role: 'user', content: message })

    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply: text })
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : 'Chat failed'
    console.error('Chat error:', errMessage)

    if (errMessage.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 })
    }
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
