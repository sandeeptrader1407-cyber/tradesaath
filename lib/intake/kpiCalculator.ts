/**
 * TradeSaath KPI Calculator (Intake Module)
 * Computes IntakeKPIs and IntakeTimeAnalysis from StandardTrade[].
 */

import { StandardTrade, IntakeKPIs, IntakeTimeAnalysis } from './types';

/** Calculate KPIs from StandardTrade[] */
export function calculateIntakeKPIs(trades: StandardTrade[]): IntakeKPIs {
  if (trades.length === 0) {
    return {
      netPnl: 0, totalTrades: 0, wins: 0, losses: 0, winRate: 0,
      profitFactor: 0, bestTradePnl: 0, worstTradePnl: 0,
      grossProfit: 0, grossLoss: 0, avgWin: 0, avgLoss: 0,
      grossBuyValue: 0, grossSellValue: 0, openPositions: 0, totalFees: 0,
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const openPositions = trades.filter(t => t.tag === 'open').length;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = losses.reduce((s, t) => s + t.pnl, 0);
  const netPnl = grossProfit + grossLoss;

  const grossBuyValue = trades.reduce((s, t) => s + (t.entryPrice || 0) * (t.qty || 0), 0);
  const grossSellValue = trades.reduce((s, t) => s + (t.exitPrice || 0) * (t.qty || 0), 0);
  const totalFees = trades.reduce((s, t) => s + (t.fees || 0), 0);

  return {
    netPnl: Math.round(netPnl * 100) / 100,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round((wins.length / trades.length) * 10000) / 100,
    profitFactor: grossLoss !== 0
      ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100
      : wins.length > 0 ? 999 : 0,
    bestTradePnl: Math.max(...trades.map(t => t.pnl)),
    worstTradePnl: Math.min(...trades.map(t => t.pnl)),
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    avgWin: wins.length > 0 ? Math.round((grossProfit / wins.length) * 100) / 100 : 0,
    avgLoss: losses.length > 0 ? Math.round((grossLoss / losses.length) * 100) / 100 : 0,
    grossBuyValue: Math.round(grossBuyValue * 100) / 100,
    grossSellValue: Math.round(grossSellValue * 100) / 100,
    openPositions,
    totalFees: Math.round(totalFees * 100) / 100,
  };
}

/** Calculate time analysis from StandardTrade[] */
export function calculateIntakeTimeAnalysis(trades: StandardTrade[]): IntakeTimeAnalysis {
  const gaps = trades.map(t => t.timeGapMinutes).filter((g): g is number => g !== null && g > 0);
  const times = trades.map(t => {
    const [h, m] = t.entryTime.split(':').map(Number);
    return isNaN(h) ? 0 : h * 60 + (m || 0);
  }).filter(t => t > 0);

  return {
    avgTimeGapMinutes: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
    minTimeGapMinutes: gaps.length > 0 ? Math.min(...gaps) : 0,
    maxTimeGapMinutes: gaps.length > 0 ? Math.max(...gaps) : 0,
    tradingDurationMinutes: times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0,
  };
}
