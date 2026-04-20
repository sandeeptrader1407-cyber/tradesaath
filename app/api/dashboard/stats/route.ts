import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { migrateAnonToUser } from '@/lib/supabase/migrateAnonData'

import { statsCache } from '@/lib/dashboardCache'
import {
  computeAllPeriodKPIs,
  filterByPeriod,
  computeDisciplineScore,
} from '@/lib/kpi/computeKPIs'
import { marketToCurrency } from '@/lib/utils/currency'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const refresh = req.nextUrl.searchParams.get('refresh') === 'true'
    const cacheKey = `stats:${userId}`
    if (!refresh) {
      const cached = statsCache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data)
      }
    }

    const anonId = req.cookies.get('tradesaath_anon_id')?.value
    if (anonId) {
      try {
        await migrateAnonToUser(anonId, userId)
      } catch { /* non-blocking */ }
    }

    const { data: sessions } = await supabaseAdmin
      .from('trade_sessions')
      .select('id, created_at, trade_date, detected_market, trade_count, net_pnl, win_count, loss_count, win_rate, profit_factor, trades, analysis')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        hasData: false,
        sessionCount: 0,
        totalTrades: 0,
      })
    }

    // Detect dominant market/currency from sessions
    const marketCounts: Record<string, number> = {}
    for (const s of sessions) {
      const m = (s.detected_market || 'Unknown').toUpperCase()
      marketCounts[m] = (marketCounts[m] || 0) + 1
    }
    const dominantMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
    const currency = marketToCurrency(dominantMarket)

    // SINGLE SOURCE OF TRUTH: every period-level metric comes from computeAllPeriodKPIs.
    // No per-period math lives in this file anymore.
    const now = new Date()
    const periods = computeAllPeriodKPIs(sessions, now)
    const allTimeKPIs = periods.allTime
    const monthKPIs = periods.thisMonth
    const weekKPIs = periods.thisWeek
    const todayKPIs = periods.today

    // Keep these named aliases so downstream code that reads them still works.
    const monthSessions = filterByPeriod(sessions, 'thisMonth', now)
    const weekSessions = filterByPeriod(sessions, 'thisWeek', now)
    const todaySessions = filterByPeriod(sessions, 'today', now)

    const totalTrades = monthKPIs.totalTrades
    const totalWins = monthKPIs.totalWins
    const totalLosses = monthKPIs.totalLosses
    const monthPnl = monthKPIs.totalPnl
    const weekPnl = weekKPIs.totalPnl
    const todayPnl = todayKPIs.totalPnl

    const equityCurve = sessions
      .slice(0, 20)
      .reverse()
      .map((s) => ({
        pnl: Number(s.net_pnl || 0),
        date: s.trade_date || s.created_at?.split('T')[0],
      }))

    let currentStreak = 0
    let bestWinStreak = 0
    let worstLossStreak = 0
    let tempWin = 0
    let tempLoss = 0
    for (const s of sessions) {
      const pnl = Number(s.net_pnl || 0)
      if (pnl > 0) {
        tempWin++
        tempLoss = 0
        bestWinStreak = Math.max(bestWinStreak, tempWin)
      } else {
        tempLoss++
        tempWin = 0
        worstLossStreak = Math.max(worstLossStreak, tempLoss)
      }
    }
    if (sessions.length > 0) {
      const firstPnl = Number(sessions[0].net_pnl || 0)
      const isWin = firstPnl > 0
      currentStreak = 1
      for (let i = 1; i < sessions.length; i++) {
        const p = Number(sessions[i].net_pnl || 0)
        if ((isWin && p > 0) || (!isWin && p <= 0)) currentStreak++
        else break
      }
      if (!isWin) currentStreak = -currentStreak
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic
    const sessionIds = sessions.map((s: any) => s.id)
    let recentTrades: { time?: string; symbol?: string; side?: string; pnl?: number; tag?: string }[] = []
    let mistakeTrades: { type: string; icon: string; count: number; cost: number }[] = []
    let totalMistakeCost = 0
    let tradesByTimeDay: { entry_time: string; pnl: number }[] = []
    let dqsScore = 0
    let dqsFactors: { name: string; score: number }[] = []

    const recentSessions = sessions.slice(0, 4).map((s) => ({
      date: s.trade_date || s.created_at?.split('T')[0] || '',
      trades: s.trade_count || 0,
      pnl: Number(s.net_pnl || 0),
      winRate: s.win_rate || 0,
    }))

    if (sessionIds.length > 0) {
      const { data: recentTA } = await supabaseAdmin
        .from('trade_analysis')
        .select('symbol, side, pnl, entry_time, tag, tag_label')
        .in('session_id', sessionIds.slice(0, 5))
        .order('created_at', { ascending: false })
        .limit(20)

      if (recentTA && recentTA.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recentTrades = recentTA.slice(0, 5).map((t: any) => ({
          time: t.entry_time || '',
          symbol: t.symbol || 'Unknown',
          side: t.side || '',
          pnl: Number(t.pnl || 0),
          tag: t.tag_label || t.tag || '',
        }))
      } else {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        for (const sess of sessions.slice(0, 5)) {
          const trades = (sess as any).trades
          if (Array.isArray(trades) && trades.length > 0) {
            for (const t of trades) {
              if (recentTrades.length >= 5) break
              recentTrades.push({
                time: t.entry_time || t.time || '',
                symbol: t.symbol || 'Unknown',
                side: t.side || '',
                pnl: Number(t.pnl || 0),
                tag: t.tag_label || t.tag || '',
              })
            }
          }
          if (recentTrades.length >= 5) break
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */
      }

      const { data: allTA } = await supabaseAdmin
        .from('trade_analysis')
        .select('tag, tag_label, pnl, entry_time, cycle_stage, session_id')
        .in('session_id', sessionIds)

      if (allTA && allTA.length > 0) {
        const mistakeMap: Record<string, { count: number; cost: number; icon: string }> = {}
        const mistakeIcons: Record<string, string> = {
          rvg: String.fromCodePoint(0x2694, 0xFE0F),
          fomo: String.fromCodePoint(0x1F525),
          pnc: String.fromCodePoint(0x1F4A8),
          avg: String.fromCodePoint(0x1F4C9),
          vs: String.fromCodePoint(0x1F504),
          fatigue: String.fromCodePoint(0x1F635),
          over: String.fromCodePoint(0x1F4C8),
          size: String.fromCodePoint(0x1F3CB, 0xFE0F),
          late: String.fromCodePoint(0x1F551),
        }
        const defaultIcon = String.fromCodePoint(0x26A0, 0xFE0F)

        for (const t of allTA) {
          const tag = t.tag as string
          if (tag && tag !== 'win') {
            if (!mistakeMap[tag]) {
              mistakeMap[tag] = { count: 0, cost: 0, icon: mistakeIcons[tag] || defaultIcon }
            }
            mistakeMap[tag].count++
            if (Number(t.pnl || 0) < 0) {
              mistakeMap[tag].cost += Math.abs(Number(t.pnl || 0))
            }
          }
        }

        const tagLabels: Record<string, string> = {
          rvg: 'Revenge Trading', fomo: 'FOMO Entries', pnc: 'Panic Exits',
          avg: 'Averaging Down', vs: 'Vicious Cycle', fatigue: 'Decision Fatigue',
          hope: 'Hope Trading', tilt: 'On Tilt',
          over: 'Overtrading', size: 'Oversized Position', late: 'Late Exit',
          hold: 'Holding Losers', cut: 'Cutting Winners Early',
        }

        mistakeTrades = Object.entries(mistakeMap)
          .map(([tag, v]) => ({ type: tagLabels[tag] || tag, icon: v.icon, count: v.count, cost: v.cost }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 5)

        totalMistakeCost = mistakeTrades.reduce((s, m) => s + m.cost, 0)

        const sessionDateMap: Record<string, string> = {}
        for (const s of sessions) {
          // CRITICAL: use ONLY trade_date for heatmap day-of-week, never fall back to created_at
          // (created_at is upload time, not actual trade date — would collapse all trades to the same weekday)
          if (s.trade_date) sessionDateMap[s.id] = s.trade_date
        }

        // ── Heatmap: build tradesByTimeDay from BEST available source ──
        // Priority 1: JSONB trades (actual entry times from uploaded data)
        // Priority 2: trade_analysis rows (may have entry_time)
        // Priority 3: session-level fallback (one point per session)

        /* eslint-disable @typescript-eslint/no-explicit-any */

        // Helper: resolve a time string + date string into a full ISO timestamp
        const resolveTime = (timeStr: string, dateStr: string): string | null => {
          if (!timeStr) return null
          // Already full ISO?
          if (/^\d{4}-\d{2}-\d{2}T/.test(timeStr)) return timeStr
          // Time-only: prepend date
          if (!dateStr) return null
          const m = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
          if (!m) return null
          const hh = m[1].padStart(2, '0')
          const mm = m[2]
          const ss = m[3] || '00'
          return `${dateStr}T${hh}:${mm}:${ss}`
        }

        // Source 1: JSONB trades (highest fidelity — actual upload times)
        const jsonbHeatmap: { entry_time: string; pnl: number }[] = []
        for (const sess of sessions) {
          const trades = (sess as any).trades
          if (!Array.isArray(trades)) continue
          const dateStr = sessionDateMap[sess.id]
          if (!dateStr) continue
          for (const t of trades) {
            const timeStr = String(t.entry_time || t.time || '')
            const fullTime = resolveTime(timeStr, dateStr)
            if (fullTime) jsonbHeatmap.push({ entry_time: fullTime, pnl: Number(t.pnl || 0) })
          }
        }

        // Check if times have real variation (not all identical like "09:15" from position reports)
        const uniqueSlots = new Set(jsonbHeatmap.map(t => {
          const m = t.entry_time.match(/T(\d{2}):(\d{2})/)
          return m ? `${m[1]}:${m[2]}` : ''
        }))
        const hasTimeVariation = uniqueSlots.size > 1
        if (jsonbHeatmap.length >= 5 && hasTimeVariation) {
          tradesByTimeDay = jsonbHeatmap
        } else {
          // Source 2: trade_analysis rows
          const taWithTime = allTA
            .filter((t: any) => t.entry_time)
            .map((t: any) => {
              const fullTime = resolveTime(t.entry_time as string, sessionDateMap[t.session_id] || '')
              return fullTime ? { entry_time: fullTime, pnl: Number(t.pnl || 0) } : null
            })
            .filter((t): t is { entry_time: string; pnl: number } => t !== null)

          const taUniqueSlots = new Set(taWithTime.map(t => {
            const m = t.entry_time.match(/T(\d{2}):(\d{2})/)
            return m ? `${m[1]}:${m[2]}` : ''
          }))
          if (taWithTime.length >= 5 && taUniqueSlots.size > 1) {
            tradesByTimeDay = taWithTime
          }
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */
      }
    }

    // Source 3 (last resort): one data point per session at a synthetic time slot
    if (tradesByTimeDay.length < 5 && sessions.length >= 5) {
      const fallbackSlots = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '14:30', '15:00']
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tradesByTimeDay = sessions.map((s: any, i: number) => {
        const dateStr = s.trade_date || ''
        if (!dateStr) return null
        const slot = fallbackSlots[i % fallbackSlots.length]
        return {
          entry_time: `${dateStr}T${slot}:00`,
          pnl: Number(s.net_pnl || 0),
        }
      }).filter((t): t is { entry_time: string; pnl: number } => t !== null)
    }

    // ── hasRealTimeData: detect when all trade times are identical (position report artifacts) ──
    const heatmapTimeSet = new Set(tradesByTimeDay.map(t => {
      const tm = t.entry_time.match(/T(\d{2}):(\d{2})/)
      return tm ? tm[1] + ':' + tm[2] : ''
    }))
    const hasRealTimeData = heatmapTimeSet.size > 1

    // ── Best Time Slot: slot with highest win rate (minimum 5 trades) ──
    let bestTimeSlot: { slot: string; winRate: number; trades: number } | null = null
    {
      // Discover slots from actual data instead of hardcoding
      const slotSet = new Set<string>()
      for (const t of tradesByTimeDay) {
        const tm = t.entry_time.match(/T(\d{2}):(\d{2})/)
        if (tm) {
          const m = Number(tm[2])
          slotSet.add(tm[1] + ':' + (m < 30 ? '00' : '30'))
        }
      }
      const HEATMAP_SLOTS = Array.from(slotSet).sort()
      const slotStats: Record<string, { wins: number; total: number }> = {}
      for (const slot of HEATMAP_SLOTS) slotStats[slot] = { wins: 0, total: 0 }

      for (const t of tradesByTimeDay) {
        const timeMatch = t.entry_time.match(/T(\d{1,2}):(\d{2})/)
        if (!timeMatch) continue
        const h = Number(timeMatch[1])
        const m = Number(timeMatch[2])

        const slotMin = m < 30 ? 0 : 30
        const slotKey = `${String(h).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`
        if (!slotStats[slotKey]) continue
        slotStats[slotKey].total++
        if (t.pnl > 0) slotStats[slotKey].wins++
      }

      let bestWR = -1
      for (const [slot, s] of Object.entries(slotStats)) {
        if (s.total < 5) continue
        const wr = (s.wins / s.total) * 100
        if (wr > bestWR) {
          bestWR = wr
          bestTimeSlot = { slot, winRate: Math.round(wr), trades: s.total }
        }
      }
    }

    // Count how many sessions need (re-)analysis — lets the dashboard show a prominent CTA.
    const CURRENT_ANALYSIS_VERSION = 4
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysedSessions = sessions.filter((s: any) => {
      const a = s.analysis
      if (!a || typeof a !== 'object') return false
      const hasTs = typeof a.analysed_at === 'string' && a.analysed_at.length > 0
      const v = Number(a.analysed_version)
      return hasTs && Number.isFinite(v) && v >= CURRENT_ANALYSIS_VERSION
    })
    const pendingAnalysisCount = sessions.length - analysedSessions.length

    // DQS: average across ALL analysed sessions (not just the most recent 10)
    // Each session row carries its own analysis JSONB written by the algorithmic pattern detector.
    let dqsTotal = 0
    let dqsCount = 0
    const factorTotals: Record<string, { total: number; count: number }> = {}
    for (const sess of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analysis = (sess as any).analysis
      const score = Number(analysis?.dqs?.score)
      if (Number.isFinite(score) && score > 0) {
        dqsTotal += score
        dqsCount++
        if (Array.isArray(analysis?.dqs?.factors)) {
          for (const f of analysis.dqs.factors) {
            const fScore = Number(f?.score)
            if (!f?.name || !Number.isFinite(fScore)) continue
            if (!factorTotals[f.name]) factorTotals[f.name] = { total: 0, count: 0 }
            factorTotals[f.name].total += fScore
            factorTotals[f.name].count++
          }
        }
      }
    }
    dqsScore = dqsCount > 0 ? Math.round(dqsTotal / dqsCount) : 0
    dqsFactors = Object.entries(factorTotals).map(([name, v]) => ({
      name,
      score: Math.round(v.total / v.count),
    }))

    // Aggregate the most recent analysis grade (A/B/C/D/F) and subScores.
    let dqsGrade: string | null = null
    const dqsSubScores: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestAnalysedSession: any = sessions.find((s: any) => {
      const sc = Number(s?.analysis?.dqs?.score)
      return Number.isFinite(sc) && sc > 0
    })
    if (latestAnalysedSession?.analysis?.dqs?.grade) {
      dqsGrade = String(latestAnalysedSession.analysis.dqs.grade)
    }
    if (dqsFactors.length > 0) {
      for (const f of dqsFactors) dqsSubScores[f.name] = f.score
    }

    // Latest AI coaching note from the most recent analysed session.
    // Fallback chain:
    //   ai_coaching        — canonical top-level field (both legacy and
    //                        Module 2 paths write here via buildAnalysisJSON)
    //   insights.aiCoaching — Module 2 nested field (defensive — bridge
    //                        flattens to top-level today, but keep the
    //                        path in case the bridge is removed later)
    //   coaching            — any older snapshot field
    let latestAiCoaching: string | null = null
    if (latestAnalysedSession?.analysis) {
      const a = latestAnalysedSession.analysis
      const candidate =
        (typeof a.ai_coaching === 'string' && a.ai_coaching) ||
        (typeof a?.insights?.aiCoaching === 'string' && a.insights.aiCoaching) ||
        (typeof a.coaching === 'string' && a.coaching) ||
        null
      if (candidate && candidate.trim().length > 0) {
        latestAiCoaching = candidate.trim()
      }
    }

    // Aggregate patterns from analysis JSONB (new excess-over-baseline costs).
    const patternsByTag: Record<string, { label: string; count: number; cost: number }> = {}
    let patternsTotalCost = 0
    let patternsTotalCount = 0
    for (const sess of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mp = (sess as any)?.analysis?.mistake_patterns
      if (!Array.isArray(mp)) continue
      for (const p of mp) {
        const label = String(p?.name || p?.pattern || '').trim()
        if (!label) continue
        const count = Number(p?.count || 0)
        const cost = Number(p?.cost || 0)
        if (!patternsByTag[label]) patternsByTag[label] = { label, count: 0, cost: 0 }
        patternsByTag[label].count += count
        patternsByTag[label].cost += Math.max(0, cost)
        patternsTotalCount += count
        patternsTotalCost += Math.max(0, cost)
      }
    }
    const patternsByTagArr = Object.values(patternsByTag).sort((a, b) => b.cost - a.cost)

    // Prefer the accurate excess-cost aggregate when available.
    if (patternsTotalCost > 0) {
      totalMistakeCost = patternsTotalCost
    }

    // ── GLOBAL COST CAP: total mistake cost ≤ 85% of gross loss ──
    // Per-session cap exists in patternDetector but cross-session aggregation can still exceed net P&L.
    const globalGrossLoss = Math.abs(allTimeKPIs.totalPnl)
    const maxAllowedGlobalCost = globalGrossLoss * 0.85
    const rawGlobalMistakeCost = totalMistakeCost
    let globalCapFactor = 1
    if (totalMistakeCost > maxAllowedGlobalCost && totalMistakeCost > 0 && globalGrossLoss > 0) {
      globalCapFactor = maxAllowedGlobalCost / totalMistakeCost
      console.warn(`[GLOBAL_CAP] Scaling mistake costs from ${totalMistakeCost} to ${Math.round(maxAllowedGlobalCost)} (factor: ${globalCapFactor.toFixed(3)})`)
      // Scale every tag's cost proportionally
      for (const p of patternsByTagArr) {
        p.cost = Math.round(p.cost * globalCapFactor)
      }
      patternsTotalCost = Math.round(maxAllowedGlobalCost)
      totalMistakeCost = patternsTotalCost
      // Also scale the legacy mistakeTrades array
      for (const m of mistakeTrades) {
        m.cost = Math.round(m.cost * globalCapFactor)
      }
    }

    // Counterfactual: if you hadn't lost money on tagged mistakes, your P&L would be better by |mistake cost|
    // Formula (per audit #12): totalPnl + Math.abs(totalMistakeCost)
    // Note: totalMistakeCost is already a positive sum of absolute losses (see the Math.abs accumulation above).
    const actualAllTimePnl = allTimeKPIs.totalPnl
    const counterfactualPnl = actualAllTimePnl + Math.abs(totalMistakeCost)

    console.log('[COST_VALIDATION]', {
      totalPnl: allTimeKPIs.totalPnl,
      rawMistakeCost: rawGlobalMistakeCost,
      cappedMistakeCost: totalMistakeCost,
      capApplied: globalCapFactor < 1,
      costRatio: globalGrossLoss > 0 ? (totalMistakeCost / globalGrossLoss * 100).toFixed(1) + '%' : 'N/A',
      counterfactualPnl,
    })

    // Best all-time session P&L comes from computeKPIs — do not recompute here.
    const allTimeBestPnl = allTimeKPIs.bestSessionPnl

    // Discipline score: shared formula in computeKPIs module, prefers DQS then falls back to a proxy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sessions rows carry optional dqs_score
    const disciplineScore = computeDisciplineScore(sessions as any, allTimeKPIs)

    const hasMonthData = monthSessions.length > 0

    // Max trades in a single session (for GoalTracking "Max Daily Trades")
    const maxDailyTrades = monthSessions.length > 0
      ? Math.max(...monthSessions.map(s => Number(s.trade_count || 0)))
      : 0

    // Count of revenge trades from pattern data (for GoalTracking)
    const revengeTradeCount = patternsByTagArr
      .filter(p => /revenge/i.test(p.label))
      .reduce((s, p) => s + p.count, 0)

    const responseData = {
      hasData: true,
      hasMonthData,
      pendingAnalysisCount,
      sessionCount: sessions.length,
      totalTrades: sessions.reduce((s, x) => s + (x.trade_count || 0), 0),
      allTime: {
        pnl: allTimeKPIs.totalPnl,
        sessions: sessions.length,
        trades: allTimeKPIs.totalTrades,
        wins: allTimeKPIs.totalWins,
        losses: allTimeKPIs.totalLosses,
        winRate: allTimeKPIs.winRate,
        successRate: allTimeKPIs.successRate,
        bestSessionPnl: allTimeBestPnl,
        bestSessionDate: allTimeKPIs.bestSessionDate,
        worstSessionPnl: allTimeKPIs.worstSessionPnl,
        worstSessionDate: allTimeKPIs.worstSessionDate,
        // Session-level averages (kept for backwards compat)
        avgWinSession: allTimeKPIs.avgWinAmount,
        avgLossSession: allTimeKPIs.avgLossAmount,
        // Per-trade averages (#13) — derived from trades JSONB
        avgWin: allTimeKPIs.avgWin,
        avgLoss: allTimeKPIs.avgLoss,
        winnersCount: allTimeKPIs.winnersCount,
        losersCount: allTimeKPIs.losersCount,
        profitFactor: allTimeKPIs.profitFactor,
        riskReward: String(allTimeKPIs.riskReward),
        maxDrawdown: allTimeKPIs.maxDrawdown,
        disciplineScore,
      },
      month: {
        pnl: monthPnl,
        sessions: monthSessions.length,
        trades: totalTrades,
        wins: totalWins,
        losses: totalLosses,
        winRate: monthKPIs.winRate,
        successRate: monthKPIs.successRate > 0 ? monthKPIs.successRate : allTimeKPIs.successRate,
        successRateScope: monthKPIs.successRate > 0 ? 'month' : 'allTime',
        avgWin: monthKPIs.avgWinAmount,
        avgLoss: monthKPIs.avgLossAmount,
        riskReward: monthKPIs.riskReward > 0 ? String(monthKPIs.riskReward) : String(allTimeKPIs.riskReward),
        riskRewardScope: monthKPIs.riskReward > 0 ? 'month' : 'allTime',
        bestSessionPnl: monthKPIs.bestSessionPnl,
        profitFactor: monthKPIs.profitFactor,
      },
      week: {
        pnl: weekPnl,
        sessions: weekSessions.length,
        trades: weekSessions.reduce((s, x) => s + Number(x.trade_count || 0), 0),
      },
      today: {
        pnl: todayPnl,
        sessions: todaySessions.length,
      },
      maxDailyTrades,
      revengeTradeCount,
      equityCurve,
      streaks: {
        current: currentStreak,
        bestWin: bestWinStreak,
        worstLoss: worstLossStreak,
      },
      risk: {
        maxDrawdown: allTimeKPIs.maxDrawdown,
        avgLossAvgWin: (() => {
          // Prefer trade-level ratio, fall back to session-level, then allTime.
          const tradeAvgWin = monthKPIs.avgWin || allTimeKPIs.avgWin
          const tradeAvgLoss = monthKPIs.avgLoss || allTimeKPIs.avgLoss
          if (tradeAvgWin > 0) return (tradeAvgLoss / tradeAvgWin).toFixed(2)
          // Session-level fallback
          const sessAvgWin = monthKPIs.avgWinAmount || allTimeKPIs.avgWinAmount
          const sessAvgLoss = monthKPIs.avgLossAmount || allTimeKPIs.avgLossAmount
          if (sessAvgWin > 0) return (sessAvgLoss / sessAvgWin).toFixed(2)
          return '0'
        })(),
      },
      recentTrades,
      recentSessions,
      mistakeTrades,
      totalMistakeCost,
      counterfactualPnl,
      actualAllTimePnl,
      actualMonthPnl: monthPnl,
      tradesByTimeDay,
      hasRealTimeData,
      currency,
      detectedMarket: dominantMarket,
      bestTimeSlot,
      dqsScore,
      dqsFactors,
      dqs: {
        overall: dqsScore,
        grade: dqsGrade,
        subScores: dqsSubScores,
      },
      latestAiCoaching,
      patterns: {
        byTag: patternsByTagArr,
        totalMistakeCost: patternsTotalCost,
        totalMistakeCount: patternsTotalCount,
      },
    }

    console.log('[stats] user=%s sessions=%d analysed=%d pending=%d mistakeCost=%d patterns=%d',
      userId, sessions.length, dqsCount, pendingAnalysisCount, totalMistakeCost, patternsByTagArr.length)

    // PATTERN_VALIDATION: detailed logging for pattern detector V2 monitoring
    {
      const totalTrades = sessions.reduce((s, x) => s + (x.trade_count || 0), 0)
      const tagRate = totalTrades > 0 ? patternsTotalCount / totalTrades : 0
      const grossLossAllTime = Math.abs(allTimeKPIs.totalPnl < 0 ? allTimeKPIs.totalPnl : 0)
        + sessions.reduce((s, x) => s + Math.abs(Math.min(0, Number(x.net_pnl) || 0)), 0)
      const costRatio = grossLossAllTime > 0 ? patternsTotalCost / grossLossAllTime : 0
      console.log('[PATTERN_VALIDATION] tagRate=%.2f costRatio=%.2f costExceedsLoss=%s totalMistakeCost=%d grossLoss=%d byTag=%j',
        tagRate, costRatio, costRatio > 0.85 ? 'YES' : 'no', patternsTotalCost, grossLossAllTime,
        patternsByTagArr.map(p => ({ tag: p.label, count: p.count, cost: Math.round(p.cost) })))
    }

    statsCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + 60_000 })
    const statsResponse = NextResponse.json(responseData)

    if (anonId) {
      statsResponse.cookies.set('tradesaath_anon_id', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
    }

    return statsResponse
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json(
      { error: 'Failed to load stats' },
      { status: 500 }
    )
  }
}
