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
