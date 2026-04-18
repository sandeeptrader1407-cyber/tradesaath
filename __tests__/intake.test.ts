/**
 * TradeSaath Intake Module Tests
 * Tests the raw-first extraction, pairing, validation, and KPI calculation.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractRawRows, matchColumns, normalizeDate, normalizeTime } from '@/lib/intake/rawExtractor';
import { pairRawTrades } from '@/lib/intake/tradePairer';
import { validateTrades } from '@/lib/intake/tradeValidator';
import { calculateIntakeKPIs, calculateIntakeTimeAnalysis } from '@/lib/intake/kpiCalculator';
import { RawTradeRow } from '@/lib/intake/types';

const FIXTURES = path.join(__dirname, 'fixtures');

/* ═══════════════════════════════════════════
   Section 1: Column Matching
═══════════════════════════════════════════ */
describe('Intake: Column Matching', () => {
  it('matches Zerodha column names', () => {
    const headers = ['tradingsymbol', 'trade_type', 'quantity', 'price', 'order_execution_time'];
    const mapping = matchColumns(headers);
    expect(mapping['tradingsymbol']).toBe('symbol');
    expect(mapping['trade_type']).toBe('side');
    expect(mapping['quantity']).toBe('qty');
    expect(mapping['price']).toBe('price');
    expect(mapping['order_execution_time']).toBe('time');
  });

  it('matches Angel One column names', () => {
    const headers = ['scripname', 'buy/sell', 'qty', 'price', 'trade date', 'net amount'];
    const mapping = matchColumns(headers);
    expect(mapping['scripname']).toBe('symbol');
    expect(mapping['buy/sell']).toBe('side');
    expect(mapping['qty']).toBe('qty');
    expect(mapping['trade date']).toBe('date');
  });

  it('matches IBKR column names', () => {
    const headers = ['Symbol', 'Side', 'Quantity', 'Price', 'Date', 'Time', 'Exchange'];
    const mapping = matchColumns(headers);
    expect(mapping['Symbol']).toBe('symbol');
    expect(mapping['Side']).toBe('side');
    expect(mapping['Quantity']).toBe('qty');
    expect(mapping['Exchange']).toBe('exchange');
  });
});

/* ═══════════════════════════════════════════
   Section 2: Date and Time Normalization
═══════════════════════════════════════════ */
describe('Intake: Normalization', () => {
  it('normalizes YYYY-MM-DD dates', () => {
    expect(normalizeDate('2024-03-01')).toBe('2024-03-01');
    expect(normalizeDate('2024/03/01')).toBe('2024-03-01');
  });

  it('normalizes DD-MM-YYYY dates', () => {
    expect(normalizeDate('01-03-2024')).toBe('2024-03-01');
    expect(normalizeDate('15/12/2023')).toBe('2023-12-15');
  });

  it('normalizes named month dates', () => {
    expect(normalizeDate('5 Jan 2024')).toBe('2024-01-05');
    expect(normalizeDate('15 December 2023')).toBe('2023-12-15');
  });

  it('normalizes time strings', () => {
    expect(normalizeTime('9:16')).toBe('09:16');
    expect(normalizeTime('09:16:32')).toBe('09:16');
    expect(normalizeTime('2024-03-01 09:16:32')).toBe('09:16');
  });
});

