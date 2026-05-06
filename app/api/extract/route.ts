import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit'
import { intakeFile, toLegacyTrade, saveRawData, saveClaudeFallbackRawData, computeFileHash } from '@/lib/intake'
import { resolveCurrency } from '@/lib/utils/currency'
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE_MESSAGE } from '@/lib/config/uploadLimits'

export const runtime = 'nodejs'
export const maxDuration = 60

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

/* CSV/TSV files can be sent as text — much cheaper than document mode */
function isTextFile(name: string, type: string) {
  return /\.(csv|tsv|txt)$/i.test(name) || type.includes('text/') || type === 'application/csv'
}

/* Excel files: convert to CSV text using xlsx, then send as text */
function isExcel(name: string, type: string) {
  return /\.(xlsx?|xls)$/i.test(name) || type.includes('spreadsheet') || type.includes('excel')
}

/* Supported document types for Claude's document attachment */
const DOCUMENT_TYPES = ['application/pdf']
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

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

export async function POST(req: NextRequest) {
  // Rate limit: 5 per IP per 15 min (Claude API cost protection)
  const ip = getClientIp(req)
  const rl = await rateLimit(`extract:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.success) return rateLimitResponse(rl.resetIn)

  // FIX (audit Finding F — 2026-05-04): currency-resolution context for
  // both response sites in this handler.
  const cookieCurrency = req.cookies.get('tradesaath-currency')?.value ?? null
  const acceptLanguage = req.headers.get('accept-language')

  if (process.env.DISABLE_AI_ANALYSIS === 'true') {
    return NextResponse.json({ error: 'AI analysis temporarily unavailable', code: 'AI_DISABLED' }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // PR 2d (audit Finding E): central MAX_UPLOAD_BYTES + 413 status.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `${UPLOAD_TOO_LARGE_MESSAGE} (${file.name})` }, { status: 413 })
    }

    console.log(`Extract request: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // PR 2d (audit Finding E): resolve userId once for both archive sites
    // below. /extract supports anonymous uploads — when userId is null we
    // SKIP the archive (anon_id flow not plumbed through saveRawData yet,
    // known limitation tracked for a future PR).
    const { userId } = await auth()

    // --- Try Module 1 intake pipeline first (free, instant) ---
    const intakeResult = await intakeFile(buffer, file.name)
    if (intakeResult.success && intakeResult.trades.length > 0) {
      const legacyTrades = intakeResult.trades.map(toLegacyTrade)
      // Ensure cumPnl is computed
      let cum = 0
      for (const t of legacyTrades) {
        cum += (t.pnl || 0)
        t.cumPnl = cum
        t.cum_pnl = cum
        if (!t.fills) t.fills = [{ qty: t.qty, price: t.entry || 0 }]
      }

      // Reject if >80% of trades have both entry and exit price as zero/missing
      const zeroPriceCount = legacyTrades.filter(
        t => (!t.entry || Number(t.entry) === 0) && (!t.exit || Number(t.exit) === 0)
      ).length
      if (legacyTrades.length > 0 && zeroPriceCount / legacyTrades.length > 0.8) {
        console.warn(`[Extract] Price failure: ${zeroPriceCount}/${legacyTrades.length} trades have zero prices`)
        return NextResponse.json({
          error: 'We could not read prices from this file. Please verify the broker format or export a file that includes entry and exit prices. Contact support if this persists.',
        }, { status: 422 })
      }

      console.log(`[Intake] Local extract OK: ${legacyTrades.length} trades from ${intakeResult.rawFile.broker}`)

      // PR 2d (audit Finding E): archive raw bytes alongside metadata for
      // authenticated users. Anonymous /extract uploads stay un-archived
      // (no anon_id flow plumbed through saveRawData yet — known gap).
      if (userId) {
        const archiveResult = await saveRawData(
          intakeResult.rawFile,
          userId,
          undefined, // no sessionId — /extract is preview-only
          buffer,
        )
        if ('error' in archiveResult) {
          console.warn(`[Extract] Raw archive failed: ${archiveResult.error}`)
        } else {
          console.log(`[Extract] Archived raw file: ${archiveResult.id} (storagePath=${archiveResult.storagePath ?? 'null'})`)
        }
      }

      // FIX (audit Finding F — 2026-05-04): resolveCurrency for response.
      const resolvedCurrencyLocal = await resolveCurrency({
        detectedCurrency: intakeResult.rawFile.currency,
        detectedMarket: intakeResult.rawFile.market,
        symbols: (legacyTrades.map((t: { symbol?: string }) => t?.symbol).filter(Boolean) as string[]),
        cookieCurrency,
        acceptLanguage,
      })
      return NextResponse.json({
        trades: legacyTrades,
        broker: intakeResult.rawFile.broker || 'Unknown',
        market: intakeResult.rawFile.market || 'Unknown',
        tradeDate: intakeResult.rawFile.tradeDate,
        currency: resolvedCurrencyLocal,
        _parsed_locally: true,
      })
    }
    console.log(`[Intake] Local parse returned 0 trades, falling back to AI extraction`)

    // --- Fall back to Claude AI extraction ---
    const client = getClient()

    // Build the message content based on file type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Anthropic SDK content block types
    const content: any[] = []

    if (isTextFile(file.name, file.type)) {
      // CSV/TSV -- send as plain text (cheaper, faster)
      const text = buffer.toString('utf-8')
      console.log(`[Extract] Sending as text (${text.length} chars)`)
      content.push({ type: 'text', text: `FILE CONTENT (${file.name}):\n\n${text}` })

    } else if (isExcel(file.name, file.type)) {
      // Excel -- convert to CSV via xlsx, send as text
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
        console.log(`[Extract] Excel converted to CSV (${text.length} chars, ${workbook.SheetNames.length} sheets)`)
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
      // PDF -- send as document attachment
      const base64 = buffer.toString('base64')
      console.log(`[Extract] Sending PDF as document (${(base64.length / 1024).toFixed(1)} KB base64)`)
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 }
      })

    } else if (IMAGE_TYPES.includes(file.type) || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)) {
      // Image -- send as image attachment
      const base64 = buffer.toString('base64')
      const mediaType = file.type || 'image/png'
      console.log(`[Extract] Sending image as attachment (${mediaType})`)
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 }
      })

    } else {
      // Unknown type -- try sending as text
      const text = buffer.toString('utf-8')
      content.push({ type: 'text', text: `FILE CONTENT (${file.name}):\n\n${text}` })
    }

    // Add the extraction prompt
    content.push({ type: 'text', text: EXTRACT_PROMPT })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content }],
    })

    console.log(`[Extract] Extract response -- model: ${message.model}, stop: ${message.stop_reason}, usage: ${JSON.stringify(message.usage)}`)

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON response
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const result = JSON.parse(jsonStr)

    if (!result.trades || result.trades.length === 0) {
      const errMsg = result.error || 'Could not extract trade data from this file. Try uploading the original CSV or Excel export from your broker.'
      console.log(`[Extract] No trades extracted: ${errMsg}`)
      return NextResponse.json({ error: errMsg }, { status: 422 })
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

    // Deduplicate AI-extracted fills: group by (symbol, side, entry, exit, pnl) — same fill
    // emitted multiple times from multi-page contract notes.
    const beforeDedup = result.trades.length
    const seenSigs = new Set<string>()
    result.trades = (result.trades as Array<Record<string, unknown>>).filter(t => {
      const sig = [
        String(t.symbol || '').toUpperCase().replace(/\s+/g, ''),
        String(t.side || '').toUpperCase(),
        String(t.time || ''),
        Number(t.entry || 0).toFixed(2),
        Number(t.exit || 0).toFixed(2),
        Number(t.pnl || 0).toFixed(2),
        Number(t.qty || 0),
      ].join('|')
      if (seenSigs.has(sig)) return false
      seenSigs.add(sig)
      return true
    })
    const dedupRemoved = beforeDedup - result.trades.length
    if (dedupRemoved > 0) {
      console.log(`[Extract] Dedup: removed ${dedupRemoved} duplicate fills from ${beforeDedup} AI-extracted trades`)
      // Recompute cumPnl after dedup
      let cumAfter = 0
      for (const t of result.trades) { cumAfter += (t.pnl as number || 0); t.cumPnl = cumAfter }
    }

    // Reject if >80% of trades have both entry and exit price as zero/missing
    const aiZeroPriceCount = (result.trades as Array<Record<string, unknown>>).filter(
      t => (!t.entry || Number(t.entry) === 0) && (!t.exit || Number(t.exit) === 0)
    ).length
    if (result.trades.length > 0 && aiZeroPriceCount / result.trades.length > 0.8) {
      console.warn(`[Extract] Price failure (AI path): ${aiZeroPriceCount}/${result.trades.length} trades have zero prices`)
      return NextResponse.json({
        error: 'We could not read prices from this file. Please verify the broker format or export a file that includes entry and exit prices. Contact support if this persists.',
      }, { status: 422 })
    }

    console.log(`[Extract] Extracted ${result.trades.length} trades from ${result.broker || 'unknown broker'}`)

    // PR 2d (audit Finding E): archive Claude-extracted raw bytes for
    // authenticated users. Anonymous /extract uploads stay un-archived
    // (same anon_id-flow gap as the local-parse branch above).
    if (userId) {
      const fileHash = computeFileHash(buffer)
      const archiveResult = await saveClaudeFallbackRawData({
        filename: file.name,
        fileHash,
        fileSizeBytes: file.size,
        broker: result.broker || 'Unknown',
        market: result.market || 'Unknown',
        currency: result.currency || '',
        tradeDate: result.trade_date || '',
        tradeCount: result.trades.length,
        trades: result.trades,
        cookieCurrency,
        acceptLanguage,
        fileBuffer: buffer,
      }, userId)
      if ('error' in archiveResult) {
        console.warn(`[Extract] Claude raw archive failed: ${archiveResult.error}`)
      } else {
        console.log(`[Extract] Archived Claude raw file: ${archiveResult.id} (storagePath=${archiveResult.storagePath ?? 'null'})`)
      }
    }

    // FIX (audit Finding F — 2026-05-04): resolveCurrency for response.
    const resolvedCurrencyAi = await resolveCurrency({
      detectedCurrency: result.currency,
      detectedMarket: result.market,
      symbols: (result.trades.map((t: { symbol?: string }) => t?.symbol).filter(Boolean) as string[]),
      cookieCurrency,
      acceptLanguage,
    })
    return NextResponse.json({
      trades: result.trades,
      broker: result.broker || 'Unknown',
      market: result.market || 'Unknown',
      tradeDate: result.trade_date,
      currency: resolvedCurrencyAi,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Extraction failed'
    console.error('Extract error:', msg)

    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI could not parse structured data from this file. Try a CSV or Excel export.' }, { status: 422 })
    }
    if (msg.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
