/**
 * TradeSaath Intake → Legacy Format Adapter
 * Converts new StandardTrade (camelCase) to the snake_case format
 * expected by detectPatterns, saveTradeSession, and the frontend.
 */

import { StandardTrade, IntakeKPIs, IntakeTimeAnalysis } from './types';

/**
 * Convert a StandardTrade to the legacy ParsedTrade-like shape.
 * detectPatterns accesses: t.time, t.entry_time, t.entry, t.entry_price,
 *   t.price, t.qty, t.pnl, t.symbol, t.side, t.time_gap_minutes, t.cum_pnl
 * Frontend accesses: t.pnl, t.entry, t.exit, t.qty, t.time, t.cum_pnl, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toLegacyTrade(t: StandardTrade): Record<string, any> {
  return {
    // Core fields (same name)
    index: t.index,
    symbol: t.symbol,
    side: t.side,
    qty: t.qty,
    pnl: t.pnl,
    tag: t.tag,
    label: t.label,
    // Price fields — legacy uses entry/exit
    entry: t.entryPrice,
    exit: t.exitPrice,
    entry_price: t.entryPrice,
    exit_price: t.exitPrice,
    price: t.entryPrice,
    // Time fields — legacy uses time, entry_time, exit_time
    time: t.entryTime,
    entry_time: t.entryTime,
    exit_time: t.exitTime,
    // Date
    date: t.date,
    trade_date: t.date,
    // Cumulative P&L — legacy uses cum_pnl, also provide cumPnl
    cum_pnl: t.cumPnl,
    cumPnl: t.cumPnl,
    // Session & timing
    session: t.session,
    time_gap_minutes: t.timeGapMinutes,
    holding_minutes: t.holdingMinutes,
    // Metadata
    exchange: t.exchange,
    trade_id: t.tradeId,
    // Intake-specific fields (pass through)
    sourceRows: t.sourceRows,
    isShort: t.isShort,
    fees: t.fees,
  };
}

/**
 * Convert IntakeKPIs to the legacy ParsedKPIs snake_case shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toLegacyKPIs(k: IntakeKPIs): Record<string, any> {
  return {
    net_pnl: k.netPnl,
    total_trades: k.totalTrades,
    wins: k.wins,
    losses: k.losses,
    win_rate: k.winRate,
    profit_factor: k.profitFactor,
    best_trade_pnl: k.bestTradePnl,
    worst_trade_pnl: k.worstTradePnl,
    gross_profit: k.grossProfit,
    gross_loss: k.grossLoss,
    avg_win: k.avgWin,
    avg_loss: k.avgLoss,
    gross_buy_value: k.grossBuyValue,
    gross_sell_value: k.grossSellValue,
    open_positions: k.openPositions,
    total_fees: k.totalFees,
  };
}

/**
 * Convert IntakeTimeAnalysis to the legacy snake_case shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toLegacyTimeAnalysis(ta: IntakeTimeAnalysis): Record<string, any> {
  return {
    avg_time_gap_minutes: ta.avgTimeGapMinutes,
    min_time_gap_minutes: ta.minTimeGapMinutes,
    max_time_gap_minutes: ta.maxTimeGapMinutes,
    trading_duration_minutes: ta.tradingDurationMinutes,
  };
}
