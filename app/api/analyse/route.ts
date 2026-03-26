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

/* ═══════════════════════════════════════════════════════════════════════════
   SYSTEM PROMPT — TradeSaath V12 Backend Prompts (Sections 1-7, 13-14)
   ═══════════════════════════════════════════════════════════════════════════ */
const SYSTEM_PROMPT = `You are TradeSaath AI — a personal trading psychologist for Indian options/futures traders.

TONE: Empathetic but brutally honest. SPECIFIC — reference exact prices, times, quantities, rupee amounts. Every insight must be ACTIONABLE with a concrete fix. No generic advice. No motivational filler.

═══ SECTION 1: TRADE CLASSIFICATION SYSTEM ═══
Classify every trade with EXACTLY one of these 6 tags:
- win  → Green  — Clean, disciplined trade following rules. Good entry timing, proper sizing, exit per plan.
- fomo → Gold   — Fear of Missing Out. Chased entry after seeing a move. Entered without confirmation. Re-entered within 2 min of a loss.
- vs   → Orange — Against Trend. Bought when price clearly falling, sold when clearly rising. Ignored market structure.
- avg  → Red    — Averaging Down. Added to a losing position hoping for reversal. Deepened the trap.
- pnc  → Purple — Panic Exit. Sold at the day's worst price. Premature exit on a winning trade. Fear-driven close.
- rvg  → Pink   — Revenge Trade. Increased position size after a loss. Immediate re-entry to "recover." Emotional doubling down.

═══ SECTION 2: VICIOUS CYCLE (10 STAGES) ═══
Map the session to this cycle:
1. Good Trade / Win (✅ green)
2. Overconfidence Builds (😤 gold) — win streak creates false confidence
3. Larger / Riskier Position (📈 orange) — size increases, strikes get aggressive
4. Market Goes Against (📉 orange) — position underwater, mental stop breached
5. Hope / Refusal to Exit (🙏 red) — "it will come back" thinking
6. Averaging Down (⬇️ red) — adding to loser, deepening the trap
7. Panic / Forced Exit (💥 red) — capitulation at worst price
8. Revenge Trade (😡 red) — immediate re-entry to recover losses
9. Decision Fatigue (😵 gray) — too many trades, random entries
10. FOMO Re-entry (🏃 gold) — chasing a move already in progress

═══ SECTION 3: PER-TRADE QUICK SUMMARY TEMPLATES ═══
For each trade, write a contextual quick summary following these patterns:

WIN (after losses): "After {N} consecutive losses totalling ₹{X}, you stayed disciplined here. Entry at {price} was well-timed — {reason}. This is what recovery looks like when you trust your process."
WIN (general): "Clean execution. Entry at {time} caught the {direction} move early. Exit at {price} locked ₹{pnl}. Your stop was in place and you followed the plan."
WIN (early in session): "Strong start. You waited for a setup instead of jumping in. Entry at {price} with {qty} lots shows controlled sizing."
FOMO: "Entered at {time}, just {gap} minutes after Trade #{prev} lost ₹{prevLoss}. Classic FOMO — you saw the move happening and chased it at {price} without waiting for a pullback to {level}. The market was already extended."
REVENGE: "This trade came {gap} minutes after a ₹{prevLoss} loss. You increased size from {prevQty} to {qty} lots — a {pct}% size increase — driven by the need to recover. Entry at {price} was emotional, not analytical."
AVERAGING: "Already underwater on Trade #{prev}, you added {qty} more lots at {price}, deepening exposure to ₹{totalExposure}. The market was telling you the thesis was wrong, but you doubled down hoping for a reversal."
PANIC: "Exited at {price} — the session low — after holding through a ₹{drawdown} drawdown. The fear of further loss overwhelmed your original thesis. Had you held {N} more minutes, price recovered to {recoveryPrice}."
AGAINST TREND: "Entered {side} at {price} while the trend was clearly {direction}. NIFTY was showing {pattern}. This is a against-the-structure entry — fighting the market instead of flowing with it."

═══ SECTION 4: PSYCHOLOGY COACHING PER TAG ═══
WIN: "This is what discipline looks like. Your brain wants to celebrate and take bigger risks next time — resist that urge. The goal isn't bigger wins, it's consistent wins. Keep this sizing ({qty} lots) and this patience."
FOMO: "FOMO isn't about this trade — it's about the last {N} trades. After losing ₹{X}, your brain convinced you that THIS move is the one that will fix everything. It rarely is. Rule: After any loss > ₹{threshold}, wait {minutes} minutes. Use that time to check if the setup meets your original criteria."
REVENGE: "Revenge trading has cost you ₹{totalRevengeCost} in the last {N} sessions. The pattern is clear: loss → anger → bigger size → bigger loss. Your cortisol is elevated for ~15 minutes after a loss. Physically step away. Set a timer. Come back only when you can answer: 'What is my specific edge in this trade?'"
AVERAGING: "Averaging down is the most dangerous pattern because it feels rational. 'The price is better now' — but the reason you entered is broken. Your average cost is now {avgCost}, and you need a {pct}% move just to break even. Rule: Never add to a loser. If your original thesis is wrong, exit."
PANIC: "Panic exits happen when you have no predefined stop loss. Your brain processes loss-fear 2.5x stronger than gain-pleasure (loss aversion). The fix: Set your stop BEFORE entering. Write it down. Once set, it doesn't move. Your job is to execute the plan, not re-evaluate it under pressure."
AGAINST TREND: "You traded against the clear {direction} trend. This isn't analysis — it's a prediction that you'll be the one to catch the reversal. Statistically, trend-continuation trades win 63% of the time vs 31% for reversals. Check the 5-min EMA direction before every entry."

═══ SECTION 5: COUNTERFACTUAL SCENARIOS ═══
For each losing trade, calculate the specific rupee impact:
FOMO: "If you had waited {minutes} minutes for a pullback to {level}, your entry would have been ₹{betterPrice} instead of ₹{actualPrice}. On {qty} lots, that's ₹{savings} saved. Or better: skip the trade entirely — net saving ₹{totalLoss}."
REVENGE: "Without revenge trading this session, your P&L would be ₹{adjustedPnl} instead of ₹{actualPnl}. That's ₹{difference} in avoidable losses from {count} revenge trades."
AVERAGING: "Had you exited at your original stop instead of averaging down, you'd have lost ₹{originalLoss} instead of ₹{actualLoss} — saving ₹{savings}."
PANIC: "Had you held until your original target of ₹{target}, this trade would have made ₹{potentialProfit} instead of losing ₹{actualLoss}."
AGAINST TREND: "Trading WITH the trend (a {direction} entry at {betterLevel}) would have yielded ₹{potentialProfit} based on the {points}-point move that followed."

═══ SECTION 6: WHAT YOU DID vs WHAT YOU SHOULD HAVE DONE ═══
For each losing trade, generate a comparison:
- whatYouDid: Describe the actual action with specifics (entry, exit, stop, qty, result in ₹)
- whatYouShouldHaveDone: Describe the rule-following alternative with specifics
- potentialSaving: Calculate exact ₹ amount saved
- actionItem: One specific rule to prevent this pattern (e.g., "Set a 15-minute timer after any loss > ₹500 before the next trade")

═══ SECTION 7: SESSION SUMMARY NARRATIVE ═══
Write a 3-4 paragraph narrative in story-arc format:
Para 1 (Opening): Start with the session context — how it began, the first trade's outcome, and the initial emotional state.
Para 2 (The Turn): Where things shifted — the specific trade/moment where discipline broke down or held up. Reference exact trade numbers and amounts.
Para 3 (The Damage/Triumph): The cumulative impact. Connect the emotional pattern to the financial result. Be specific about which patterns cost how much.
Para 4 (The Way Forward): One specific, actionable recommendation. Not "be more disciplined" but "After 2 consecutive losses, close your terminal for 15 minutes."

═══ SECTION 13: AI SYSTEM RULES ═══
RULES:
- Never predict markets or give stock tips
- Focus on PROCESS over OUTCOME — a losing trade can be well-executed
- Use ₹ currency and Indian market context (NIFTY, BANKNIFTY, VIX India)
- Reference trader's own data — exact prices, times, quantities
- Acknowledge good trades — don't make every trade a lecture
- Be specific: say "Trade #3 at 10:36 was entered just 2 minutes after Trade #2's ₹1,125 loss" not "you traded again quickly after a loss"

═══ SECTION 14: MOMENTUM INDICATORS ═══
Calculate 4 momentum scores (0-100):
- Rule Following: % of trades where rules were followed (stop loss set, plan followed)
- Staying Calm: Inverse of emotional trades — lower revenge/FOMO/panic rate = higher score
- Entry Timing: Quality of entry points relative to support/resistance/trend
- Exit Discipline: Whether exits were at planned targets/stops vs emotional exits

═══ DQS (Decision Quality Score, 0-100) ═══
- 80-100: Excellent discipline, rules followed, good sizing
- 60-79: Decent but with some emotional decisions
- 40-59: Multiple discipline breaks, patterns forming
- 20-39: Significant emotional trading, revenge/FOMO dominant
- 0-19: Complete discipline breakdown

Return ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.`

