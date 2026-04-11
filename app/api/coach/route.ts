import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

const SYSTEM_PROMPT = `You are TradeSaath Saathi — the trader's personal psychology coach, accountability partner, and improvement planner. You coach Indian options/futures retail traders who struggle with the same patterns: revenge trading, FOMO, overtrading, and poor risk management.

=== YOUR COACHING PHILOSOPHY ===
- Every single recommendation MUST reference the trader's REAL numbers — exact ₹ amounts, win rates, trade counts, dates
- Generic advice like "manage risk better" or "be disciplined" is BANNED. If you can't tie it to their data, don't say it.
- Name their worst patterns by name: "Your revenge trading after losses cost you ₹12,400 across 5 sessions"
- Use IF-THEN rules that are actionable in the moment: "IF you take 2 consecutive losses, THEN close the terminal and set a 15-minute timer on your phone"
- Build on previous sessions — don't repeat the same advice. If they're still revenge trading after 5 sessions, escalate: "We've talked about revenge trading 5 times. It has cost you ₹18,000 total. It's time for a hard rule: after ANY loss > ₹500, you physically leave your desk."
- Use motivational language that resonates with Indian retail traders: "Har loss ek seekh hai, lekin same seekh baar baar? That's not learning, that's paying tuition to the market repeatedly."

=== COACHING TONE ===
- Direct and honest — don't soften bad news. If they're losing money to the same pattern, say it plainly.
- Empathetic — "I know it's hard to stop when you feel you can win it back. Every trader feels this. The difference between profitable traders and the rest? They feel it AND still close the terminal."
- Data-driven — every claim backed by their specific numbers
- Occasionally use Hindi/trading slang naturally: "FOMO ko apna saathi mat banao, discipline ko banao"
- Reference the 10-stage vicious cycle when their data shows it

=== TAG SYSTEM ===
Each action item MUST have exactly one tag:
- STOP (red) — specific behaviors to stop, with the exact cost of continuing: "STOP: Trading after 2 PM — your afternoon trades have a 22% win rate and have cost you ₹8,400 this month"
- DO (green) — specific behaviors to start/continue, with expected impact: "DO: Take only the first 2 setups before 10:30 AM — this window has your 68% win rate"
- PRACTICE (blue) — specific exercises to rehearse, with clear instructions: "PRACTICE: Before every trade, write the exit price on a sticky note. If you can't define the exit, you can't take the trade."

Return ONLY valid JSON. No markdown, no backticks, no extra text.`

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

    // Aggregate patterns from analysis.trade_analyses and legacy fields
    const tags: Record<string, number> = {}
    const costs: Record<string, number> = {}
    const cycleStages: Record<string, number> = {}
    for (const sess of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analysis = (sess as any).analysis as any
      // New format: trade_analyses array
      if (analysis?.trade_analyses) {
        for (const ta of analysis.trade_analyses) {
          if (ta.tag) tags[ta.tag] = (tags[ta.tag] || 0) + 1
          if (ta.cycle_stage) cycleStages[ta.cycle_stage] = (cycleStages[ta.cycle_stage] || 0) + 1
        }
      }
      // Legacy format: perTrade
      if (analysis?.perTrade) {
        for (const pt of analysis.perTrade) {
          tags[pt.tag] = (tags[pt.tag] || 0) + 1
        }
      }
      if (analysis?.mistake_patterns) {
        for (const p of analysis.mistake_patterns) {
          costs[p.name] = (costs[p.name] || 0) + (p.cost || 0)
        }
      }
      if (analysis?.patterns) {
        for (const p of analysis.patterns) {
          costs[p.name] = (costs[p.name] || 0) + (p.costInRupees || 0)
        }
      }
    }

    // Fetch per-trade analysis for recent sessions (richer coaching context)
    const recentSessionIds = sessions.slice(0, 5).map((s: any) => s.id)
    let tradeInsightsSummary = ''
    if (recentSessionIds.length > 0) {
      const { data: tradeAnalyses } = await supabaseAdmin
        .from('trade_analysis')
        .select('session_id, tag, psychology_coaching, cycle_stage, pnl')
        .in('session_id', recentSessionIds)
        .order('trade_index', { ascending: true })

      if (tradeAnalyses && tradeAnalyses.length > 0) {
        // Aggregate from trade_analysis table
        for (const ta of tradeAnalyses) {
          if (ta.tag) tags[ta.tag] = (tags[ta.tag] || 0) + 1
          if (ta.cycle_stage) cycleStages[ta.cycle_stage] = (cycleStages[ta.cycle_stage] || 0) + 1
        }
        // Pick top psychology coaching insights (biggest losses)
        const worstTrades = tradeAnalyses
          .filter((t: any) => t.psychology_coaching && t.pnl < 0)
          .sort((a: any, b: any) => (a.pnl || 0) - (b.pnl || 0))
          .slice(0, 3)
        if (worstTrades.length > 0) {
          tradeInsightsSummary = '\n\nKEY PSYCHOLOGY INSIGHTS FROM RECENT LOSING TRADES:\n' +
            worstTrades.map((t: any) => `- [₹${t.pnl}] ${t.psychology_coaching}`).join('\n')
        }
      }
    }

    const dataSummary = `TRADER DATA SUMMARY:
- Sessions: ${sessions.length} (last ${sessions.length} sessions)
- Total trades: ${totalTrades}
- Net P&L: ₹${totalPnl.toLocaleString('en-IN')}
- Average Win Rate: ${Math.round(avgWr)}%
- Average DQS: ${Math.round(avgDqs)}/100
- Trade patterns: ${Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}x`).join(', ') || 'No patterns yet'}
- Cycle stages: ${Object.entries(cycleStages).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}: ${c}x`).join(', ') || 'No cycle data yet'}
- Mistake costs: ${Object.entries(costs).sort((a, b) => a[1] - b[1]).map(([n, c]) => `${n}: ₹${c.toLocaleString('en-IN')}`).join(', ') || 'No mistake data yet'}
- Last session: ${new Date(sessions[0].created_at).toLocaleDateString('en-IN')} — P&L ₹${(sessions[0].total_pnl || 0).toLocaleString('en-IN')}, WR ${sessions[0].win_rate || 0}%, DQS ${sessions[0].dqs_score || 0}${tradeInsightsSummary}`

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
