export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { saveTradeAnalysis } from '@/lib/supabase/saveTradeAnalysis'
import { updateSessionAnalysis } from '@/lib/supabase/saveTrades'
import { bustDashboardCache } from '@/lib/dashboardCache'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit'
import { detectPatterns } from '@/lib/analysis/patternDetector'
import { buildAnalysisJSON, generateAICoaching } from '@/lib/analysis/sessionSummarizer'

/* ─── helpers ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTrades(raw: unknown): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch { return [] }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof raw === 'object') return Object.values(raw as Record<string, any>)
  return []
}

/* ─── POST /api/analyse/session ─── */

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Higher limit now — code analysis is essentially free, no reason to throttle hard.
    const ip = getClientIp(request as unknown as Request)
    const rl = rateLimit(`analyse-session:${userId}:${ip}`, 200, 15 * 60 * 1000)
    if (!rl.success) return rateLimitResponse(rl.resetIn)

    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    const force = !!body?.force
    const includeAICoaching = !!body?.includeAICoaching
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    /* 1. Fetch session and verify ownership */
    const { data: session, error: fetchErr } = await supabase
      .from('trade_sessions')
      .select('id, user_id, anon_id, trades, analysis, context, trade_date, trade_count, net_pnl')
      .eq('id', sessionId)
      .maybeSingle()

    if (fetchErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    /* 2. Parse trades */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTrades = parseTrades(session.trades) as any[]
    if (!allTrades.length) {
      return NextResponse.json({ error: 'No trades on this session', tradesAnalysed: 0 }, { status: 400 })
    }

    /* 3. Skip if already analysed — saves a DB write even though code analysis is cheap */
    if (!force) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing: any = (session.analysis && typeof session.analysis === 'object') ? session.analysis : null
      const alreadyDone = existing && typeof existing.analysed_at === 'string' && existing.analysed_at.length > 0
      if (alreadyDone) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'already_analysed',
          tradesAnalysed: allTrades.length,
        })
      }
    } else {
      await supabase.from('trade_analysis').delete().eq('session_id', sessionId)
    }

    /* 4. Pull user-level baselines (typical qty, avg daily trades) for better detection */
    let userTypicalQty = 0
    let userAvgDailyTrades = 0
    try {
      const { data: recent } = await supabase
        .from('trade_sessions')
        .select('trade_count, trades')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (recent && recent.length > 0) {
        const counts = recent.map(s => Number(s.trade_count) || 0).filter(c => c > 0)
        userAvgDailyTrades = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
        const qtys: number[] = []
        for (const s of recent) {
          const ts = parseTrades(s.trades)
          for (const t of ts) {
            const q = Number(t.qty)
            if (Number.isFinite(q) && q > 0) qtys.push(q)
          }
          if (qtys.length > 500) break
        }
        if (qtys.length > 0) {
          qtys.sort((a, b) => a - b)
          userTypicalQty = qtys[Math.floor(qtys.length / 2)]
        }
      }
    } catch (e) {
      console.warn('user baseline fetch failed, falling back to session-local stats:', e)
    }

    /* 5. Run code pattern detection (instant, free) */
    const result = detectPatterns(allTrades, { userTypicalQty, userAvgDailyTrades })

    /* 6. Optional — tiny Haiku coaching call (~₹0.10, non-blocking on failure) */
    let aiCoaching: string | undefined
    if (includeAICoaching && process.env.ANTHROPIC_API_KEY) {
      aiCoaching = await generateAICoaching(process.env.ANTHROPIC_API_KEY, result)
    }

    /* 7. Build full analysis JSONB object */
    const analysis = buildAnalysisJSON({ ...session, trades: allTrades }, result, aiCoaching)

    /* 8. Build rows for trade_analysis table — match legacy schema */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = allTrades.map((t: any, i: number) => {
      const ai = analysis.trade_analyses.find(a => a.trade_index === i)
      return {
        symbol: t.symbol ?? null,
        side: t.side ?? null,
        entry_price: t.entry ?? t.entry_price ?? null,
        exit_price: t.exit ?? t.exit_price ?? null,
        quantity: t.qty ?? t.quantity ?? null,
        pnl: t.pnl ?? null,
        entry_time: t.time ?? t.entry_time ?? null,
        exit_time: t.exit_time ?? null,
        tag: ai?.tag ?? null,
        tag_label: ai?.tag_label ?? null,
        quick_summary: ai?.quick_summary ?? null,
        psychology_coaching: ai?.psychology_coaching ?? null,
        technical_analysis: ai?.technical_analysis ?? null,
        counterfactual: ai?.counterfactual ?? null,
        cycle_stage: ai?.cycle_stage ?? null,
      }
    })

    /* 9. Persist — both tables */
    await saveTradeAnalysis(sessionId, merged, session.anon_id || undefined)
    await updateSessionAnalysis(sessionId, analysis)

    /* 10. Bust dashboard cache for this user */
    bustDashboardCache(userId)

    return NextResponse.json({
      success: true,
      sessionId,
      tradesAnalysed: merged.length,
      totalTrades: allTrades.length,
      truncated: false,
      mode: 'code',
      aiCoaching: !!aiCoaching,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('analyse/session error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
