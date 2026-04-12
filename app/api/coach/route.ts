import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

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
  tomorrow: `Generate a TOMORROW'S PLAN — the trader's pre-market preparation sheet. This should be print-worthy and specific.

Sections:
1. "psychology" — 3 items: STOP/DO/PRACTICE for tomorrow's mindset. Reference their recent patterns. Use IF-THEN rules: "IF you feel the urge to revenge trade, THEN close terminal for 10 min."
2. "technical" — 3 items: specific technical execution rules for tomorrow based on their recent entries/exits. Reference exact price levels, time windows, or position sizing rules.
3. "rules" — 3 hard rules to print and stick on the monitor. Each rule must have a TRIGGER (what situation), ACTION (what to do), and COST OF BREAKING (₹ amount from their data).

JSON format:
{
  "title": "Tomorrow's Plan",
  "subtitle": "Based on your last [N] sessions · Print this and keep it next to your screen",
  "sections": [
    {
      "title": "Psychology Prep",
      "subtitle": "Your mental game plan for tomorrow",
      "icon": "brain",
      "items": [{ "tag": "STOP|DO|PRACTICE", "text": "IF-THEN rule referencing their data" }]
    },
    { "title": "Technical Rules", "subtitle": "Entry, exit, and sizing discipline", "icon": "chart", "items": [{ "tag": "STOP|DO|PRACTICE", "text": "..." }] },
    { "title": "Tomorrow's 3 Rules (Print This)", "subtitle": "Stick this on your monitor. No exceptions.", "icon": "rules", "items": [{ "tag": "DO", "text": "TRIGGER: [situation] → ACTION: [what to do] → COST OF BREAKING: ₹[amount]" }] }
  ]
}`,

  thisweek: `Generate a THIS WEEK focus plan. Identify the ONE worst pattern to fix this week and build the entire plan around it.

Sections:
1. "focus" — The single biggest pattern to fix this week, with its total cost and a specific improvement plan. Include 3-4 action items.
2. "scenarios" — Best/Likely/Worst case P&L scenarios for the week based on their historical data. Be specific with ₹ amounts.
3. "checklist" — 5-item weekly goals checklist. Each item should be measurable: "Keep revenge trades to 0 this week (last week: 4)"

JSON format:
{
  "title": "This Week's Focus",
  "subtitle": "Based on your last [N] sessions · [X] total trades",
  "sections": [
    { "title": "This Week: Fix [Pattern Name]", "subtitle": "This pattern has cost you ₹[X] — time to break it", "icon": "target", "items": [{ "tag": "STOP|DO|PRACTICE", "text": "..." }] },
    { "title": "Scenario Planning", "icon": "crystal", "scenarios": [
      { "type": "best", "text": "If you follow ALL rules: estimated P&L +₹X based on your clean trades" },
      { "type": "likely", "text": "If you slip 1-2 times: estimated P&L ₹X" },
      { "type": "worst", "text": "If old patterns take over: estimated P&L -₹X" }
    ]},
    { "title": "Weekly Goals Checklist", "subtitle": "Review Friday evening", "icon": "review", "items": [{ "tag": "DO", "text": "Measurable goal with last week comparison" }] }
  ]
}`,

  learning_path: `Generate a LEARNING PATH assessment. Evaluate where this trader is in their psychology journey and what they need to learn next.

The 4 stages of trading psychology mastery:
1. AWARENESS — Trader doesn't yet recognize their patterns. They blame the market, not themselves.
2. UNDERSTANDING — Trader can name their patterns after the fact but can't stop them in real-time.
3. PRACTICE — Trader catches patterns as they happen and sometimes stops them. Has rules but breaks them under pressure.
4. MASTERY — Trader has internalized the rules. Patterns still arise but are managed automatically. Consistent execution.

Sections:
1. "stage" — Which stage this trader is in, with evidence from their data. Include a progress indicator (items with tag DO showing what they've achieved and PRACTICE showing what's next).
2. "skills" — 3 specific psychology/technical skills to develop next, based on their worst patterns. Each skill should have a name, current level, target level, and specific exercises.
3. "concepts" — 3 trading psychology concepts most relevant to their patterns. For each: name, why it's relevant to THEM specifically, and one practical exercise.

JSON format:
{
  "title": "Your Learning Path",
  "subtitle": "Psychology Stage: [STAGE] · Based on [N] sessions",
  "sections": [
    { "title": "Psychology Stage: [AWARENESS|UNDERSTANDING|PRACTICE|MASTERY]", "subtitle": "Evidence from your trading data", "icon": "brain", "items": [{ "tag": "DO|PRACTICE", "text": "..." }] },
    { "title": "Skills to Develop", "subtitle": "Based on your top 3 pattern weaknesses", "icon": "chart", "items": [{ "tag": "PRACTICE", "text": "[Skill]: Current [X] → Target [Y]. Exercise: [specific exercise]" }] },
    { "title": "Concepts to Study", "subtitle": "Psychology concepts matched to YOUR patterns", "icon": "book", "items": [{ "tag": "PRACTICE", "text": "[Concept Name]: Relevant because [link to their data]. Exercise: [specific exercise]" }] }
  ]
}`,

  patterns: `Generate a MY PATTERNS analysis. List every detected behavioral pattern from their trading data with frequency, cost, trend, and comparison to other traders.

Sections:
1. "detected" — All detected patterns, each as an action item. For each pattern include: name, frequency (X out of Y sessions), total cost in ₹, and whether it's IMPROVING or WORSENING compared to their earlier sessions. Tag: STOP for worsening patterns, DO for improving ones, PRACTICE for new/neutral.
2. "chains" — Show how their patterns connect (chain reactions). "Pattern A triggers Pattern B, which leads to Pattern C." Include the combined cost.
3. "comparison" — How their patterns compare to other traders: "X% of traders with your FOMO frequency who implemented [rule] saw Y% improvement in Z weeks."

JSON format:
{
  "title": "Your Trading Patterns",
  "subtitle": "Detected across [N] sessions · [X] total trades",
  "sections": [
    { "title": "Detected Patterns", "subtitle": "Sorted by cost — most expensive first", "icon": "patterns", "items": [{ "tag": "STOP|DO|PRACTICE", "text": "[Pattern]: [X] times in [Y] sessions · Cost: ₹[Z] · Trend: [IMPROVING/WORSENING]" }] },
    { "title": "Pattern Chains", "subtitle": "How one mistake triggers the next", "icon": "chain", "items": [{ "tag": "STOP", "text": "[Pattern A] → [Pattern B] → [Pattern C] · Combined cost: ₹[X]" }] },
    { "title": "How You Compare", "subtitle": "Anonymous insights from the TradeSaath community", "icon": "community", "items": [{ "tag": "DO", "text": "X% of traders with similar patterns improved by doing [specific action]" }] }
  ]
}`,

  monthly_goals: `Generate MONTHLY GOALS with measurable targets and performance zones.

Sections:
1. "goals" — 5 specific, measurable monthly goals. Each goal: current value → target value with explanation. Tag DO for achievable goals, PRACTICE for stretch goals.
2. "zones" — 3 performance zones (RED/YELLOW/GREEN) with specific criteria from their data. Include which zone they're currently in.
3. "progress" — 4 weekly milestones (Week 1-4) to track progress toward monthly goals. Each milestone should be a checkpoint with specific metrics.

JSON format:
{
  "title": "Monthly Goals",
  "subtitle": "Measurable targets based on your current performance",
  "sections": [
    { "title": "Monthly Targets", "subtitle": "5 goals you can measure every day", "icon": "target", "items": [{ "tag": "DO|PRACTICE", "text": "[Metric]: [Current] → [Target] — [Why this matters and how to get there]" }] },
    { "title": "Performance Zones", "icon": "zones", "zones": [
      { "name": "RED ZONE", "color": "red", "criteria": "Specific criteria from their data" },
      { "name": "YELLOW ZONE", "color": "gold", "criteria": "..." },
      { "name": "GREEN ZONE", "color": "green", "criteria": "..." }
    ], "current": "RED|YELLOW|GREEN" },
    { "title": "Weekly Milestones", "subtitle": "Check in every Friday", "icon": "milestones", "items": [{ "tag": "DO", "text": "Week [N]: [Specific checkpoint with metrics]" }] }
  ]
}`
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Rate limit: 10 per user per hour
    const rl = rateLimit(`coach:${clerkId}`, 10, 60 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await req.json()
    const { tab } = body as { tab: string }

    if (!tab || !PLAN_TEMPLATES[tab]) {
      return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
    }

    // Fetch user's sessions from trade_sessions (where saveTradeSession writes)
    const { data: rawSessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('id, created_at, trade_count, net_pnl, win_rate, win_count, loss_count, analysis')
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

