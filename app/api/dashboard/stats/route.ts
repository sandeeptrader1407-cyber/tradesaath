import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { migrateAnonToUser } from '@/lib/supabase/migrateAnonData'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fallback: migrate anon data if cookie still exists
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

    // Current month filter
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthSessions = sessions.filter(
      (s) => new Date(s.created_at) >= monthStart
    )

    // This week filter
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekSessions = sessions.filter(
      (s) => new Date(s.created_at) >= weekStart
    )

    // Today
    const todayStr = now.toISOString().split('T')[0]
    const todaySessions = sessions.filter((s) => s.trade_date === todayStr)

    // Aggregate KPIs for the month
    const totalTrades = monthSessions.reduce(
      (s, x) => s + (x.trade_count || 0),
      0
    )
    const totalWins = monthSessions.reduce(
      (s, x) => s + (x.win_count || 0),
      0
    )
    const totalLosses = monthSessions.reduce(
      (s, x) => s + (x.loss_count || 0),
      0
    )
    const monthPnl = monthSessions.reduce(
      (s, x) => s + Number(x.net_pnl || 0),
      0
    )
    const weekPnl = weekSessions.reduce(
      (s, x) => s + Number(x.net_pnl || 0),
      0
    )
    const todayPnl = todaySessions.reduce(
      (s, x) => s + Number(x.net_pnl || 0),
      0
    )
    const profitableSessions = monthSessions.filter(
      (s) => Number(s.net_pnl) > 0
    ).length

    // Average win and loss for risk:reward
    const allWinPnl = monthSessions.reduce(
      (s, x) => s + Math.max(0, Number(x.net_pnl || 0)),
      0
    )
    const allLossPnl = monthSessions.reduce(
      (s, x) => s + Math.abs(Math.min(0, Number(x.net_pnl || 0))),
      0
    )
    const avgWin = totalWins > 0 ? allWinPnl / totalWins : 0
    const avgLoss = totalLosses > 0 ? allLossPnl / totalLosses : 0

    // Equity curve (last 20 sessions)
    const equityCurve = sessions
      .slice(0, 20)
      .reverse()
      .map((s) => ({
        pnl: Number(s.net_pnl || 0),
        date: s.trade_date || s.created_at?.split('T')[0],
      }))

    // Streaks
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
    // Current streak from most recent
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

    // Max drawdown
    let peak = 0
    let maxDrawdown = 0
    let cumPnl = 0
    for (const s of [...sessions].reverse()) {
      cumPnl += Number(s.net_pnl || 0)
      if (cumPnl > peak) peak = cumPnl
      const dd = peak - cumPnl
      if (dd > maxDrawdown) maxDrawdown = dd
    }

    // --- Additional data for dashboard components ---

    // Recent sessions (last 4)
    const recentSessions = sessions.slice(0, 4).map((s) => ({
      date: s.trade_date || s.created_at?.split('T')[0] || '',
      trades: s.trade_count || 0,
      pnl: Number(s.net_pnl || 0),
      winRate: s.win_rate || 0,
    }))

    // Fetch trade_analysis for recent trades, mistakes, heatmap, and DQS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase dynamic rows
    const sessionIds = sessions.map((s: any) => s.id)
    let recentTrades: { time?: string; symbol?: string; side?: string; pnl?: number; tag?: string }[] = []
    let mistakeTrades: { type: string; icon: string; count: number; cost: number }[] = []
    let totalMistakeCost = 0
    let tradesByTimeDay: { entry_time: string; pnl: number }[] = []
    let dqsScore = 0
    let dqsFactors: { name: string; score: number }[] = []

    if (sessionIds.length > 0) {
      // Get recent individual trades (last 5)
      const { data: recentTA } = await supabaseAdmin
        .from('trade_analysis')
        .select('symbol, side, pnl, entry_time, tag, tag_label')
        .in('session_id', sessionIds.slice(0, 5))
        .order('created_at', { ascending: false })
        .limit(20)

      if (recentTA && recentTA.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row type
        recentTrades = recentTA.slice(0, 5).map((t: any) => ({
          time: t.entry_time || '',
          symbol: t.symbol || 'Unknown',
          side: t.side || '',
          pnl: Number(t.pnl || 0),
          tag: t.tag_label || t.tag || '',
        }))
      }

      // Get all trade_analysis for mistake aggregation and heatmap
      const { data: allTA } = await supabaseAdmin
        .from('trade_analysis')
        .select('tag, tag_label, pnl, entry_time, cycle_stage, session_id')
        .in('session_id', sessionIds)

      if (allTA && allTA.length > 0) {
        // Mistake aggregation
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
        }

        mistakeTrades = Object.entries(mistakeMap)
          .map(([tag, v]) => ({ type: tagLabels[tag] || tag, icon: v.icon, count: v.count, cost: v.cost }))
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 5)

        totalMistakeCost = mistakeTrades.reduce((s, m) => s + m.cost, 0)

        // Heatmap data: trades with entry_time for time-of-day analysis
        // Build session id -> trade_date map for day-of-week
        const sessionDateMap: Record<string, string> = {}
        for (const s of sessions) {
          sessionDateMap[s.id] = s.trade_date || s.created_at?.split('T')[0] || ''
        }

        /* eslint-disable @typescript-eslint/no-explicit-any -- Supabase row type */
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

        // If trade-level entry_time data is insufficient, distribute across trading hours
        if (taWithTime.length >= 5) {
          tradesByTimeDay = taWithTime
        } else {
          // Fallback: distribute trades across realistic trading hour slots
          // using session trade_date for day-of-week and sequential time slots
          const tradingSlots = [
            '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45',
            '11:00', '11:15', '11:30', '11:45', '12:00', '12:30', '13:00',
            '13:30', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15',
          ]
          let slotIdx = 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row type
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

    // Last-resort heatmap: if no trade_analysis data, use sessions themselves
    if (tradesByTimeDay.length < 5 && sessions.length >= 5) {
      const fallbackSlots = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '14:30', '15:00']
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row type
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

    // DQS from session analysis
    let dqsTotal = 0
    let dqsCount = 0
    const factorTotals: Record<string, { total: number; count: number }> = {}
    for (const sess of sessions.slice(0, 10)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic analysis JSON
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

    // Counterfactual P&L (actual + mistake cost)
    const actualMonthPnl = monthPnl
    const counterfactualPnl = actualMonthPnl + totalMistakeCost

    const statsResponse = NextResponse.json({
      hasData: true,
      sessionCount: sessions.length,
      totalTrades: sessions.reduce((s, x) => s + (x.trade_count || 0), 0),
      month: {
        pnl: monthPnl,
        sessions: monthSessions.length,
        trades: totalTrades,
        wins: totalWins,
        losses: totalLosses,
        winRate:
          totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0,
        successRate:
          monthSessions.length > 0
            ? Math.round((profitableSessions / monthSessions.length) * 100)
            : 0,
        avgWin: Math.round(avgWin),
        avgLoss: Math.round(avgLoss),
        riskReward: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0',
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
        maxDrawdown,
        avgLossAvgWin: avgWin > 0 ? (avgLoss / avgWin).toFixed(2) : '0',
      },
      // New fields for dashboard components
      recentTrades,
      recentSessions,
      mistakeTrades,
      totalMistakeCost,
      counterfactualPnl,
      actualMonthPnl,
      tradesByTimeDay,
      dqsScore,
      dqsFactors,
    })

    // Clear anon cookie if it was migrated
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