/* ═══════════════════════════════════════════
   Section 3: Raw Extraction
═══════════════════════════════════════════ */
describe('Intake: Raw Extraction', () => {
  it('extracts raw rows from Zerodha CSV', () => {
    const headers = ['tradingsymbol', 'trade_type', 'quantity', 'price', 'order_execution_time'];
    const dataRows = [
      ['NIFTY2430118000CE', 'BUY', '75', '185.50', '2024-03-01 09:16:32'],
      ['NIFTY2430118000CE', 'SELL', '75', '210.30', '2024-03-01 09:32:15'],
    ];
    const { rows, columnMapping, warnings } = extractRawRows(headers, dataRows);

    expect(rows).toHaveLength(2);
    expect(rows[0].rowIndex).toBe(0);
    expect(rows[0].mapped.symbol).toBe('NIFTY2430118000CE');
    expect(rows[0].mapped.side).toBe('BUY');
    expect(rows[0].mapped.qty).toBe('75');
    expect(rows[0].mapped.price).toBe('185.50');
    expect(rows[0].mapped.time).toBe('2024-03-01 09:16:32');
    // Raw should preserve original
    expect(rows[0].raw['tradingsymbol']).toBe('NIFTY2430118000CE');
    expect(columnMapping['tradingsymbol']).toBe('symbol');
  });

  it('preserves ALL original column values in raw', () => {
    const headers = ['symbol', 'side', 'qty', 'price', 'exchange', 'trade_id', 'random_field'];
    const dataRows = [
      ['NIFTY', 'BUY', '75', '100', 'NSE', 'T001', 'extra_data'],
    ];
    const { rows } = extractRawRows(headers, dataRows);
    expect(rows[0].raw['random_field']).toBe('extra_data');
    expect(rows[0].raw['exchange']).toBe('NSE');
    expect(rows[0].raw['trade_id']).toBe('T001');
    expect(rows[0].mapped.exchange).toBe('NSE');
    expect(rows[0].mapped.tradeId).toBe('T001');
  });

  it('skips summary/total rows', () => {
    const headers = ['symbol', 'side', 'qty', 'price'];
    const dataRows = [
      ['NIFTY', 'BUY', '75', '100'],
      ['Total', '', '', '100'],
      ['Grand Total', '', '', '200'],
    ];
    const { rows } = extractRawRows(headers, dataRows);
    expect(rows).toHaveLength(1);
  });

  it('infers side from buyQty/sellQty', () => {
    const headers = ['symbol', 'buy_qty', 'sell_qty', 'price'];
    const dataRows = [
      ['NIFTY', '75', '', '100'],
      ['NIFTY', '', '75', '110'],
    ];
    const { rows } = extractRawRows(headers, dataRows);
    expect(rows[0].mapped.side).toBe('BUY');
    expect(rows[1].mapped.side).toBe('SELL');
  });

  it('extracts date from datetime time field', () => {
    const headers = ['symbol', 'side', 'qty', 'price', 'order_execution_time'];
    const dataRows = [
      ['NIFTY', 'BUY', '75', '100', '2024-03-01 09:16:32'],
    ];
    const { rows } = extractRawRows(headers, dataRows);
    // Date should be extracted from the time field
    expect(rows[0].mapped.date).toBe('2024-03-01');
  });
});

