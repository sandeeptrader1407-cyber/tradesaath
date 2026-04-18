/**
 * TradeSaath Trade Validator (Intake Module)
 * Validates StandardTrade[] for common issues and anomalies.
 */

import { StandardTrade } from './types';

export interface ValidationResult {
  warnings: string[];
  /** Trades with issues flagged */
  flaggedIndices: number[];
}

/**
 * Validate an array of paired trades for common data quality issues.
 */
export function validateTrades(trades: StandardTrade[]): ValidationResult {
  const warnings: string[] = [];
  const flaggedIndices: Set<number> = new Set();

  for (const trade of trades) {
    // Negative quantity
    if (trade.qty <= 0) {
      warnings.push(`Trade ${trade.index}: non-positive quantity (${trade.qty})`);
      flaggedIndices.add(trade.index);
    }

    // Zero entry price on a closed trade
    if (trade.entryPrice === 0 && trade.exitPrice !== 0) {
      warnings.push(`Trade ${trade.index}: zero entry price with non-zero exit`);
      flaggedIndices.add(trade.index);
    }

    // Suspiciously large P&L (> 10x entry value)
    const tradeValue = trade.entryPrice * trade.qty;
    if (tradeValue > 0 && Math.abs(trade.pnl) > tradeValue * 10) {
      warnings.push(`Trade ${trade.index}: P&L (${trade.pnl}) exceeds 10x trade value (${tradeValue})`);
      flaggedIndices.add(trade.index);
    }

    // Missing date
    if (!trade.date || trade.date === 'unknown') {
      warnings.push(`Trade ${trade.index}: missing date`);
      flaggedIndices.add(trade.index);
    }

    // Missing time
    if (!trade.entryTime) {
      warnings.push(`Trade ${trade.index}: missing entry time`);
      flaggedIndices.add(trade.index);
    }

    // Holding time > 8 hours (intraday sanity check)
    if (trade.holdingMinutes > 480) {
      warnings.push(`Trade ${trade.index}: holding time ${trade.holdingMinutes} min exceeds 8 hours`);
      flaggedIndices.add(trade.index);
    }

    // Duplicate trade IDs
    if (trade.tradeId) {
      const dupes = trades.filter(t => t.tradeId === trade.tradeId && t.index !== trade.index);
      if (dupes.length > 0 && !flaggedIndices.has(trade.index)) {
        warnings.push(`Trade ${trade.index}: duplicate trade ID "${trade.tradeId}"`);
        flaggedIndices.add(trade.index);
      }
    }
  }

  // Cross-trade checks
  const openCount = trades.filter(t => t.tag === 'open').length;
  if (openCount > 0) {
    warnings.push(`${openCount} trade(s) flagged as open positions (unpaired)`);
  }

  const noTimeCount = trades.filter(t => !t.entryTime).length;
  if (noTimeCount > trades.length * 0.5 && trades.length > 0) {
    warnings.push(`More than 50% of trades (${noTimeCount}/${trades.length}) have no time data`);
  }

  return {
    warnings,
    flaggedIndices: Array.from(flaggedIndices),
  };
}
