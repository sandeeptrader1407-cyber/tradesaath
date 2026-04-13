import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { migrateAnonToUser } from '@/lib/supabase/migrateAnonData'

import { statsCache } from '@/lib/dashboardCache'
import { computeKPIs } from '@/lib/kpi/computeKPIs'

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
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        hasData: false,
        sessionCount: 0,
        totalTrades: 0,
      })
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthSessions = sessions.filter(
      (s) => new Date(s.created_at) >= monthStart
    )
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekSessions = sessions.filter(
      (s) => new Date(s.created_at) >= weekStart
    )
    const todayStr = now.toISOString().split('T')[0]
    const todaySessions = sessions.filter((s) => s.trade_date === todayStr)

    const monthKPIs = computeKPIs(monthSessions)
    const allTimeKPIs = computeKPIs(sessions)

    const totalTrades = monthKPIs.totalTrades
    const totalWins = monthKPIs.totalWins
    const totalLosses = monthKPIs.totalLosses
    const monthPnl = monthKPIs.totalPnl
    const weekPnl = weekSessions.reduce(
      (s, x) => s + Number(x.net_pnl || 0),
      0
    )
    const todayPnl = todaySessions.reduce(
      (s, x) => s + Number(x.net_pnl || 0),
      0
    )

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
          loss: 'Taking Losses Poorly', hope: 'Hope Trading', tilt: 'On Tilt',
          over: 'Overtrading', hold: 'Holding Losers', cut: 'Cutting Winners Early',
        }

        mistakeTrades = Object.entries(mistakeMap)
          .map(([tag, v]) => ({ type: tagLabels[tag] || tag, icon: v.icon, count: v.count, cost: v.cost }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 5)

        totalMistakeCost = mistakeTrades.reduce((s, m) => s + m.cost, 0)

        const sessionDateMap: Record<string, string> = {}
        for (const s of sessions) {
          sessionDateMap[s.id] = s.trade_date || s.created_at?.split('T')[0] || ''
        }

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const taWithTime = allTA
          .filter((t: any) => t.entry_time)
          .map((t: any) => {
            const timeStr = t.entry_time as string
            const dateStr = sessionDateMap[t.session_id] || ''
            let fullTime = timeStr
            if (/^\d{1,2}:\d{2}$/.test(timeStr) && dateStr) {
              fullTime = `${dateStr}T${timeStr.padStart(5, '0')}:00`
            }
            return {
              entry_time: fullTime,
              pnl: Number(t.pnl || 0),
            }
          })
        /* eslint-enable @typescript-eslint/no-explicit-any */

        if (taWithTime.length >= 5) {
          tradesByTimeDay = taWithTime
        } else {
          const tradingSlots = [
            '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45',
            '11:00', '11:15', '11:30', '11:45', '12:00', '12:30', '13:00',
            '13:30', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15',
          ]
          let slotIdx = 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tradesByTimeDay = allTA.map((t: any) => {
            const sessionDate = sessionDateMap[t.session_id] || ''
            if (!sessionDate) return null
            const slot = tradingSlots[slotIdx % tradingSlots.length]
            slotIdx++
            return {
              entry_time: `${sessionDate}T${slot}:00`,
              pnl: Number(t.pnl || 0),
            }
          }).filter((t): t is { entry_time: string; pnl: number } => t !== null)
        }
      }
    }

    if (tradesByTimeDay.length < 5) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const sessionDateMap2: Record<string, string> = {}
      for (const s of sessions) {
        sessionDateMap2[s.id] = s.trade_date || s.created_at?.split('T')[0] || ''
      }
      const jsonbTrades: { entry_time: string; pnl: number }[] = []
      for (const sess of sessions) {
        const trades = (sess as any).trades
        if (!Array.isArray(trades)) continue
        const dateStr = sessionDateMap2[sess.id]
        if (!dateStr) continue
        for (const t of trades) {
          const timeStr = t.entry_time || t.time || ''
          if (!timeStr) continue
          let fullTime = timeStr
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
            const parts = timeStr.split(':')
            const hh = parts[0].padStart(2, '0')
            const mm = (parts[1] || '00').padStart(2, '0')
            fullTime = `${dateStr}T${hh}:${mm}:00`
          }
          jsonbTrades.push({ entry_time: fullTime, pnl: Number(t.pnl || 0) })
        }
      }
      if (jsonbTrades.length >= 5) tradesByTimeDay = jsonbTrades
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    if (tradesByTimeDay.length < 5 && sessions.length >= 5) {
      const fallbackSlots = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '14:30', '15:00']
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tradesByTimeDay = sessions.map((s: any, i: number) => {
        const dateStr = s.trade_date || s.created_at?.split('T')[0] || ''
        if (!dateStr) return null
        const slot = fallbackSlots[i % fallbackSlots.length]
        return {
          entry_time: `${dateStr}T${slot}:00`,
          pnl: Number(s.net_pnl || 0),
        }
      }).filter((t): t is { entry_time: string; pnl: number } => t !== null)
    }

    let dqsTotal = 0
    let dqsCount = 0
    const factorTotals: Record<string, { total: number; count: number }> = {}
    for (const sess of sessions.slice(0, 10)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analysis = (sess as any).analysis
      if (analysis?.dqs?.score) {
        dqsTotal += analysis.dqs.score
        dqsCount++
        if (analysis.dqs.factors) {
          for (const f of analysis.dqs.factors) {
            if (!factorTotals[f.name]) factorTotals[f.name] = { total: 0, count: 0 }
            factorTotals[f.name].total += f.score
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

    const actualMonthPnl = monthPnl
    const counterfactualPnl = actualMonthPnl + totalMistakeCost

    const responseData = {
      hasData: true,
      sessionCount: sessions.length,
      totalTrades: sessions.reduce((s, x) => s + (x.trade_count || 0), 0),
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
        trades: weekSessions.reduce((s, x) => s + (x.trade_count || 0), 0),
      },
      today: {
        pnl: todayPnl,
        sessions: todaySessions.length,
      },
      equityCurve,
      streaks: {
        current: currentStreak,
        bestWin: bestWinStreak,
        worstLoss: worstLossStreak,
      },
      risk: {
        maxDrawdown: allTimeKPIs.maxDrawdown,
        avgLossAvgWin: monthKPIs.avgWinAmount > 0 ? (monthKPIs.avgLossAmount / monthKPIs.avgWinAmount).toFixed(2) : '0',
      },
      recentTrades,
      recentSessions,
      mistakeTrades,
      totalMistakeCost,
      counterfactualPnl,
      actualMonthPnl,
      tradesByTimeDay,
      dqsScore,
      dqsFactors,
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