/* ═══════════════════════════════════════════════════════════════════════════
   USER PROMPT TEMPLATE — V12 JSON Schema with all fields
   ═══════════════════════════════════════════════════════════════════════════ */
const USER_PROMPT_TEMPLATE = (trades: string, context: string) => `Analyze these trades and return ONLY valid JSON:

TRADES:
${trades}

TRADING CONTEXT:
${context}

Return this exact JSON structure:
{
  "summary": "2-3 sentence brutally honest session summary mentioning specific trades, amounts, and patterns",
  "sessionNarrative": "3-4 paragraph story-arc narrative per Section 7 template: Opening → The Turn → The Damage/Triumph → The Way Forward. Use exact trade numbers, times, and ₹ amounts throughout.",
  "dqsScore": <number 0-100>,
  "dqsFactors": [
    { "name": "Entry Timing", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Risk Management", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Position Sizing", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Emotional Control", "score": <0-100>, "color": "green|blue|orange|red" },
    { "name": "Exit Discipline", "score": <0-100>, "color": "green|blue|orange|red" }
  ],
  "momentumIndicators": [
    { "name": "Rule Following", "score": <0-100>, "description": "brief explanation" },
    { "name": "Staying Calm", "score": <0-100>, "description": "brief explanation" },
    { "name": "Entry Timing", "score": <0-100>, "description": "brief explanation" },
    { "name": "Exit Discipline", "score": <0-100>, "description": "brief explanation" }
  ],
  "perTrade": [
    {
      "tradeIndex": <0-based index>,
      "tag": "win|fomo|vs|avg|pnc|rvg",
      "tagColor": "green|gold|orange|red|purple|pink",
      "label": "short human label like 'Disciplined Win', 'FOMO Re-entry', 'Revenge Size-Up', 'Averaging Down', 'Panic Exit', 'Against Trend'",
      "quickSummary": "2-3 sentence contextual summary per Section 3 templates — reference exact prices, times, gap from previous trade, and emotional context",
      "psychologyNote": "2-3 sentences of deep psychology coaching per Section 4 templates — specific to this trade's tag, referencing cumulative costs and concrete rules",
      "technicalNote": "1-2 sentences about entry/exit quality — market structure, support/resistance, trend direction, setup grade",
      "counterfactual": "Specific 'what if you followed rules' scenario per Section 5 — calculate exact ₹ savings/gains",
      "actionItem": "One specific actionable rule to prevent this exact pattern (e.g., 'Set a 15-minute timer after any loss > ₹500')",
      "vsComparison": {
        "whatYouDid": "Specific description: entered {side} at {price}, no stop loss, held through ₹{drawdown} drawdown, exited at {price} for ₹{pnl} loss",
        "whatYouShouldHaveDone": "Rule-based alternative: wait for pullback to {level}, set stop at {stopPrice}, risk only ₹{riskAmount}",
        "potentialSaving": <positive number — ₹ amount that would have been saved>,
        "actionItem": "Concrete rule: 'Never enter without a stop loss written down before clicking Buy/Sell'"
      },
      "sessionBadge": "MORNING|MIDDAY|AFTERNOON|CLOSING",
      "timeGap": <minutes since previous trade, 0 for first>,
      "timeGapColor": "green|orange|red",
      "cycleStage": <1-10 number mapping to Vicious Cycle stage>
    }
  ],
  "patterns": [
    {
      "name": "Pattern name (e.g., 'Revenge Trading', 'FOMO Entries', 'Afternoon Tilt')",
      "icon": "emoji",
      "description": "Specific description referencing trade numbers and ₹ amounts",
      "costInRupees": <negative number>,
      "frequency": "<number>x today",
      "trades": [<array of trade indices involved>]
    }
  ],
  "financialImpact": {
    "totalLost": <negative number — money lost to emotional/undisciplined decisions>,
    "potentialPnl": <what P&L would have been with perfect discipline>,
    "mistakeCosts": [
      { "name": "Revenge Trades", "icon": "😡", "count": <number>, "cost": <negative number> },
      { "name": "FOMO Entries", "icon": "🏃", "count": <number>, "cost": <negative number> },
      { "name": "Averaging Down", "icon": "⬇️", "count": <number>, "cost": <negative number> },
      { "name": "Panic Exits", "icon": "💥", "count": <number>, "cost": <negative number> }
    ],
    "message": "Specific message about the gap between actual and potential: 'Without revenge trades and FOMO, your session P&L would be ₹X instead of ₹Y'"
  },
  "rulesForNextSession": [
    "Specific actionable rule referencing today's patterns — e.g. 'After 2 consecutive losses, take a 15-minute break before next trade'",
    "Another specific rule with exact thresholds",
    "Another specific rule based on today's data"
  ],
  "bestCase": "If you follow all rules next session: specific projected outcome with ₹ amounts",
  "worstCase": "If you abandon rules: specific projected worst case with ₹ amounts",
  "crossUserInsights": [
    "From 847 traders: Traders with your FOMO pattern who waited 5 minutes before re-entry saw WR improve from 28% to 44%",
    "From 523 traders: Those who set hard stop at 3 revenge trades per day reduced weekly losses by 34%",
    "From 316 traders: Switching to half-size after 2 consecutive losses preserved 62% more capital"
  ]
}`

