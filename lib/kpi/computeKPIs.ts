// SINGLE SOURCE OF TRUTH for every trading KPI.
// Every page (dashboard, journal, coach, chat) and every API route
// must compute metrics through this module. Do not add per-page math.

export interface KPISession {
  net_pnl?: number | string | null
  trade_count?: number | string | null
  win_count?: number | string | null
  loss_count?: number | string | null
  win_rate?: number | string | null
  trade_date?: string | null
  created_at?: string | null
}

export interface KPIResult {
  totalPnl: number
  totalTrades: number
  totalWins: number
  totalLosses: number
  winRate: number
  totalSessions: number
  profitableSessions: number
  successRate: number
  bestSessionPnl: number
  bestSessionDate: string
  worstSessionPnl: number
  worstSessionDate: string
  avgWinAmount: number
  avgLossAmount: number
  riskReward: number
  profitFactor: number
  maxDrawdown: number
}

function defaultKPIs(): KPIResult {
  return {
    totalPnl: 0, totalTrades: 0, totalWins: 0, totalLosses: 0,
    winRate: 0, totalSessions: 0, profitableSessions: 0, successRate: 0,
    bestSessionPnl: 0, bestSessionDate: '',
    worstSessionPnl: 0, worstSessionDate: '',
    avgWinAmount: 0, avgLossAmount: 0,
    riskReward: 0, profitFactor: 0, maxDrawdown: 0,
  }
}

export function computeKPIs(sessions: KPISession[]): KPIResult {
  if (sessions.length === 0) return defaultKPIs()

  let totalPnl = 0
  let totalTrades = 0
  let totalWins = 0
  let totalLosses = 0
  let profitableSessions = 0
  let losingSessions = 0
  let bestSessionPnl = -Infinity
  let bestSessionDate = ''
  let worstSessionPnl = Infinity
  let worstSessionDate = ''
  let totalWinSessionPnl = 0
  let totalLossSessionPnl = 0
  let maxDrawdown = 0
  let runningPnl = 0
  let peak = 0

  for (const s of sessions) {
    const pnl = Number(s.net_pnl) || 0
    const trades = Number(s.trade_count) || 0
    const wins = Number(s.win_count) || 0
    const losses = Number(s.loss_count) || 0
    const dateStr = s.trade_date || (s.created_at ? s.created_at.split('T')[0] : '') || ''

    totalPnl += pnl
    totalTrades += trades
    totalWins += wins
    totalLosses += losses

    if (pnl > 0) {
      profitableSessions++
      totalWinSessionPnl += pnl
    } else if (pnl < 0) {
      losingSessions++
      totalLossSessionPnl += Math.abs(pnl)
    }

    if (pnl > bestSessionPnl) {
      bestSessionPnl = pnl
      bestSessionDate = dateStr
    }
    if (pnl < worstSessionPnl) {
      worstSessionPnl = pnl
      worstSessionDate = dateStr
    }

    runningPnl += pnl
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const winRate = totalTrades > 0
    ? Math.round((totalWins / totalTrades) * 1000) / 10
    : 0

  const successRate = sessions.length > 0
    ? Math.round((profitableSessions / sessions.length) * 100)
    : 0

  const avgWinAmount = profitableSessions > 0
    ? totalWinSessionPnl / profitableSessions
    : 0
  const avgLossAmount = losingSessions > 0
    ? totalLossSessionPnl / losingSessions
    : 0
  const riskReward = avgLossAmount > 0
    ? Math.round((avgWinAmount / avgLossAmount) * 100) / 100
    : 0

  const profitFactor = totalLossSessionPnl > 0
    ? Math.round((totalWinSessionPnl / totalLossSessionPnl) * 100) / 100
    : 0

  return {
    totalPnl,
    totalTrades,
    totalWins,
    totalLosses,
    winRate,
    totalSessions: sessions.length,
    profitableSessions,
    successRate,
    bestSessionPnl: bestSessionPnl === -Infinity ? 0 : bestSessionPnl,
    bestSessionDate,
    worstSessionPnl: worstSessionPnl === Infinity ? 0 : worstSessionPnl,
    worstSessionDate,
    avgWinAmount: Math.round(avgWinAmount),
    avgLossAmount: Math.round(avgLossAmount),
    riskReward,
    profitFactor,
    maxDrawdown,
  }
}

// ---------- Period filtering (single source for week/month/today) ----------

export type Period = 'allTime' | 'thisMonth' | 'thisWeek' | 'today'

/**
 * Filter sessions by trade_date for a given period.
 * Uses trade_date (the actual trading day), never created_at (upload time).
 * Falls back to created_at split only if trade_date is missing.
 */
export function filterByPeriod(sessions: KPISession[], period: Period, now: Date = new Date()): KPISession[] {
  if (period === 'allTime') return sessions

  if (period === 'today') {
    const todayStr = now.toISOString().split('T')[0]
    return sessions.filter(s => s.trade_date === todayStr)
  }

  if (period === 'thisWeek') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return sessions.filter(s => {
      const d = s.trade_date
      return !!d && new Date(d) >= start
    })
  }

  // thisMonth
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return sessions.filter(s => {
    const d = s.trade_date
    return !!d && new Date(d) >= start
  })
}

export interface AllPeriodKPIs {
  allTime: KPIResult
  thisMonth: KPIResult
  thisWeek: KPIResult
  today: KPIResult
}

/**
 * Compute KPIs for every period in one pass. Use this as the
 * canonical entry point when rendering dashboards with multiple time windows.
 */
export function computeAllPeriodKPIs(sessions: KPISession[], now: Date = new Date()): AllPeriodKPIs {
  return {
    allTime: computeKPIs(sessions),
    thisMonth: computeKPIs(filterByPeriod(sessions, 'thisMonth', now)),
    thisWeek: computeKPIs(filterByPeriod(sessions, 'thisWeek', now)),
    today: computeKPIs(filterByPeriod(sessions, 'today', now)),
  }
}

// ---------- Discipline score (unified formula) ----------

/**
 * Discipline score derivation.
 * Preference order:
 *  1. Average of non-zero DQS scores across sessions (the source of truth if AI analysis exists).
 *  2. Rule-based proxy from win-rate + profit-factor so that users with no AI analysis still see something.
 *
 * Returns 0 when there is no data at all.
 */
export function computeDisciplineScore(
  sessions: { dqs_score?: number | null }[],
  kpis: KPIResult,
): number {
  const dqsValues = sessions.map(s => Number(s.dqs_score) || 0).filter(v => v > 0)
  if (dqsValues.length > 0) {
    const avg = dqsValues.reduce((a, b) => a + b, 0) / dqsValues.length
    return Math.round(avg)
  }
  if (kpis.totalSessions === 0) return 0
  // Proxy: weighted blend of win-rate and profit factor
  const wr = Math.min(100, Math.max(0, kpis.winRate))
  const pf = Math.min(3, Math.max(0, kpis.profitFactor))
  const score = wr * 0.6 + (pf / 3) * 100 * 0.4
  return Math.round(score)
}
