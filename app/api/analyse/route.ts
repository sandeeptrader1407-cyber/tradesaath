import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Lazy client — only created when actually needed (prevents crash if key is missing at import time)
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Please add it to your Vercel deployment settings.')
  }
  return new Anthropic({ apiKey })
}

const SYSTEM_PROMPT = `You are TradeSaath, an expert AI trading psychology coach specializing in Indian F&O options (Nifty, BankNifty) and all global markets. You analyze trades with deep empathy and give brutally specific coaching.

You detect these patterns:
- FOMO: re-entry within 2 min of a loss, chasing after missing a move
- Revenge trading: increased position size after a loss, doubling down emotionally
- Averaging down: adding to losing positions hoping for reversal
- Panic exit: selling at the day's worst price, premature exit on a winning trade
- Against-trend entry: buying when price is clearly falling, selling when clearly rising
- Overtrading: too many trades in a short window, diminishing returns per trade
- Size escalation: increasing lot size as losses mount
- Discipline break: abandoning stop-loss rules, moving or removing stops

Reference exact times, amounts, rupee values, and patterns between consecutive trades. Be specific — say "Trade #3 at 10:36 was entered just 35 minutes after Trade #2's ₹1,125 loss" not "you traded again quickly after a loss."

For the DQS (Decision Quality Score, 0-100):
- 80-100: Excellent discipline, rules followed, good sizing
- 60-79: Decent but with some emotional decisions
- 40-59: Multiple discipline breaks, patterns forming
- 20-39: Significant emotional trading, revenge/FOMO dominant
- 0-19: Complete discipline breakdown

Return ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.`

const USER_PROMPT_TEMPLATE = (trades: string, context: string) => `Analyze these trades and return ONLY valid JSON:

TRADES:
${trades}

TRADING CONTEXT:
${context}

Return this exact JSON structure:
{
  "summary": "2-3 sentence brutally honest session summary mentioning specific trades, amounts, and patterns",
  "dqsScore": <number 0-100>,
  "dqsFactors": [
    { "name": "Entry Timing", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Risk Management", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Position Sizing", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Emotional Control", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Exit Discipline", "score": <0-100>, "color": "green|blue|orange|red" }
  ],
  "perTrade": [
    {
      "tradeIndex": <0-based index>,
      "tag": "CLEAN|FOMO|REVENGE|PANIC_EXIT|AVERAGING|OVERTRADING|AGAINST_TREND|DISCIPLINE_BREAK",
      "tagColor": "green|blue|orange|red|purple|gold",
      "label": "short human label like 'Clean Entry' or 'Revenge Size-Up'",
      "quickSummary": "1-2 sentence trade summary with specific prices and times",
      "psychologyNote": "2-3 sentences of psychology coaching specific to this trade",
      "technicalNote": "1-2 sentences about entry/exit quality from a technical perspective",
      "counterfactual": "What would have happened if the trader followed rules — specific rupee amounts",
      "sessionBadge": "MORNING|MIDDAY|AFTERNOON|CLOSING",
      "timeGap": <minutes since previous trade, 0 for first>,
      "timeGapColor": "green|orange|red"
    }
  ],
  "patterns": [
    {
      "name": "Pattern name",
      "icon": "emoji",
      "description": "Specific description referencing trade numbers and amounts",
      "costInRupees": <negative number>,
      "frequency": "<number>x today"
    }
  ],
  "financialImpact": {
    "totalLost": <negative number — money lost to emotional decisions>,
    "potentialPnl": <what P&L would have been with perfect discipline>,
    "message": "Specific message about the gap between actual and potential"
  },
  "rulesForNextSession": [
    "Specific actionable rule referencing today's patterns — e.g. 'After 2 consecutive losses, take a 15-minute break before next trade'",
    "Another specific rule",
    "Another specific rule"
  ],
  "bestCase": "If you follow all rules next session: specific projected outcome",
  "worstCase": "If you abandon rules: specific projected worst case"
}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trades, context } = body

    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({ error: 'No trades provided' }, { status: 400 })
    }

    const tradesStr = JSON.stringify(trades, null, 2)
    const contextStr = context ? JSON.stringify(context, null, 2) : 'No additional context provided'

    let analysis = null
    let attempts = 0
    let lastRawText = ''

    while (attempts < 2 && !analysis) {
      attempts++
      try {
        const client = getClient()
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: USER_PROMPT_TEMPLATE(tradesStr, contextStr) },
          ],
        })

        console.log(`🤖 Anthropic API response — model: ${message.model}, stop_reason: ${message.stop_reason}, usage: ${JSON.stringify(message.usage)}`)

        const text = message.content[0].type === 'text' ? message.content[0].text : ''
        lastRawText = text

        // Try to extract JSON — handle potential markdown wrapping
        let jsonStr = text.trim()
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        analysis = JSON.parse(jsonStr)
      } catch (parseErr: unknown) {
        console.error(`Attempt ${attempts} failed:`, parseErr instanceof Error ? parseErr.message : String(parseErr))
        console.error('Raw response (first 500 chars):', lastRawText.substring(0, 500))

        // If it's an API error (not a JSON parse error), don't retry — surface it immediately
        if (parseErr instanceof Error && !(parseErr instanceof SyntaxError)) {
          // Extract clean message from Anthropic SDK error
          let errMsg = parseErr.message || 'Anthropic API error'
          try {
            const parsed = JSON.parse(errMsg.replace(/^\d+\s*/, ''))
            if (parsed?.error?.message) errMsg = parsed.error.message
          } catch { /* use raw message */ }
          return NextResponse.json({ error: errMsg }, { status: 502 })
        }

        if (attempts >= 2) {
          return NextResponse.json(
            { error: 'AI analysis failed — could not parse response. Please try again.' },
            { status: 500 }
          )
        }
        // Retry only for JSON parse errors
      }
    }

    return NextResponse.json({ analysis })
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : 'Analysis failed'
    console.error('Analysis error:', errMessage)

    // Provide user-friendly error messages
    if (errMessage.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({ error: errMessage }, { status: 500 })
    }
    if (errMessage.includes('authentication') || errMessage.includes('401')) {
      return NextResponse.json({ error: 'AI service authentication failed. Please check the API key configuration.' }, { status: 502 })
    }
    if (errMessage.includes('rate') || errMessage.includes('429')) {
      return NextResponse.json({ error: 'AI service is temporarily busy. Please try again in a moment.' }, { status: 429 })
    }
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