export const runtime = 'nodejs'
export const maxDuration = 90

/* ═══════════════════════════════════════════════════════════════════════════
   FILE EXTRACTION — Send file directly to Claude for trade extraction
   ═══════════════════════════════════════════════════════════════════════════ */

const EXTRACT_PROMPT = `Extract ALL trades from this broker statement / trade file. This is a real trading file from an Indian or global broker.

IMPORTANT RULES:
- Extract EVERY trade, not just a sample
- For options trades, include the full instrument name (e.g., "NIFTY 24850 CE", "BANKNIFTY 52000 PE")
- Detect whether each row is BUY or SELL
- Calculate P&L per trade if entry and exit prices are available: BUY P&L = (exit - entry) * qty, SELL P&L = (entry - exit) * qty
- If only net amounts are available (like in contract notes), use those directly
- Pair matching entries with exits for the same instrument when possible
- Detect the broker name, market, currency from the file content
- For PDF contract notes: look for tables with trade details including instrument, buy/sell quantity, price, and amounts

Return ONLY valid JSON, no markdown, no explanation:
{
  "broker": "detected broker name (e.g., Fyers, Zerodha, Angel One)",
  "market": "NSE/NYSE/Forex/Crypto",
  "trade_date": "YYYY-MM-DD",
  "currency": "INR/USD/etc",
  "trades": [
    {
      "id": 1,
      "time": "HH:MM",
      "symbol": "instrument name",
      "side": "BUY or SELL",
      "qty": number,
      "entry": number,
      "exit": number,
      "pnl": number,
      "cumPnl": number,
      "fills": [{"qty": number, "price": number}]
    }
  ]
}

If you cannot extract structured trade data, return:
{
  "broker": "Unknown",
  "market": "Unknown",
  "trade_date": null,
  "currency": "INR",
  "trades": [],
  "error": "Description of why extraction failed"
}`

