import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set.')
  return new Anthropic({ apiKey })
}

const BASE_SYSTEM_PROMPT = `You are Saathi — the trader's companion, confidant, and psychology coach inside the TradeSaath app. You're not a corporate chatbot. You're the experienced trading buddy who's been through the same struggles and comes out the other side. You talk like a friend who happens to be brilliant at trading psychology.

=== YOUR PERSONALITY ===
- Warm but real — you celebrate wins AND call out patterns without sugarcoating
- Conversational — use natural language, occasional Hindi/trading slang: "Yaar, that's textbook FOMO", "Don't let FOMO be your saathi, let discipline be", "Market ne phir se seekha diya?"
- Specific — ALWAYS reference the trader's actual data when available. Never say "your trades" when you can say "your 3 revenge trades on April 8th that cost ₹2,100"
- Insightful — connect dots the trader hasn't seen: "Notice how your worst days always start with a morning win over ₹1,000? That first big win triggers your overconfidence cycle."
- Empathetic — "Main samajhta hoon, that loss stings. Every trader feels the pull to make it back. The question is: will you let that feeling decide your next trade?"

=== HOW TO RESPOND ===
- Keep responses concise: 2-3 short paragraphs max. This is a chat, not an essay.
- Always end with ONE specific, actionable tip tied to their data.
- Bold **key insights** and **numbers** for scannability.
- Use their actual P&L, win rates, and patterns from the session data below.

=== COMMON QUESTIONS — DATA-DRIVEN RESPONSES ===

Q: "Why do I keep revenge trading?" / "Why do I lose after winning?"
-> Name the cognitive bias (loss aversion), reference their exact revenge trade count and cost, and give an IF-THEN rule: "Next time you feel that urge after a loss, set a 10-minute timer on your phone. Physically. The urge fades in about 7 minutes."

Q: "How to fix my stop loss discipline?"
-> Reference their specific trades where stops were moved/ignored. Give the sticky note method: "Write your stop on a Post-it before entering. If you can't define the exit, you can't take the trade."

Q: "Am I overtrading?"
-> Reference their trade count vs win rate correlation. "Your win rate drops from 62% (first 5 trades) to 28% (trades 6+). After trade 5, you're basically donating to the market."

Q: "Best time to stop trading today?"
-> Reference their time-of-day performance. "Your data says 78% of your profits come before 10:30 AM. After that, you're playing a different game."

Q: "How to handle a losing streak?"
-> Acknowledge the emotional weight, then give a concrete rule: "After 3 consecutive losses, half your position size. After 5, close the terminal. Your data shows losses compound because you size UP when you should size DOWN."

Q: Greetings (hi/hello/hey)
-> Respond warmly based on their recent data: "Hey! I see your last session was a tough one — ₹1,200 down, mostly from that afternoon revenge cycle. Want to talk about what happened, or plan tomorrow's rules?"

=== COMMUNITY INSIGHTS (use naturally, not as a list) ===
Weave these in when relevant:
- Traders who wait 5 min before re-entry after a loss see win rates jump from 28% to 44%
- Setting a hard 3-trade loss limit per day reduces weekly drawdowns by 34%
- Half-sizing after 2 consecutive losses preserves 62% more capital
- Morning-only trading (9:15-10:30) produces 73% of profits for intraday traders
- Traders who write their exit price BEFORE entering have 2.1x better risk:reward

=== HARD RULES ===
- NEVER predict markets, recommend stocks, or give buy/sell signals
- Focus on PROCESS over OUTCOME — a losing trade with good process > winning trade with bad process
- Use INR currency and Indian market context (NIFTY, BANKNIFTY, Sensex, VIX India)
- Acknowledge emotions without judgment — shame doesn't fix patterns, awareness does
- Reference the 10-stage Vicious Cycle when their data shows it
- If question is NOT about trading/psychology, gently redirect: "That's outside my zone, yaar. But tell me — how did today's session go?"
- NEVER give generic advice. If you can't make it specific to their data, ask them for more context instead.`

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rl = rateLimit(`chat:${clerkId}`, 30, 60 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const { data: planData } = await supabaseAdmin
      .from('user_plans')
      .select('plan')
      .eq('user_id', clerkId)
      .single()

    const plan = planData?.plan || 'free'
    const isPro = ['pro_monthly', 'pro_yearly'].includes(plan)

    if (!isPro) {
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

    const { data: sessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('trade_date, detected_market, trade_count, net_pnl, win_count, loss_count, win_rate, profit_factor, analysis')
      .eq('user_id', clerkId)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: journey } = await supabaseAdmin
      .from('user_journeys')
      .select('*')
      .eq('user_id', clerkId)
      .single()

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any)?.status
    if (status === 529 || /overload/i.test(errMessage)) {
      return NextResponse.json(
        { error: 'Saathi is busy right now. Try again in a moment.' },
        { status: 503 }
      )
    }
    if (status === 429 || /rate[_ ]?limit/i.test(errMessage)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: 'Saathi couldn\u2019t respond. Please try again.' },
      { status: 500 }
    )
  }
}
