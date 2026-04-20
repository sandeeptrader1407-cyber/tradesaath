import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { computeKPIs } from '@/lib/kpi/computeKPIs'

export const maxDuration = 60

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

interface TradeRow {
  pnl?: number
  tag?: string
  symbol?: string
  side?: string
}

interface SessionRow {
  id: string
  created_at: string
  trade_date: string | null
  trade_count: number | null
  net_pnl: number | null
  win_rate: number | null
  win_count: number | null
  loss_count: number | null
  best_trade: number | null
  worst_trade: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trades: any
}

function parseTrades(raw: unknown): TradeRow[] {
  if (!raw) return []
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as TradeRow[]
    if (Array.isArray(raw)) return raw as TradeRow[]
  } catch {
    return []
  }
  return []
}

function fmtINR(n: number): string {
  const sign = n >= 0 ? '+' : '-'
  return `${sign}\u20B9${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return 'unknown date'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildDataSummary(sessions: SessionRow[]): string {
  if (!sessions.length) return ''

  const sorted = [...sessions].sort((a, b) => {
    const da = a.trade_date || a.created_at
    const db = b.trade_date || b.created_at
    return new Date(da).getTime() - new Date(db).getTime()
  })

  // Use single-source-of-truth KPIs
  const kpis = computeKPIs(sorted.map(x => ({
    net_pnl: x.net_pnl,
    trade_count: x.trade_count,
    win_count: x.win_count,
    loss_count: x.loss_count,
    win_rate: x.win_rate,
    trade_date: x.trade_date,
  })))
  const totalSessions = sorted.length
  const totalTrades = kpis.totalTrades
  const totalPnl = kpis.totalPnl
  const totalWins = kpis.totalWins
  const totalLosses = kpis.totalLosses
  const overallWinRate = Math.round(kpis.winRate)

  const firstSession = sorted[0]
  const latestSession = sorted[sorted.length - 1]
  const firstDate = fmtDate(firstSession.trade_date || firstSession.created_at)
  const latestDate = fmtDate(latestSession.trade_date || latestSession.created_at)

  const byPnl = [...sorted].sort((a, b) => (b.net_pnl || 0) - (a.net_pnl || 0))
  const bestDay = byPnl[0]
  const worstDay = byPnl[byPnl.length - 1]

  let curWin = 0, curLoss = 0, longestWin = 0, longestLoss = 0
  for (const s of sorted) {
    if ((s.net_pnl || 0) > 0) { curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin) }
    else if ((s.net_pnl || 0) < 0) { curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss) }
    else { curWin = 0; curLoss = 0 }
  }
  // Exact max drawdown from single source of truth (positive number)
  const maxDrawdown = -Math.abs(kpis.maxDrawdown)

  const half = Math.floor(sorted.length / 2)
  let trajectory = 'steady'
  if (sorted.length >= 4) {
    const firstHalfAvg = sorted.slice(0, half).reduce((s, x) => s + (x.net_pnl || 0), 0) / Math.max(1, half)
    const secondHalfAvg = sorted.slice(half).reduce((s, x) => s + (x.net_pnl || 0), 0) / Math.max(1, sorted.length - half)
    if (secondHalfAvg > firstHalfAvg + 100) trajectory = 'improving'
    else if (secondHalfAvg < firstHalfAvg - 100) trajectory = 'declining'
  }

  const tagCounts: Record<string, number> = {}
  const symbolCounts: Record<string, number> = {}
  let firstSymbol = ''
  for (const s of sorted) {
    const trades = parseTrades(s.trades)
    for (const t of trades) {
      const tag = (t.tag || '').toLowerCase().trim()
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1
      const sym = (t.symbol || '').trim()
      if (sym) {
        symbolCounts[sym] = (symbolCounts[sym] || 0) + 1
        if (!firstSymbol && s.id === firstSession.id) firstSymbol = sym
      }
    }
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([tag, n]) => `${tag} (${n} trades)`).join(', ') || 'no tagged patterns yet'
  const topSymbols = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([sym]) => sym).join(', ') || 'mixed instruments'

  return `REAL TRADING DATA — Use EXACTLY these numbers. Do not calculate your own. Do not round to thousands or lakhs. Do not estimate:
- First trading session: ${firstDate}${firstSymbol ? ` (first traded: ${firstSymbol})` : ''}
- Most recent session: ${latestDate}
- Total trading days logged: ${totalSessions}
- Total trades executed: ${totalTrades}
- Total Net P&L (cumulative sum of daily P&Ls): ${fmtINR(totalPnl)}
- Overall win rate: ${overallWinRate}% (${totalWins} wins, ${totalLosses} losses)
- Best day: ${fmtINR(bestDay.net_pnl || 0)} on ${fmtDate(bestDay.trade_date || bestDay.created_at)}
- Worst day: ${fmtINR(worstDay.net_pnl || 0)} on ${fmtDate(worstDay.trade_date || worstDay.created_at)}
- Longest winning streak: ${longestWin} days
- Longest losing streak: ${longestLoss} days
- Maximum Drawdown from peak (largest fall from a running high — a SEPARATE number from Total P&L): ${fmtINR(maxDrawdown)}
- Most traded instruments: ${topSymbols}
- Behavioral patterns: ${topTags}
- Recent trajectory: ${trajectory}

CRITICAL DISAMBIGUATION: "Total Net P&L" and "Maximum Drawdown" are DIFFERENT numbers with DIFFERENT meanings. Total P&L is the sum of all daily P&Ls. Max Drawdown is the worst peak-to-trough equity fall. If you mention the drawdown, use the Maximum Drawdown line above — NEVER substitute Total P&L for drawdown.`
}

export async function POST(request: Request) {
  if (process.env.DISABLE_AI_ANALYSIS === 'true') {
    return NextResponse.json({ error: 'AI analysis temporarily unavailable', code: 'AI_DISABLED' }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const rl = await rateLimit(`journey-story:${userId}`, 5, 60 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await request.json().catch(() => ({}))
    const {
      step1Beginning = '',
      step2DarkDays = '',
      step3Shift = '',
      step4Today = '',
      step5Truth = '',
    } = (body || {}) as Record<string, string>

    const { data: sessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('id, created_at, trade_date, trade_count, net_pnl, win_rate, win_count, loss_count, best_trade, worst_trade, trades')
      .eq('user_id', userId)
      .order('trade_date', { ascending: false, nullsFirst: false })
      .limit(200)

    const sessionRows = (sessions || []) as SessionRow[]

    if (sessionRows.length === 0) {
      return NextResponse.json({
        error: 'Upload your first session to generate your story',
        empty: true,
      }, { status: 400 })
    }

    const dataSummary = buildDataSummary(sessionRows)
    const hasNarrative = !!(step1Beginning || step2DarkDays || step3Shift || step4Today || step5Truth)

    const narrativeBlock = hasNarrative
      ? `THE TRADER'S OWN WORDS (weave these in naturally where they fit the data):
1. THE BEGINNING: ${step1Beginning || '(not shared)'}
2. THE DARK DAYS: ${step2DarkDays || '(not shared)'}
3. THE SHIFT: ${step3Shift || '(not shared)'}
4. TODAY: ${step4Today || '(not shared)'}
5. YOUR TRUTH: ${step5Truth || '(not shared)'}`
      : `NO PERSONAL NARRATIVE PROVIDED. Build the entire story from the data above. Make it feel personal by interpreting the patterns — what the streaks, drawdowns, and patterns reveal about this trader's mindset.`

    const prompt = `Write a cinematic, motivating trading journey story in second person ("You...") based on this trader's REAL trading data. Be honest about struggles but celebrate growth.

ABSOLUTE RULE: You MUST ONLY reference facts derivable from the trading data provided below or from THE TRADER'S OWN WORDS. NEVER invent or assume: the trader's age, education, year they started, location, early life, devices used (phone/laptop/desktop), jobs, family members, relationships, or any biographical detail not explicitly given. If you don't know something, don't mention it — write around it.

FORBIDDEN EXAMPLES — do NOT write sentences like any of these (they are fabricated context):
- "Back in 2016, you were just a student staring at charts on your phone"
- "Your phone-only trading days"
- "As a college student with borrowed capital"
- "Fresh out of school"
- "When you first quit your job to trade"
- "In those early days on your parents' laptop"
- Any year reference (2016, 2018, 2020, etc.) that is NOT present in the trading data dates below
- Any mention of school, college, university, student, job, office, parents, family, hometown, city, village
- Any device mention (phone, mobile, laptop, desktop) unless the trader wrote about it

If the first trading session is "12 March 2024", you may say "your journey began in March 2024" — you may NOT say "back in 2024 as a fresh trader" or add any context around who the trader was then.

ABSOLUTE RULE: Use the EXACT numbers provided. Do not round ₹1,72,523 to "₹1.7L" or "₹1,72,000". Do not calculate your own drawdown, win rate, or P&L — use the values in the data block verbatim.

${dataSummary}

${narrativeBlock}

STRUCTURE (use these as internal beats — do NOT print headers):
1. THE BEGINNING — when they started, what they first traded
2. THE STRUGGLES — worst day, longest losing streak, max drawdown
3. THE TURNING POINT — what the patterns reveal (or what they said in "The Shift")
4. TODAY — current trajectory, recent performance, what's working
5. THE TRUTH — a powerful, personal closing line tied to their data and trajectory

WRITING RULES:
- 300-400 words, single flowing narrative (no section headers, no bullet points)
- Reference SPECIFIC numbers: dates, P&L amounts, streaks, win rate, instruments
- Be honest about losses — don't sugarcoat. Max drawdown and worst day are real moments worth naming.
- Celebrate growth and self-awareness
- Use occasional Hindi words naturally if they fit ("safar", "himmat", "seekh", "sabr")
- Make it feel like the opening of a movie about their trading life
- Make it shareable — punchy, emotional, true
- NO generic motivational quotes. Every line must be PERSONAL to THIS trader's data.
- NEVER invent biographical details. Do not mention jobs, family members, cities, age, education, or any life context not given in THE TRADER'S OWN WORDS or derivable from the trading sessions above. Only reference data from the trading sessions provided and any narrative the trader wrote.

Return ONLY the story text. No JSON, no markdown headers, no backticks. Just the prose.`

    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawStory = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    // Post-generation sanitizer: strip any sentence that contains fabricated biographical keywords
    // that are NOT derivable from the trading data. This is a hard safety net for when the model
    // ignores the ABSOLUTE RULE in the prompt.
    const allowedNarrative = (
      (step1Beginning || '') + ' ' + (step2DarkDays || '') + ' ' +
      (step3Shift || '') + ' ' + (step4Today || '') + ' ' + (step5Truth || '')
    ).toLowerCase()

    const BANNED_WORDS: string[] = [
      'student', 'college', 'university', 'school',
      'phone-only', 'phone only', 'your phone', 'mobile phone', 'on your laptop',
      'your parents', "parents'", 'your family', 'family members',
      'childhood', 'grew up', 'hometown', 'village', 'small town',
      'fresh out of', 'quit your job', 'your job', 'your office', 'day job',
      'in school', 'in college', 'after school', 'after college',
    ]

    // Build allowed year set from actual trading data
    const allowedYears = new Set<string>()
    let earliestYear = 9999
    for (const s of sessionRows) {
      const d = s.trade_date || s.created_at
      if (d) {
        const yr = String(d).slice(0, 4)
        if (/^\d{4}$/.test(yr)) {
          allowedYears.add(yr)
          const n = Number(yr)
          if (n < earliestYear) earliestYear = n
        }
      }
    }

    const splitSentences = (text: string): string[] => {
      // Split on sentence boundaries AND on newlines so a paragraph with no periods still splits
      return text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean)
    }

    const sentenceIsSafe = (sentence: string): boolean => {
      const lower = sentence.toLowerCase()
      for (const word of BANNED_WORDS) {
        if (lower.includes(word) && !allowedNarrative.includes(word)) return false
      }
      // Flag any 4-digit year that's not in the actual trade data
      const years = sentence.match(/\b(19|20)\d{2}\b/g) || []
      for (const yr of years) {
        if (!allowedYears.has(yr) && !allowedNarrative.includes(yr)) return false
        // Extra guard: any year before the earliest trade year is banned
        if (Number(yr) < earliestYear) return false
      }
      return true
    }

    let story = splitSentences(rawStory).filter(sentenceIsSafe).join(' ').trim()
    // If the sanitizer stripped everything (model went fully off the rails), return a deterministic
    // data-only fallback rather than leaking the unsanitized story.
    if (!story || story.length < 60) {
      story = dataSummary ? `Your journey so far:\n\n${dataSummary}` : 'Upload more sessions to see your story.'
    }

    await supabaseAdmin
      .from('user_journeys')
      .upsert(
        {
          user_id: userId,
          generated_story: story,
          story_generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({ story })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Story generation failed'
    console.error('Journey story error:', msg)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any)?.status
    if (status === 529 || /overload/i.test(msg)) {
      return NextResponse.json(
        { error: 'Our AI is busy right now. Please try again in a minute.' },
        { status: 503 }
      )
    }
    if (status === 429 || /rate[_ ]?limit/i.test(msg)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: 'Story generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