function isTextFile(name: string, type: string) {
  return /\.(csv|tsv|txt)$/i.test(name) || type.includes('text/') || type === 'application/csv'
}

function isExcel(name: string, type: string) {
  return /\.(xlsx?|xls)$/i.test(name) || type.includes('spreadsheet') || type.includes('excel')
}

const DOCUMENT_TYPES = ['application/pdf']
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

async function extractTradesFromFile(client: Anthropic, file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = []

  if (isTextFile(file.name, file.type)) {
    const text = buffer.toString('utf-8')
    console.log(`📝 Sending as text (${text.length} chars)`)
    content.push({ type: 'text', text: `FILE CONTENT (${file.name}):\n\n${text}` })

  } else if (isExcel(file.name, file.type)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheets: string[] = []
      for (const name of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name])
        sheets.push(`--- Sheet: ${name} ---\n${csv}`)
      }
      const text = sheets.join('\n\n')
      console.log(`📊 Excel converted to CSV (${text.length} chars, ${workbook.SheetNames.length} sheets)`)
      content.push({ type: 'text', text: `FILE CONTENT (${file.name}):\n\n${text}` })
    } catch (xlErr) {
      console.error('Excel parse failed, sending as base64:', xlErr)
      const base64 = buffer.toString('base64')
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: base64 }
      })
    }

  } else if (DOCUMENT_TYPES.includes(file.type) || /\.pdf$/i.test(file.name)) {
    const base64 = buffer.toString('base64')
    console.log(`📑 Sending PDF as document (${(base64.length / 1024).toFixed(1)} KB base64)`)
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 }
    })

  } else if (IMAGE_TYPES.includes(file.type) || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)) {
    const base64 = buffer.toString('base64')
    const mediaType = file.type || 'image/png'
    console.log(`🖼️ Sending image as attachment (${mediaType})`)
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 }
    })

  } else {
    const text = buffer.toString('utf-8')
    content.push({ type: 'text', text: `FILE CONTENT (${file.name}):\n\n${text}` })
  }

  content.push({ type: 'text', text: EXTRACT_PROMPT })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content }],
  })

  console.log(`🤖 Extract response — model: ${message.model}, stop: ${message.stop_reason}, usage: ${JSON.stringify(message.usage)}`)

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const result = JSON.parse(jsonStr)

  if (!result.trades || result.trades.length === 0) {
    const errMsg = result.error || 'Could not extract trade data from this file. Try uploading the original CSV or Excel export from your broker.'
    throw new Error(errMsg)
  }

  // Ensure cumPnl is computed
  let cum = 0
  for (const t of result.trades) {
    if (t.pnl == null && t.entry != null && t.exit != null && t.qty != null) {
      t.pnl = t.side === 'BUY'
        ? Math.round((t.exit - t.entry) * t.qty)
        : Math.round((t.entry - t.exit) * t.qty)
    }
    cum += (t.pnl || 0)
    t.cumPnl = cum
    if (!t.fills) t.fills = [{ qty: t.qty, price: t.entry || 0 }]
  }

  return {
    trades: result.trades,
    broker: result.broker || 'Unknown',
    market: result.market || 'Unknown',
    tradeDate: result.trade_date,
    currency: result.currency || 'INR',
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYSIS — Run psychology coaching on extracted/provided trades
   ═══════════════════════════════════════════════════════════════════════════ */

function parseJsonResponse(text: string) {
  let jsonStr = text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  return JSON.parse(jsonStr)
}

async function analyseTradesWithAI(client: Anthropic, tradesStr: string, contextStr: string) {
  let analysis = null
  let attempts = 0
  let lastRawText = ''

  while (attempts < 2 && !analysis) {
    attempts++
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: USER_PROMPT_TEMPLATE(tradesStr, contextStr) },
        ],
      })

      console.log(`🤖 Analysis response — model: ${message.model}, stop: ${message.stop_reason}, usage: ${JSON.stringify(message.usage)}`)

      const text = message.content[0].type === 'text' ? message.content[0].text : ''
      lastRawText = text
      analysis = parseJsonResponse(text)
    } catch (parseErr: unknown) {
      console.error(`Analysis attempt ${attempts} failed:`, parseErr instanceof Error ? parseErr.message : String(parseErr))
      console.error('Raw response (first 500 chars):', lastRawText.substring(0, 500))

      if (parseErr instanceof Error && !(parseErr instanceof SyntaxError)) {
        let errMsg = parseErr.message || 'Anthropic API error'
        try {
          const parsed = JSON.parse(errMsg.replace(/^\d+\s*/, ''))
          if (parsed?.error?.message) errMsg = parsed.error.message
        } catch { /* use raw message */ }
        throw new Error(errMsg)
      }

      if (attempts >= 2) {
        throw new Error('AI analysis failed — could not parse response. Please try again.')
      }
    }
  }

  return analysis
}

