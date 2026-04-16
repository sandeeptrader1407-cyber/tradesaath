/**
 * TradeSaath — Session Analyser (extracted from route handler)
 * Reusable core analysis function for single-session processing.
 * Used by both the individual route and the batch queue.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getSupabaseAdmin } from '@/lib/supabase'
import { saveTradeAnalysis } from '@/lib/supabase/saveTradeAnalysis'
import { updateSessionAnalysis } from '@/lib/supabase/saveTrades'
import { bustDashboardCache } from '@/lib/dashboardCache'
import { detectPatterns } from '@/lib/analysis/patternDetector'
import { buildAnalysisJSON, generateAICoaching } from '@/lib/analysis/sessionSummarizer'

export const CURRENT_ANALYSIS_VERSION = 3

export function parseTrades(raw: unknown): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch { return [] }
  }
  if (typeof raw === 'object') return Object.values(raw as Record<string, any>)
  return []
}

export interface AnalyseSessionOpts {
  sessionId: string
  userId: string
  force?: boolean
  includeAICoaching?: boolean
}

export interface AnalyseSessionResult {
  success: boolean
  skipped?: boolean
  reason?: string
  tradesAnalysed: number
  error?: string
}

/**
 * Core analysis function — fetches session, runs detection, persists results.
 * Throws no errors; returns result object with success/error fields.
 */
export async function analyseSession(opts: AnalyseSessionOpts): Promise<AnalyseSessionResult> {
  const { sessionId, userId, force = false, includeAICoaching = false } = opts
  try {
    const supabase = getSupabaseAdmin()

    /* 1. Fetch session and verify ownership */
    const { data: session, error: fetchErr } = await supabase
      .from('trade_sessions')
      .select('id, user_id, anon_id, trades, analysis, context, trade_date, trade_count, net_pnl')
      .eq('id', sessionId)
      .maybeSingle()

    if (fetchErr || !session) {
      return { success: false, tradesAnalysed: 0, error: 'Session not found' }
    }
    if (session.user_id !== userId) {
      return { success: false, tradesAnalysed: 0, error: 'Forbidden' }
    }

    /* 2. Parse trades */
    const allTrades = parseTrades(session.trades) as any[]
    if (!allTrades.length) {
      return { success: false, tradesAnalysed: 0, error: 'No trades on this session' }
    }

    /* 3. Version gate */
    if (!force) {
      const existing: any = (session.analysis && typeof session.analysis === 'object') ? session.analysis : null
      const existingVersion = Number(existing?.analysed_version)
      const alreadyCurrent = existing
        && typeof existing.analysed_at === 'string'
        && existing.analysed_at.length > 0
        && Number.isFinite(existingVersion)
        && existingVersion >= CURRENT_ANALYSIS_VERSION
      if (alreadyCurrent) {
        return { success: true, skipped: true, reason: 'already_analysed', tradesAnalysed: allTrades.length }
      }
    }

    // Clear prior trade_analysis rows
    await supabase.from('trade_analysis').delete().eq('session_id', sessionId)

    /* 4. Pull user-level baselines */
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

    /* 5. Run code pattern detection */
    const result = detectPatterns(allTrades, { userTypicalQty, userAvgDailyTrades })

    /* 6. Optional AI coaching */
    let aiCoaching: string | undefined
    if (includeAICoaching && process.env.ANTHROPIC_API_KEY) {
      aiCoaching = await generateAICoaching(process.env.ANTHROPIC_API_KEY, result)
    }

    /* 7. Build analysis JSONB */
    const analysis = buildAnalysisJSON({ ...session, trades: allTrades }, result, aiCoaching)

    /* 8. Build rows for trade_analysis table */
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

    /* 9. Persist */
    await saveTradeAnalysis(sessionId, merged, session.anon_id || undefined)
    await updateSessionAnalysis(sessionId, analysis)

    /* 9b. Mirror DQS */
    try {
      const dqsScoreVal = Number(analysis?.dqs?.score)
      if (Number.isFinite(dqsScoreVal)) {
        await supabase
          .from('trade_sessions')
          .update({ dqs_score: dqsScoreVal })
          .eq('id', sessionId)
      }
    } catch (e) {
      console.warn('dqs_score column sync failed (non-blocking):', e)
    }

    /* 10. Bust dashboard cache */
    bustDashboardCache(userId)

    return { success: true, tradesAnalysed: merged.length }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`analyseSession error [${sessionId}]:`, msg)
    return { success: false, tradesAnalysed: 0, error: msg }
  }
}