/* ═══════════════════════════════════════════
   Section 4: Trade Pairing
═══════════════════════════════════════════ */
describe('Intake: Trade Pairing', () => {
  function makeRawRow(overrides: Partial<RawTradeRow['mapped']> & { rowIndex?: number }): RawTradeRow {
    const { rowIndex = 0, ...mapped } = overrides;
    return {
      rowIndex,
      raw: {},
      mapped: {
        symbol: 'NIFTY',
        side: 'BUY',
        qty: '75',
        price: '100',
        date: '2024-03-01',
        time: '09:15',
        ...mapped,
      },
      columnMapping: {},
      warnings: [],
    };
  }

  it('pairs buy and sell into a single trade', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', price: '100', time: '09:15' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', price: '110', time: '09:30' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(1);
    expect(trades[0].side).toBe('BUY');
    expect(trades[0].entryPrice).toBe(100);
    expect(trades[0].exitPrice).toBe(110);
    expect(trades[0].pnl).toBe(750); // (110 - 100) * 75
    expect(trades[0].tag).toBe('win');
    expect(trades[0].sourceRows).toContain(0);
    expect(trades[0].sourceRows).toContain(1);
    expect(trades[0].isShort).toBe(false);
  });

  it('detects and handles short trades', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'SELL', price: '245.50', time: '09:22' }),
      makeRawRow({ rowIndex: 1, side: 'BUY', price: '220.30', time: '09:48' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(1);
    expect(trades[0].side).toBe('SELL');
    expect(trades[0].isShort).toBe(true);
    // Short P&L = (entry - exit) * qty = (245.50 - 220.30) * 75 = 1890
    expect(trades[0].pnl).toBe(1890);
    expect(trades[0].tag).toBe('win');
  });

  it('does NOT pair trades across different dates', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', price: '100', date: '2024-03-01', time: '09:15' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', price: '110', date: '2024-03-02', time: '09:30' }),
    ];
    const trades = pairRawTrades(rows);
    // Should be 2 unpaired trades, not 1 paired
    expect(trades).toHaveLength(2);
    expect(trades.some(t => t.tag === 'open')).toBe(true);
  });

  it('handles partial fills with FIFO', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', qty: '150', price: '100', time: '09:15' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', qty: '75', price: '110', time: '09:30' }),
      makeRawRow({ rowIndex: 2, side: 'SELL', qty: '75', price: '105', time: '09:45' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(2);
    expect(trades[0].qty).toBe(75);
    expect(trades[0].pnl).toBe(750);   // (110-100)*75
    expect(trades[1].qty).toBe(75);
    expect(trades[1].pnl).toBe(375);   // (105-100)*75
  });

  it('flags open positions when unpaired', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', price: '100', time: '09:15' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(1);
    expect(trades[0].tag).toBe('open');
    expect(trades[0].label).toBe('Open Position');
    expect(trades[0].exitPrice).toBe(0);
  });

  it('calculates cumulative P&L across trades', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, symbol: 'NIFTY', side: 'BUY', price: '100', time: '09:15' }),
      makeRawRow({ rowIndex: 1, symbol: 'NIFTY', side: 'SELL', price: '110', time: '09:30' }),
      makeRawRow({ rowIndex: 2, symbol: 'BANKNIFTY', side: 'BUY', price: '200', time: '10:00' }),
      makeRawRow({ rowIndex: 3, symbol: 'BANKNIFTY', side: 'SELL', price: '190', time: '10:15' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(2);
    // First trade: +750
    // Second trade: (190-200)*75 = -750
    expect(trades[0].cumPnl).toBe(750);
    expect(trades[1].cumPnl).toBe(0); // 750 + (-750)
  });

  it('preserves entry and exit times', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', price: '100', time: '09:15' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', price: '110', time: '09:30' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades[0].entryTime).toBe('09:15');
    expect(trades[0].exitTime).toBe('09:30');
    expect(trades[0].holdingMinutes).toBe(15);
  });
});

/* ═══════════════════════════════════════════
   Section 5: Validation
═══════════════════════════════════════════ */
describe('Intake: Validation', () => {
  it('warns about open positions', () => {
    const trades = [{
      index: 0, symbol: 'NIFTY', side: 'BUY' as const, qty: 75,
      entryPrice: 100, exitPrice: 0, pnl: 0, cumPnl: 0,
      date: '2024-03-01', entryTime: '09:15', exitTime: '',
      holdingMinutes: 0, session: 'morning', timeGapMinutes: null,
      tag: 'open', label: 'Open Position', exchange: '', tradeId: '',
      sourceRows: [0], isShort: false,
    }];
    const result = validateTrades(trades);
    expect(result.warnings.some(w => w.includes('open positions'))).toBe(true);
  });

  it('warns about suspiciously large P&L', () => {
    const trades = [{
      index: 0, symbol: 'NIFTY', side: 'BUY' as const, qty: 75,
      entryPrice: 100, exitPrice: 200, pnl: 100000, cumPnl: 100000,
      date: '2024-03-01', entryTime: '09:15', exitTime: '09:30',
      holdingMinutes: 15, session: 'morning', timeGapMinutes: null,
      tag: 'win', label: 'Winner', exchange: '', tradeId: '',
      sourceRows: [0, 1], isShort: false,
    }];
    const result = validateTrades(trades);
    expect(result.warnings.some(w => w.includes('10x trade value'))).toBe(true);
  });
});

