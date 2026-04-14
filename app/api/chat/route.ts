import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { computeKPIs } from '@/lib/kpi/computeKPIs'

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
- Conversational — use natural language, occasional Hindi/trading slang
- Specific — ALWAYS reference the trader's actual data when available
- Insightful — connect dots the trader hasn't seen
- Empathetic — acknowledge emotions without judgment

=== HOW TO RESPOND ===
- ALWAYS answer the user's question DIRECTLY first. If they ask about their P&L, give the number. If they ask about win rate, give the percentage. If they ask "am I overtrading", start with a yes/no. THEN add coaching context.
- Keep responses concise: 2-3 short paragraphs max. This is a chat, not an essay.
- Always end with ONE specific, actionable tip tied to their data.
- Bold **key insights** and **numbers** for scannability.
- Use their actual P&L, win rates, and patterns from the session data below.

=== HARD RULES ===
- NEVER predict markets, recommend stocks, or give buy/sell signals
- Focus on PROCESS over OUTCOME
- ALWAYS write currency as ₹ symbol (never "INR", never "Rs"). Example: ₹1,72,523.95
- Use Indian market context (NIFTY, BANKNIFTY, Sensex, VIX India)
- Acknowledge emotions without judgment
- If question is NOT about trading/psychology, gently redirect
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
      .limit(500)

    const { data: journey } = await supabaseAdmin
      .from('user_journeys')
      .select('*')
      .eq('user_id', clerkId)
      .single()

    const allTimeKpis = sessions && sessions.length > 0
      ? computeKPIs(sessions.map(s => ({
          net_pnl: Number(s.net_pnl) || 0,
          win_rate: Number(s.win_rate) || 0,
          trade_count: Number(s.trade_count) || 0,
          win_count: Number(s.win_count) || 0,
          loss_count: Number(s.loss_count) || 0,
        })))
      : null

    const recent10 = (sessions || []).slice(0, 10)
    const sessionSummary = recent10.length > 0
      ? recent10.map(s =>
          `${s.trade_date || 'Unknown'}: ${s.detected_market || 'Market'} | ${s.trade_count} trades | P&L: ₹${s.net_pnl} | WR: ${s.win_rate}% | PF: ${s.profit_factor}`
        ).join('\n')
      : 'No sessions uploaded yet'

    const allTimeLine = allTimeKpis
      ? `ALL-TIME TOTALS (across ${allTimeKpis.totalSessions} sessions): Net P&L ₹${allTimeKpis.totalPnl}, ${allTimeKpis.totalTrades} trades, WR ${allTimeKpis.winRate}%, Profit Factor ${allTimeKpis.profitFactor}, Best Day ₹${allTimeKpis.bestSessionPnl}, Worst Day ₹${allTimeKpis.worstSessionPnl}`
      : 'No all-time data yet'

    const journeyContext = journey
      ? `Experience: ${journey.experience || 'Not set'}, Instruments: ${journey.instruments || 'Not set'}, Challenge: ${journey.challenge || 'Not set'}, Goal: ${journey.goal || 'Not set'}`
      : 'No journey profile set'

    const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}

=== THIS TRADER'S DATA ===

${allTimeLine}

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
      { error: 'Saathi could not respond. Please try again.' },
      { status: 500 }
    )
  }
}
