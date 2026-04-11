import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

const SYSTEM_PROMPT = `You are TradeSaath Saathi — the trader's personal psychology coach and improvement planner for Indian options/futures traders.

Generate an actionable coaching plan based on the trader's REAL data. Every recommendation must reference specific numbers from their trading history.

TONE: Direct, empathetic, data-driven. Use exact ₹ amounts, percentages, and trade counts. No generic advice.

Each action item must have a tag:
- STOP (red) — things to stop doing immediately
- DO (green) — things to start or continue doing
- PRACTICE (blue) — things to practice/rehearse

Return ONLY valid JSON. No markdown, no backticks.`

const PLAN_TEMPLATES: Record<string, string> = {
  daily: `Generate a DAILY coaching plan with these sections:
1. "psychological" — 3 action items for today's mindset (based on recent patterns)
2. "technical" — 3 action items for trading execution today
3. "rules" — 3 hard rules for today (print-worthy, with exact thresholds from data)

JSON format:
{
  "title": "Daily Plan — [Today's date]",
  "subtitle": "Based on your last [N] sessions",
  "sections": [
    {
      "title": "Psychological Goals — Today",
      "subtitle": "Based on your last N sessions",
      "icon": "brain",
      "items": [{ "tag": "STOP|DO|PRACTICE", "text": "Specific action referencing data" }]
    },
    { "title": "Technical Goals — Today", "subtitle": "Strategy refinement", "icon": "chart", "items": [...] },
    { "title": "Today's Rules (Print This)", "subtitle": "3 rules. No exceptions.", "icon": "rules", "items": [...] }
  ]
}`,

  weekly: `Generate a WEEKLY coaching plan with these sections:
1. "focus" — 4 key focus areas for this week with data-driven thresholds
2. "tradingPlan" — Entry rules, Size rules, Exit rules, Mental rules
3. "scenarios" — Best case, Likely case, Worst case with ₹ estimates
4. "review" — Friday review checklist (5 items)

JSON format:
{
  "title": "Weekly Focus — [Date range]",
  "subtitle": "Based on your last [N] sessions · [X] total trades",
  "sections": [
    { "title": "Weekly Focus Areas", "icon": "chart", "items": [{ "tag": "DO|STOP|PRACTICE", "text": "..." }] },
    { "title": "Your Trading Plan This Week", "icon": "plan", "content": "Formatted text with ENTRY RULES, SIZE RULES, EXIT RULES, MENTAL RULES" },
    { "title": "Scenario Planning", "icon": "crystal", "scenarios": [
      { "type": "best", "text": "..." },
      { "type": "likely", "text": "..." },
      { "type": "worst", "text": "..." }
    ]},
    { "title": "Friday Review Checklist", "icon": "review", "items": [{ "tag": "DO", "text": "..." }] }
  ]
}`,

  monthly: `Generate a MONTHLY coaching plan with:
1. "targets" — 5 measurable monthly targets with current → goal values
2. "zones" — Performance zones (RED/YELLOW/GREEN criteria)
3. "milestones" — Week 1-4 milestone checkpoints

JSON format:
{
  "title": "Monthly Targets — [Month Year]",
  "subtitle": "Measurable goals based on your current performance",
  "sections": [
    { "title": "Monthly Targets", "icon": "target", "items": [{ "tag": "DO", "text": "Win rate: X% → Y% — explanation" }] },
    { "title": "Performance Zones", "icon": "zones", "zones": [
      { "name": "RED ZONE", "color": "red", "criteria": "WR < 35%, RR < 0.8x, ..." },
      { "name": "YELLOW ZONE", "color": "gold", "criteria": "..." },
      { "name": "GREEN ZONE", "color": "green", "criteria": "..." }
    ], "current": "RED|YELLOW|GREEN" },
    { "title": "Monthly Milestones", "icon": "milestones", "items": [{ "tag": "DO", "text": "Week 1: ..." }] }
  ]
}`,

  quarterly: `Generate a QUARTERLY coaching plan with:
1. "transformation" — 3 major quarterly transformation goals
2. "monthlyBreakdown" — Month 1, 2, 3 focus areas
3. "longTermVision" — Where they'll be if they follow the plan

JSON format:
{
  "title": "Quarterly Plan — [Quarter]",
  "subtitle": "Your 90-day transformation roadmap",
  "sections": [
    { "title": "90-Day Transformation Goals", "icon": "rocket", "items": [{ "tag": "DO", "text": "..." }] },
    { "title": "Monthly Breakdown", "icon": "calendar", "items": [
      { "tag": "DO", "text": "Month 1: ..." },
      { "tag": "DO", "text": "Month 2: ..." },
      { "tag": "DO", "text": "Month 3: ..." }
    ]},
    { "title": "Long-Term Vision", "icon": "vision", "content": "If you follow this plan..." }
  ]
}`
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { tab } = body as { tab: string }

    if (!tab || !PLAN_TEMPLATES[tab]) {
      return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
    }

    // Fetch user's sessions from trade_sessions (where saveTradeSession writes)
    const { data: rawSessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('id, created_at, trade_count, net_pnl, win_rate, trades, analysis')
      .eq('user_id', clerkId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!rawSessions || rawSessions.length === 0) {
      return NextResponse.json({ error: 'No sessions found. Upload trades first.' }, { status: 404 })
    }

    // Map fields for consistent access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = rawSessions.map((s: any) => ({
      ...s,
      total_pnl: s.net_pnl || 0,
      dqs_score: s.analysis?.dqs?.score || s.analysis?.dqsScore || 0,
    }))

    // Build data summary for Claude
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalTrades = sessions.reduce((s: number, sess: any) => s + (sess.trade_count || 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalPnl = sessions.reduce((s: number, sess: any) => s + (sess.total_pnl || 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avgWr = sessions.reduce((s: number, sess: any) => s + (sess.win_rate || 0), 0) / sessions.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avgDqs = sessions.reduce((s: number, sess: any) => s + (sess.dqs_score || 0), 0) / sessions.length

    // Aggregate patterns
    const tags: Record<string, number> = {}
    const costs: Record<string, number> = {}
    for (const sess of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analysis = (sess as any).analysis as { perTrade?: { tag: string }[]; patterns?: { name: string; costInRupees: number }[] } | null
      if (analysis?.perTrade) {
        for (const pt of analysis.perTrade) {
          tags[pt.tag] = (tags[pt.tag] || 0) + 1
        }
      }
      if (analysis?.patterns) {
        for (const p of analysis.patterns) {
          costs[p.name] = (costs[p.name] || 0) + (p.costInRupees || 0)
        }
      }
    }

    const dataSummary = `TRADER DATA SUMMARY:
- Sessions: ${sessions.length} (last ${sessions.length} sessions)
- Total trades: ${totalTrades}
- Net P&L: ₹${totalPnl.toLocaleString('en-IN')}
- Average Win Rate: ${Math.round(avgWr)}%
- Average DQS: ${Math.round(avgDqs)}/100
- Trade patterns: ${Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}x`).join(', ')}
- Mistake costs: ${Object.entries(costs).sort((a, b) => a[1] - b[1]).map(([n, c]) => `${n}: ₹${c.toLocaleString('en-IN')}`).join(', ')}
- Last session: ${new Date(sessions[0].created_at).toLocaleDateString('en-IN')} — P&L ₹${(sessions[0].total_pnl || 0).toLocaleString('en-IN')}, WR ${sessions[0].win_rate || 0}%, DQS ${sessions[0].dqs_score || 0}`

    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${dataSummary}\n\n${PLAN_TEMPLATES[tab]}`
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const plan = JSON.parse(jsonStr)
    return NextResponse.json({ plan })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Coach generation failed'
    console.error('Coach error:', msg)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI coaching plan could not be generated. Try again.' }, { status: 500 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