/* ═══════════════════════════════════════════
   Section 6: KPI Calculation
═══════════════════════════════════════════ */
describe('Intake: KPI Calculation', () => {
  it('computes correct KPIs', () => {
    const trades = [
      {
        index: 0, symbol: 'A', side: 'BUY' as const, qty: 75,
        entryPrice: 100, exitPrice: 110, pnl: 750, cumPnl: 750,
        date: '2024-03-01', entryTime: '09:15', exitTime: '09:30',
        holdingMinutes: 15, session: 'morning', timeGapMinutes: null,
        tag: 'win', label: 'Winner', exchange: '', tradeId: '',
        sourceRows: [0, 1], isShort: false,
      },
      {
        index: 1, symbol: 'B', side: 'BUY' as const, qty: 75,
        entryPrice: 200, exitPrice: 190, pnl: -750, cumPnl: 0,
        date: '2024-03-01', entryTime: '10:00', exitTime: '10:15',
        holdingMinutes: 15, session: 'morning', timeGapMinutes: 30,
        tag: 'loss', label: 'Loser', exchange: '', tradeId: '',
        sourceRows: [2, 3], isShort: false,
      },
    ];
    const kpis = calculateIntakeKPIs(trades);
    expect(kpis.totalTrades).toBe(2);
    expect(kpis.wins).toBe(1);
    expect(kpis.losses).toBe(1);
    expect(kpis.netPnl).toBe(0);
    expect(kpis.winRate).toBe(50);
    expect(kpis.profitFactor).toBe(1);
    expect(kpis.bestTradePnl).toBe(750);
    expect(kpis.worstTradePnl).toBe(-750);
  });

  it('returns zeros for empty trades', () => {
    const kpis = calculateIntakeKPIs([]);
    expect(kpis.totalTrades).toBe(0);
    expect(kpis.netPnl).toBe(0);
    expect(kpis.winRate).toBe(0);
  });
});

/* ═══════════════════════════════════════════
   Section 7: End-to-end with fixture
═══════════════════════════════════════════ */
describe('Intake: End-to-end fixture', () => {
  it('processes zerodha-single-day.csv correctly', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'zerodha-single-day.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows } = extractRawRows(headers, dataRows);
    expect(rows.length).toBe(16); // 16 data rows

    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(8); // 8 paired trades (16 rows / 2)

    // All trades should have source rows
    for (const t of trades) {
      expect(t.sourceRows.length).toBeGreaterThanOrEqual(2);
    }

    const kpis = calculateIntakeKPIs(trades);
    expect(kpis.totalTrades).toBe(8);
    expect(kpis.wins + kpis.losses).toBe(8);

    // Validate
    const validation = validateTrades(trades);
    expect(validation.flaggedIndices.length).toBe(0); // No flags expected on clean data
  });

  it('processes short-trades.csv correctly', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'short-trades.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows } = extractRawRows(headers, dataRows);
    const trades = pairRawTrades(rows);

    // Should have 3 paired trades (6 rows / 2)
    expect(trades.length).toBe(3);

    // First group: NIFTY 24500 CE — SELL@245.50, BUY@220.30 => short win
    const ce1 = trades.find(t => t.symbol?.includes('24500') && t.entryPrice === 245.5);
    expect(ce1).toBeDefined();
    expect(ce1!.isShort).toBe(true);
    expect(ce1!.pnl).toBeGreaterThan(0); // (245.50 - 220.30) * 75 = 1890

    // NIFTY 24600 PE — SELL@198, BUY@210.50 => short loss
    const pe = trades.find(t => t.symbol?.includes('24600'));
    expect(pe).toBeDefined();
    expect(pe!.isShort).toBe(true);
    expect(pe!.pnl).toBeLessThan(0); // (198 - 210.50) * 150 = -1875
  });
});
