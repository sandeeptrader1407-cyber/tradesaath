/**
 * TradeSaath Trade Validator (Intake Module)
 * Validates StandardTrade[] for common issues and anomalies.
 */

import { StandardTrade, IntakeErrorCode } from './types';

export interface ValidationResult {
  warnings: string[];
  /** Trades with issues flagged */
  flaggedIndices: number[];
  /** Critical issue that should fail the upload (orderbook detected,
   *  missing-time export, etc.). Caller is expected to short-circuit
   *  the pipeline and surface this to the user instead of producing a
   *  zero-P&L session. */
  criticalError?: { code: IntakeErrorCode; message: string };
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

  // Detect unreadable symbol / date columns. A "bad" symbol is empty,
  // literally "unknown", or purely numeric (e.g. FYERS exchange-segment
  // IDs like "19" come through when the broker file's symbol column
  // didn't get mapped). A "bad" date is empty or "unknown".
  const badSymbolCount = trades.filter(t => {
    const s = (t.symbol ?? '').trim()
    return s === '' || s.toLowerCase() === 'unknown' || /^[0-9]+$/.test(s)
  }).length;
  const badDateCount = trades.filter(t => {
    const d = (t.date ?? '').trim()
    return d === '' || d.toLowerCase() === 'unknown'
  }).length;

  // Hard-reject thresholds: the user uploaded a file we cannot analyse.
  // Returning a zero-P&L (or numeric-symbol-named) session is a worse
  // UX than a clear error. Priority order:
  //   1. MISSING_SYMBOL_OR_DATE — data is fundamentally unreadable
  //   2. LIKELY_ORDERBOOK — shape mismatch (order book vs trade book)
  //   3. MISSING_TIME_DATA — daily-summary export, no per-trade times
  let criticalError: { code: IntakeErrorCode; message: string } | undefined
  if (
    trades.length > 0 &&
    (badSymbolCount / trades.length >= 0.5 || badDateCount / trades.length >= 0.5)
  ) {
    const worst = Math.max(badSymbolCount, badDateCount)
    const which = badSymbolCount >= badDateCount ? 'symbol' : 'date'
    criticalError = {
      code: 'MISSING_SYMBOL_OR_DATE',
      message: `${worst} of ${trades.length} trades have an unreadable ${which}. The broker export is missing required columns.`,
    }
  } else if (trades.length > 0 && openCount / trades.length >= 0.5) {
    criticalError = {
      code: 'LIKELY_ORDERBOOK',
      message: `${openCount} of ${trades.length} trades are unpaired (no exit). This file looks like an order book, not a trade book.`,
    }
  } else if (trades.length > 0 && noTimeCount / trades.length >= 0.5) {
    criticalError = {
      code: 'MISSING_TIME_DATA',
      message: `${noTimeCount} of ${trades.length} trades have no entry timestamp. The file is missing time data needed for analysis.`,
    }
  }

  return {
    warnings,
    flaggedIndices: Array.from(flaggedIndices),
    criticalError,
  };
}