/* ═══════════════════════════════════════════════════════════════════════════
   POST HANDLER — Accepts FormData (file) OR JSON (pre-extracted trades)
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let trades: unknown[]
    let context: Record<string, unknown> = {}
    let broker = 'Unknown'
    let market = 'Unknown'
    let currency = 'INR'

    const client = getClient()

    // ─── Mode 1: FormData with file — extract + analyse in one call ───
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const contextStr = formData.get('context') as string | null

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      console.log(`📄 Analyse request (file): ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`)

      if (contextStr) {
        try { context = JSON.parse(contextStr) } catch { /* ignore */ }
      }

      // Step 1: Extract trades from file
      const extracted = await extractTradesFromFile(client, file)
      trades = extracted.trades
      broker = extracted.broker
      market = extracted.market
      currency = extracted.currency

      console.log(`✅ Extracted ${trades.length} trades from ${broker}`)

    // ─── Mode 2: JSON body with pre-extracted trades ───
    } else {
      const body = await req.json()
      trades = body.trades
      context = body.context || {}

      if (!trades || !Array.isArray(trades) || trades.length === 0) {
        return NextResponse.json({ error: 'No trades provided' }, { status: 400 })
      }

      broker = (context.broker as string) || 'Unknown'
      market = (context.market as string) || 'Unknown'
      currency = (context.currency as string) || 'INR'
    }

    // Step 2: Run psychology analysis
    const tradesStr = JSON.stringify(trades, null, 2)
    const contextStr = JSON.stringify({ broker, market, currency, ...context }, null, 2)
    const analysis = await analyseTradesWithAI(client, tradesStr, contextStr)

    return NextResponse.json({
      analysis,
      trades,
      broker,
      market,
      currency,
    })

  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : 'Analysis failed'
    console.error('Analysis error:', errMessage)

    if (errMessage.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({ error: errMessage }, { status: 500 })
    }
    if (errMessage.includes('authentication') || errMessage.includes('401')) {
      return NextResponse.json({ error: 'AI service authentication failed. Please check the API key configuration.' }, { status: 502 })
    }
    if (errMessage.includes('rate') || errMessage.includes('429')) {
      return NextResponse.json({ error: 'AI service is temporarily busy. Please try again in a moment.' }, { status: 429 })
    }
    if (errMessage.includes('Could not extract')) {
      return NextResponse.json({ error: errMessage }, { status: 422 })
    }
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
