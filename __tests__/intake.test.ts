/**
 * TradeSaath Intake Module Tests
 * Tests raw-first extraction, universal parsing, pairing, validation, KPIs.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractRawRows, matchColumns, normalizeDate, normalizeTime,
  cleanNumeric, computeConfidence, detectHeaderRow,
} from '@/lib/intake/rawExtractor';
import { pairRawTrades } from '@/lib/intake/tradePairer';
import { validateTrades } from '@/lib/intake/tradeValidator';
import { calculateIntakeKPIs, calculateIntakeTimeAnalysis } from '@/lib/intake/kpiCalculator';
import { RawTradeRow } from '@/lib/intake/types';

const FIXTURES = path.join(__dirname, 'fixtures');

/* ═══════════════════════════════════════════
   Section 1: Column Matching (3-tier)
═══════════════════════════════════════════ */
describe('Intake: Column Matching', () => {
  it('matches Zerodha column names (exact)', () => {
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

  it('matches unknown Indian broker columns via contains/fuzzy', () => {
    const headers = ['Scrip Name', 'Transaction Type', 'No of Shares', 'Rate', 'Trade Date', 'Trade Time', 'Exchange'];
    const mapping = matchColumns(headers);
    expect(mapping['Scrip Name']).toBe('symbol');
    expect(mapping['Transaction Type']).toBe('side');
    expect(mapping['Rate']).toBe('price');
    expect(mapping['Trade Date']).toBe('date');
    expect(mapping['Trade Time']).toBe('time');
    expect(mapping['Exchange']).toBe('exchange');
  });

  it('matches US broker columns', () => {
    const headers = ['Ticker', 'Action', 'Shares', 'Price Per Share', 'Date of Trade', 'Time of Trade', 'Realized Gain/Loss'];
    const mapping = matchColumns(headers);
    expect(mapping['Ticker']).toBe('symbol');
    expect(mapping['Action']).toBe('side');
    expect(mapping['Date of Trade']).toBe('date');
    expect(mapping['Time of Trade']).toBe('time');
  });

  it('matches crypto exchange columns', () => {
    const headers = ['Trading Pair', 'Order Side', 'Executed Qty', 'Unit Price', 'Date(UTC)', 'Fee'];
    const mapping = matchColumns(headers);
    expect(mapping['Trading Pair']).toBe('symbol');
    expect(mapping['Order Side']).toBe('side');
    expect(mapping['Unit Price']).toBe('price');
    expect(mapping['Fee']).toBe('fees');
  });

  it('matches forex/MT4 columns', () => {
    const headers = ['Deal', 'Symbol', 'Direction', 'Volume', 'Open Price', 'Close Price', 'Profit', 'Commission', 'Swap', 'Time'];
    const mapping = matchColumns(headers);
    expect(mapping['Symbol']).toBe('symbol');
    expect(mapping['Direction']).toBe('side');
    expect(mapping['Volume']).toBe('qty');
    expect(mapping['Commission']).toBe('fees');
    expect(mapping['Profit']).toBe('pnl');
  });

  it('matches fee/commission columns', () => {
    const headers = ['symbol', 'side', 'qty', 'price', 'brokerage'];
    const mapping = matchColumns(headers);
    expect(mapping['brokerage']).toBe('fees');
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

  it('normalizes DD.MM.YYYY (European) dates', () => {
    expect(normalizeDate('15.01.2024')).toBe('2024-01-15');
  });

  it('normalizes named month dates', () => {
    expect(normalizeDate('5 Jan 2024')).toBe('2024-01-05');
    expect(normalizeDate('15 December 2023')).toBe('2023-12-15');
  });

  it('normalizes "Month Day, Year" format', () => {
    expect(normalizeDate('Jan 15, 2024')).toBe('2024-01-15');
    expect(normalizeDate('December 5, 2023')).toBe('2023-12-05');
  });

  it('normalizes YYYYMMDD compact format', () => {
    expect(normalizeDate('20240315')).toBe('2024-03-15');
  });

  it('normalizes ISO 8601 datetime', () => {
    expect(normalizeDate('2024-03-01T09:16:32Z')).toBe('2024-03-01');
    expect(normalizeDate('2024-03-01 09:16:32')).toBe('2024-03-01');
  });

  it('normalizes time strings', () => {
    expect(normalizeTime('9:16')).toBe('09:16');
    expect(normalizeTime('09:16:32')).toBe('09:16');
    expect(normalizeTime('2024-03-01 09:16:32')).toBe('09:16');
  });
});

/* ═══════════════════════════════════════════
   Section 3: Numeric Cleaning
═══════════════════════════════════════════ */
describe('Intake: Numeric Cleaning', () => {
  it('strips currency symbols', () => {
    expect(cleanNumeric('$185.50')).toBe('185.50');
    expect(cleanNumeric('\u20B91550.00')).toBe('1550.00'); // ₹
    expect(cleanNumeric('\u00A3250.75')).toBe('250.75');   // £
    expect(cleanNumeric('\u20AC100.00')).toBe('100.00');   // €
  });

  it('handles accounting negatives (parentheses)', () => {
    expect(cleanNumeric('(3000.00)')).toBe('-3000.00');
    expect(cleanNumeric('(500)')).toBe('-500');
  });

  it('handles European number format', () => {
    expect(cleanNumeric('1.234,56')).toBe('1234.56');
    expect(cleanNumeric('156,75')).toBe('156.75');
  });

  it('handles US/Indian number format', () => {
    expect(cleanNumeric('1,234,567.89')).toBe('1234567.89');
    expect(cleanNumeric('42,500.00')).toBe('42500.00');
  });

  it('handles plain numbers', () => {
    expect(cleanNumeric('185.50')).toBe('185.50');
    expect(cleanNumeric('100')).toBe('100');
    expect(cleanNumeric('-250.75')).toBe('-250.75');
  });
});

/* ═══════════════════════════════════════════
   Section 4: Confidence Scoring
═══════════════════════════════════════════ */
describe('Intake: Confidence Scoring', () => {
  it('gives high confidence when all fields mapped', () => {
    const mapping = { sym: 'symbol', sd: 'side', q: 'qty', p: 'price', d: 'date', t: 'time', pl: 'pnl', ex: 'exchange' };
    const { level, score } = computeConfidence(mapping, 20, true);
    expect(level).toBe('high');
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('gives medium confidence for partial mapping', () => {
    const mapping = { sym: 'symbol', sd: 'side', q: 'qty', p: 'price' };
    const { level, score } = computeConfidence(mapping, 5, false);
    expect(level).toBe('medium');
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThan(85);
  });

  it('gives low confidence when critical fields missing', () => {
    const mapping = { d: 'date', t: 'time' };
    const { level, score } = computeConfidence(mapping, 3, false);
    expect(level).toBe('low');
    expect(score).toBeLessThan(60);
  });
});

/* ═══════════════════════════════════════════
   Section 5: Raw Extraction
═══════════════════════════════════════════ */
describe('Intake: Raw Extraction', () => {
  it('extracts raw rows from Zerodha CSV', () => {
    const headers = ['tradingsymbol', 'trade_type', 'quantity', 'price', 'order_execution_time'];
    const dataRows = [
      ['NIFTY2430118000CE', 'BUY', '75', '185.50', '2024-03-01 09:16:32'],
      ['NIFTY2430118000CE', 'SELL', '75', '210.30', '2024-03-01 09:32:15'],
    ];
    const { rows, columnMapping } = extractRawRows(headers, dataRows);

    expect(rows).toHaveLength(2);
    expect(rows[0].rowIndex).toBe(0);
    expect(rows[0].mapped.symbol).toBe('NIFTY2430118000CE');
    expect(rows[0].mapped.side).toBe('BUY');
    expect(rows[0].mapped.qty).toBe('75');
    expect(rows[0].mapped.price).toBe('185.50');
    expect(rows[0].raw['tradingsymbol']).toBe('NIFTY2430118000CE');
    expect(columnMapping['tradingsymbol']).toBe('symbol');
  });

  it('preserves ALL original column values in raw', () => {
    const headers = ['symbol', 'side', 'qty', 'price', 'exchange', 'trade_id', 'random_field'];
    const dataRows = [['NIFTY', 'BUY', '75', '100', 'NSE', 'T001', 'extra_data']];
    const { rows } = extractRawRows(headers, dataRows);
    expect(rows[0].raw['random_field']).toBe('extra_data');
    expect(rows[0].mapped.exchange).toBe('NSE');
    expect(rows[0].mapped.tradeId).toBe('T001');
  });

  it('skips summary/total rows', () => {
    const headers = ['symbol', 'side', 'qty', 'price'];
    const dataRows = [
      ['NIFTY', 'BUY', '75', '100'],
      ['Total', '', '', '100'],
      ['Grand Total', '', '', '200'],
      ['Average', '', '', '150'],
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

  it('extracts fees/commission', () => {
    const headers = ['symbol', 'side', 'qty', 'price', 'brokerage'];
    const dataRows = [['NIFTY', 'BUY', '75', '100', '25.50']];
    const { rows } = extractRawRows(headers, dataRows);
    expect(rows[0].mapped.fees).toBe('25.50');
  });
});

/* ═══════════════════════════════════════════
   Section 6: Trade Pairing
═══════════════════════════════════════════ */
describe('Intake: Trade Pairing', () => {
  function makeRawRow(overrides: Partial<RawTradeRow['mapped']> & { rowIndex?: number }): RawTradeRow {
    const { rowIndex = 0, ...mapped } = overrides;
    return {
      rowIndex, raw: {},
      mapped: { symbol: 'NIFTY', side: 'BUY', qty: '75', price: '100', date: '2024-03-01', time: '09:15', ...mapped },
      columnMapping: {}, warnings: [],
    };
  }

  it('pairs buy and sell into a single trade', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', price: '100', time: '09:15' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', price: '110', time: '09:30' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(1);
    expect(trades[0].pnl).toBe(750);
    expect(trades[0].sourceRows).toContain(0);
    expect(trades[0].sourceRows).toContain(1);
    expect(trades[0].isShort).toBe(false);
    expect(trades[0].fees).toBe(0);
  });

  it('detects and handles short trades', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'SELL', price: '245.50', time: '09:22' }),
      makeRawRow({ rowIndex: 1, side: 'BUY', price: '220.30', time: '09:48' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades).toHaveLength(1);
    expect(trades[0].isShort).toBe(true);
    expect(trades[0].pnl).toBe(1890);
  });

  it('does NOT pair trades across different dates', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', date: '2024-03-01', time: '09:15' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', date: '2024-03-02', time: '09:30' }),
    ];
    const trades = pairRawTrades(rows);
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
    expect(trades[0].pnl).toBe(750);
    expect(trades[1].pnl).toBe(375);
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

  it('accumulates fees from both legs', () => {
    const rows: RawTradeRow[] = [
      makeRawRow({ rowIndex: 0, side: 'BUY', price: '100', time: '09:15', fees: '10.50' }),
      makeRawRow({ rowIndex: 1, side: 'SELL', price: '110', time: '09:30', fees: '11.25' }),
    ];
    const trades = pairRawTrades(rows);
    expect(trades[0].fees).toBe(21.75);
  });
});

/* ═══════════════════════════════════════════
   Section 7: Validation
═══════════════════════════════════════════ */
describe('Intake: Validation', () => {
  it('warns about open positions', () => {
    const trades = [{
      index: 0, symbol: 'NIFTY', side: 'BUY' as const, qty: 75,
      entryPrice: 100, exitPrice: 0, pnl: 0, cumPnl: 0,
      date: '2024-03-01', entryTime: '09:15', exitTime: '',
      holdingMinutes: 0, session: 'morning', timeGapMinutes: null,
      tag: 'open', label: 'Open Position', exchange: '', tradeId: '',
      sourceRows: [0], isShort: false, fees: 0,
    }];
    const result = validateTrades(trades);
    expect(result.warnings.some(w => w.includes('open positions'))).toBe(true);
  });
});

/* ═══════════════════════════════════════════
   Section 8: KPI Calculation
═══════════════════════════════════════════ */
describe('Intake: KPI Calculation', () => {
  it('computes correct KPIs including fees', () => {
    const trades = [
      {
        index: 0, symbol: 'A', side: 'BUY' as const, qty: 75,
        entryPrice: 100, exitPrice: 110, pnl: 750, cumPnl: 750,
        date: '2024-03-01', entryTime: '09:15', exitTime: '09:30',
        holdingMinutes: 15, session: 'morning', timeGapMinutes: null,
        tag: 'win', label: 'Winner', exchange: '', tradeId: '',
        sourceRows: [0, 1], isShort: false, fees: 25.50,
      },
      {
        index: 1, symbol: 'B', side: 'BUY' as const, qty: 75,
        entryPrice: 200, exitPrice: 190, pnl: -750, cumPnl: 0,
        date: '2024-03-01', entryTime: '10:00', exitTime: '10:15',
        holdingMinutes: 15, session: 'morning', timeGapMinutes: 30,
        tag: 'loss', label: 'Loser', exchange: '', tradeId: '',
        sourceRows: [2, 3], isShort: false, fees: 30.00,
      },
    ];
    const kpis = calculateIntakeKPIs(trades);
    expect(kpis.totalTrades).toBe(2);
    expect(kpis.netPnl).toBe(0);
    expect(kpis.winRate).toBe(50);
    expect(kpis.totalFees).toBe(55.50);
  });

  it('returns zeros for empty trades', () => {
    const kpis = calculateIntakeKPIs([]);
    expect(kpis.totalTrades).toBe(0);
    expect(kpis.totalFees).toBe(0);
  });
});

/* ═══════════════════════════════════════════
   Section 9: End-to-end with existing fixtures
═══════════════════════════════════════════ */
describe('Intake: End-to-end fixture', () => {
  it('processes zerodha-single-day.csv correctly', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'zerodha-single-day.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows } = extractRawRows(headers, dataRows);
    expect(rows.length).toBe(16);

    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(8);
    for (const t of trades) { expect(t.sourceRows.length).toBeGreaterThanOrEqual(2); }

    const kpis = calculateIntakeKPIs(trades);
    expect(kpis.totalTrades).toBe(8);
  });

  it('processes short-trades.csv correctly', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'short-trades.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows } = extractRawRows(headers, dataRows);
    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(3);

    const ce1 = trades.find(t => t.symbol?.includes('24500') && t.entryPrice === 245.5);
    expect(ce1).toBeDefined();
    expect(ce1!.isShort).toBe(true);
    expect(ce1!.pnl).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════
   Section 10: UNIVERSAL PARSER — Unknown Brokers
═══════════════════════════════════════════ */
describe('Intake: Universal Parser', () => {
  it('parses unknown Indian broker CSV', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'unknown-broker-india.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows, columnMapping, warnings } = extractRawRows(headers, dataRows);

    expect(rows.length).toBe(6);
    // Should detect Scrip Name as symbol
    expect(Object.values(columnMapping)).toContain('symbol');
    expect(Object.values(columnMapping)).toContain('side');
    expect(Object.values(columnMapping)).toContain('price');
    expect(Object.values(columnMapping)).toContain('date');

    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(3);
    // RELIANCE: (2480.30 - 2450.75) * 50 = 1477.50
    const rel = trades.find(t => t.symbol === 'RELIANCE');
    expect(rel).toBeDefined();
    expect(rel!.pnl).toBeCloseTo(1477.50, 1);
  });

  it('parses unknown US broker CSV', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'unknown-broker-us.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows, columnMapping } = extractRawRows(headers, dataRows);

    expect(rows.length).toBe(6);
    expect(Object.values(columnMapping)).toContain('symbol');
    expect(Object.values(columnMapping)).toContain('side');

    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(3);
    // AAPL: (188.25 - 185.50) * 10 = 27.50
    const aapl = trades.find(t => t.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl!.pnl).toBeCloseTo(27.50, 1);
  });

  it('parses crypto exchange CSV with fees', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'crypto-binance.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows, columnMapping } = extractRawRows(headers, dataRows);

    expect(rows.length).toBe(6);
    expect(Object.values(columnMapping)).toContain('symbol');
    expect(Object.values(columnMapping)).toContain('fees');

    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(3);

    // BTC: (43100 - 42500) * 0.5 = 300
    const btc = trades.find(t => t.symbol === 'BTCUSDT');
    expect(btc).toBeDefined();
    expect(btc!.pnl).toBeCloseTo(300, 0);
    expect(btc!.fees).toBeGreaterThan(0);

    const kpis = calculateIntakeKPIs(trades);
    expect(kpis.totalFees).toBeGreaterThan(0);
  });

  it('parses forex/MT4 CSV with P&L per row', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'mt4-forex.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows, columnMapping } = extractRawRows(headers, dataRows);

    expect(rows.length).toBe(4);
    expect(Object.values(columnMapping)).toContain('symbol');
    expect(Object.values(columnMapping)).toContain('pnl');
    expect(Object.values(columnMapping)).toContain('fees');

    // MT4 has P&L per row, so trades should use that
    const trades = pairRawTrades(rows);
    expect(trades.length).toBeGreaterThanOrEqual(2);
  });

  it('handles accounting negative format (parentheses)', () => {
    const csv = fs.readFileSync(path.join(FIXTURES, 'accounting-negatives.csv'), 'utf-8');
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));

    const { rows } = extractRawRows(headers, dataRows);
    expect(rows.length).toBe(6);

    const trades = pairRawTrades(rows);
    expect(trades.length).toBe(3);

    // HDFC BANK: (1520 - 1550) * 100 = -3000
    const hdfc = trades.find(t => t.symbol === 'HDFC BANK');
    expect(hdfc).toBeDefined();
    expect(hdfc!.pnl).toBe(-3000);

    // ICICI BANK: (975 - 950) * 200 = 5000
    const icici = trades.find(t => t.symbol === 'ICICI BANK');
    expect(icici).toBeDefined();
    expect(icici!.pnl).toBe(5000);
  });

  it('gives high confidence for well-structured files', () => {
    const mapping = {
      'tradingsymbol': 'symbol', 'trade_type': 'side',
      'quantity': 'qty', 'price': 'price',
      'order_execution_time': 'time',
    };
    const { level } = computeConfidence(mapping, 16, true);
    expect(level).toBe('high');
  });

  it('gives medium/low confidence for minimal mapping', () => {
    const mapping = { 'col1': 'symbol', 'col2': 'price' };
    const { level } = computeConfidence(mapping, 5, false);
    expect(['medium', 'low']).toContain(level);
  });
});
