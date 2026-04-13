export interface KPISession {
  net_pnl?: number | string | null
  trade_count?: number | string | null
  win_count?: number | string | null
  loss_count?: number | string | null
  win_rate?: number | string | null
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
  worstSessionPnl: number
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
    bestSessionPnl: 0, worstSessionPnl: 0, avgWinAmount: 0, avgLossAmount: 0,
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
  let worstSessionPnl = Infinity
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

    if (pnl > bestSessionPnl) bestSessionPnl = pnl
    if (pnl < worstSessionPnl) worstSessionPnl = pnl

    runningPnl += pnl
    if (runningPnl > peak) peak = runningPnl
    const dd = peak - runningPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const winRate = totalTrades > 0
    ? Math.round((totalWins / totalTrades) * 100)
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
    worstSessionPnl: worstSessionPnl === Infinity ? 0 : worstSessionPnl,
    avgWinAmount: Math.round(avgWinAmount),
    avgLossAmount: Math.round(avgLossAmount),
    riskReward,
    profitFactor,
    maxDrawdown,
  }
}
