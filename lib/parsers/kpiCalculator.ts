/**
 * KPI Calculator for TradeSaath
 * Calculates performance metrics and time analysis from trades
 */

import { ParsedTrade, ParsedKPIs } from './types';

/* ─── Calculate KPIs ─── */
export function calculateKPIs(trades: ParsedTrade[]): ParsedKPIs {
  if (trades.length === 0) {
    return { net_pnl: 0, total_trades: 0, wins: 0, losses: 0, win_rate: 0, profit_factor: 0, best_trade_pnl: 0, worst_trade_pnl: 0, gross_profit: 0, gross_loss: 0, avg_win: 0, avg_loss: 0, gross_buy_value: 0, gross_sell_value: 0 };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = losses.reduce((s, t) => s + t.pnl, 0);
  const netPnl = grossProfit + grossLoss;

  // Cross P&L: total buy value vs total sell value
  const grossBuyValue = trades.reduce((s, t) => s + (t.entry || 0) * (t.qty || 0), 0);
  const grossSellValue = trades.reduce((s, t) => s + (t.exit || 0) * (t.qty || 0), 0);

  return {
    net_pnl: Math.round(netPnl * 100) / 100,
    total_trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Math.round((wins.length / trades.length) * 10000) / 100,
    profit_factor: grossLoss !== 0 ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100 : wins.length > 0 ? 999 : 0,
    best_trade_pnl: Math.max(...trades.map(t => t.pnl)),
    worst_trade_pnl: Math.min(...trades.map(t => t.pnl)),
    gross_profit: Math.round(grossProfit * 100) / 100,
    gross_loss: Math.round(grossLoss * 100) / 100,
    avg_win: wins.length > 0 ? Math.round((grossProfit / wins.length) * 100) / 100 : 0,
    avg_loss: losses.length > 0 ? Math.round((grossLoss / losses.length) * 100) / 100 : 0,
    gross_buy_value: Math.round(grossBuyValue * 100) / 100,
    gross_sell_value: Math.round(grossSellValue * 100) / 100,
  };
}

/* ─── Time analysis ─── */
export function calculateTimeAnalysis(trades: ParsedTrade[]) {
  const gaps = trades.map(t => t.time_gap_minutes).filter((g): g is number => g !== null && g > 0);
  const times = trades.map(t => {
    const [h, m] = t.time.split(':').map(Number);
    return isNaN(h) ? 0 : h * 60 + (m || 0);
  }).filter(t => t > 0);

  return {
    avg_time_gap_minutes: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
    min_time_gap_minutes: gaps.length > 0 ? Math.min(...gaps) : 0,
    max_time_gap_minutes: gaps.length > 0 ? Math.max(...gaps) : 0,
    trading_duration_minutes: times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0,
  };
}
