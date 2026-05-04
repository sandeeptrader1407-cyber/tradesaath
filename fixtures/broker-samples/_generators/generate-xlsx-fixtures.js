/**
 * One-off Node script to produce 3 Excel fixtures for the parsing audit.
 * Uses the `xlsx` package already in the project's node_modules.
 *
 * Run from repo root:
 *   node fixtures/broker-samples/_generators/generate-xlsx-fixtures.js
 */
'use strict'

const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')

const ROOT = path.join(__dirname, '..')

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function writeXlsx(outDir, fileName, sheets) {
  ensureDir(outDir)
  const wb = XLSX.utils.book_new()
  for (const { name, data } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  XLSX.writeFile(wb, path.join(outDir, fileName))
  console.log('  wrote', fileName)
}

/* ────────────────────────────────────────────────────────────────────
   1. Groww — single-sheet XLSX with their tradebook columns
   ──────────────────────────────────────────────────────────────────── */
function buildGroww() {
  const headers = [
    'Trade Date', 'Symbol', 'ISIN', 'Exchange', 'Segment', 'Action',
    'Quantity', 'Price', 'Trade Value', 'Order Number', 'Trade Number', 'Trade Time',
  ]
  const rows = [
    ['15-04-2026', 'IRCTC', 'INE335Y01020', 'NSE', 'EQ', 'BUY',  20, 745.00,  14900.00, 'GR-O-26041501', 'GR-T-3000601001', '09:30:00'],
    ['15-04-2026', 'IRCTC', 'INE335Y01020', 'NSE', 'EQ', 'SELL', 20, 762.50,  15250.00, 'GR-O-26041502', 'GR-T-3000601042', '11:20:30'],
    ['15-04-2026', 'PNB',   'INE160A01022', 'NSE', 'EQ', 'BUY',  500, 95.50,  47750.00, 'GR-O-26041503', 'GR-T-3000601078', '10:00:00'],
    ['15-04-2026', 'PNB',   'INE160A01022', 'NSE', 'EQ', 'SELL', 500, 93.75,  46875.00, 'GR-O-26041504', 'GR-T-3000601112', '14:00:00'],
    ['15-04-2026', 'YESBANK','INE528G01035','NSE', 'EQ', 'BUY',  300, 22.50,  6750.00,  'GR-O-26041505', 'GR-T-3000601145', '10:30:00'],
    ['15-04-2026', 'YESBANK','INE528G01035','NSE', 'EQ', 'BUY',  200, 22.10,  4420.00,  'GR-O-26041506', 'GR-T-3000601167', '11:00:00'],
    ['15-04-2026', 'YESBANK','INE528G01035','NSE', 'EQ', 'SELL', 500, 23.00,  11500.00, 'GR-O-26041507', 'GR-T-3000601201', '15:15:00'],
    ['15-04-2026', 'IDEA',  'INE669E01016', 'NSE', 'EQ', 'BUY',  1000,12.80,  12800.00, 'GR-O-26041508', 'GR-T-3000601245', '12:00:00'],
    ['15-04-2026', 'IDEA',  'INE669E01016', 'NSE', 'EQ', 'SELL', 1000,12.45,  12450.00, 'GR-O-26041509', 'GR-T-3000601278', '14:30:00'],
    ['16-04-2026', 'NYKAA', 'INE388Y01029', 'NSE', 'EQ', 'BUY',  50, 195.00,  9750.00,  'GR-O-26041601', 'GR-T-3000602012', '09:45:00'],
    ['16-04-2026', 'NYKAA', 'INE388Y01029', 'NSE', 'EQ', 'SELL', 50, 198.50,  9925.00,  'GR-O-26041602', 'GR-T-3000602045', '13:00:00'],
    ['16-04-2026', 'PAYTM', 'INE982J01020', 'NSE', 'EQ', 'BUY',  100,820.00,  82000.00, 'GR-O-26041603', 'GR-T-3000602078', '11:00:00'],
  ]
  writeXlsx(
    path.join(ROOT, 'groww'),
    'groww-tradebook.xlsx',
    [{ name: 'Trades', data: [headers, ...rows] }]
  )
}

/* ────────────────────────────────────────────────────────────────────
   2. IBKR Activity Statement — MULTI-sheet XLSX (intentional edge case:
      parsers that only read sheet 0 will miss the Trades section)
   ──────────────────────────────────────────────────────────────────── */
function buildIbkrXlsx() {
  // Sheet 0: Account Information (NOT trades — parser must navigate to Trades sheet)
  const accountSheet = [
    ['Statement', 'Activity Statement'],
    ['Field Name', 'Field Value'],
    ['Name', 'Test Trader'],
    ['Account', 'U1234567'],
    ['Account Alias', ''],
    ['Account Type', 'Individual'],
    ['Customer Type', 'Individual'],
    ['Account Capabilities', 'Margin'],
    ['Trading Permissions', 'Stocks, Options, Futures, Forex, Crypto'],
    ['Base Currency', 'USD'],
    ['Period', 'April 15, 2026 - April 20, 2026'],
    ['Generated', '2026-04-21'],
  ]

  // Sheet 1: Trades — IBKR's Activity Statement schema for the Trades section
  const tradesHeaders = [
    'Asset Category', 'Currency', 'Symbol', 'Date/Time',
    'Quantity', 'T. Price', 'C. Price', 'Proceeds', 'Comm/Fee', 'Basis',
    'Realized P/L', 'MTM P/L', 'Code',
  ]
  const tradesRows = [
    ['Stocks', 'USD', 'AAPL',  '2026-04-15, 09:35:22',  100,  182.50, 182.45,  -18250.00, -1.00, 18250.00, 0,    -5.00,    'O'],
    ['Stocks', 'USD', 'AAPL',  '2026-04-15, 14:22:18', -100,  184.20, 184.20,   18420.00, -1.00,-18250.00, 170,  170.00,   'C'],
    ['Stocks', 'USD', 'GOOG',  '2026-04-15, 10:00:00',   30,  158.00, 157.80,   -4740.00, -1.00,  4740.00, 0,    -6.00,    'O'],
    ['Stocks', 'USD', 'GOOG',  '2026-04-15, 15:50:00',  -30,  159.50, 159.50,    4785.00, -1.00, -4740.00, 45,   45.00,    'C'],
    ['Stocks', 'USD', 'META',  '2026-04-15, 11:15:00',   25,  515.00, 514.20,  -12875.00, -1.00, 12875.00, 0,   -20.00,    'O'],
    ['Stocks', 'USD', 'META',  '2026-04-15, 13:55:00',  -25,  525.50, 525.50,   13137.50, -1.00,-12875.00, 262.50, 262.50, 'C'],
    ['Forex',  'EUR', 'EUR.USD','2026-04-15, 12:30:00', 50000, 1.0852,1.0855,  -54260.00, -2.00, 54260.00, 0,    15.00,    'O'],
    ['Forex',  'EUR', 'EUR.USD','2026-04-15, 16:00:00',-50000, 1.0865,1.0865,   54325.00, -2.00,-54260.00, 65,   65.00,    'C'],
    ['Stocks', 'USD', 'NFLX',  '2026-04-16, 10:30:00',   10,  640.00, 638.50,   -6400.00, -1.00,  6400.00, 0,   -15.00,    'O'],
  ]

  // Sheet 2: Open Positions — for completeness (parser may or may not read)
  const positionsHeaders = ['Symbol', 'Quantity', 'Mult', 'Cost Price', 'Cost Basis', 'Close Price', 'Value', 'Unrealized P/L']
  const positionsRows = [
    ['NFLX', 10, 1, 640.00, 6400.00, 638.50, 6385.00, -15.00],
  ]

  // Sheet 3: Net Asset Value summary — tests parser doesn't try to parse this as trades
  const navHeaders = ['Field Name', 'Beginning Value', 'Ending Value']
  const navRows = [
    ['Stock', 0, 6385.00],
    ['Cash', 100000.00, 100462.50],
    ['Total', 100000.00, 106847.50],
  ]

  writeXlsx(
    path.join(ROOT, 'ibkr-xlsx'),
    'ibkr-activity-statement.xlsx',
    [
      { name: 'Account Information', data: accountSheet },
      { name: 'Trades',              data: [tradesHeaders,    ...tradesRows]    },
      { name: 'Open Positions',      data: [positionsHeaders, ...positionsRows] },
      { name: 'NAV',                 data: [navHeaders,       ...navRows]        },
    ]
  )
}

/* ────────────────────────────────────────────────────────────────────
   3. MetaTrader 5 — XLSX export (different schema from MT4!)
   ──────────────────────────────────────────────────────────────────── */
function buildMt5() {
  // MT5 export typically has a header band before the actual trade table.
  // Many parsers fail because they assume row 0 = headers.
  const data = [
    ['Account:', '5012345', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Name:',    'Test Trader', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Broker:',  'MetaQuotes-Demo', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Currency:','USD', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['Period:',  '2026.04.15 - 2026.04.20', '', '', '', '', '', '', '', '', '', '', '', ''],
    [], // empty row
    ['Closed Trades'], // section header
    ['Time',      'Position', 'Symbol', 'Type', 'Volume', 'Price',  'S/L', 'T/P', 'Time',           'Price',  'Commission', 'Swap', 'Profit', 'Comment'],
    ['2026.04.15 09:30:00', '100123451', 'EURUSD', 'buy',  1.00, 1.08520, 0, 0, '2026.04.15 11:45:00', 1.08720, -3.00, 0,    200.00, ''],
    ['2026.04.15 10:00:00', '100123452', 'GBPUSD', 'sell', 0.50, 1.26450, 0, 0, '2026.04.15 13:20:00', 1.26280, -1.50, 0,     85.00, ''],
    ['2026.04.15 10:30:00', '100123453', 'USDJPY', 'buy',  2.00, 153.250, 0, 0, '2026.04.15 14:15:00', 152.890, -6.00, 0,   -470.42, ''],
    ['2026.04.15 11:15:00', '100123454', 'XAUUSD', 'buy',  0.10, 2380.50, 0, 0, '2026.04.15 15:00:00', 2395.20, -1.20, 0,    147.00, ''],
    ['2026.04.15 12:00:00', '100123455', 'BTCUSD', 'buy',  0.05, 68250.00,0, 0, '2026.04.15 16:30:00', 68500.00, -2.50, 0,    12.50, ''],
    ['2026.04.16 09:00:00', '100123456', 'EURUSD', 'sell', 0.75, 1.08750, 0, 0, '2026.04.16 12:30:00', 1.08680, -2.25, 0,    52.50, ''],
    ['2026.04.18 22:30:00', '100123457', 'EURUSD', 'buy',  0.50, 1.08920, 0, 0, '2026.04.19 02:15:00', 1.08980, -1.50, -1.20, 30.00, ''],
    [],
    ['Open Trades'], // another section header
    ['Time',      'Position', 'Symbol', 'Type', 'Volume', 'Price', 'S/L', 'T/P', 'Price', 'Swap', 'Profit'],
    ['2026.04.20 14:00:00', '100123458', 'XAUUSD', 'buy',  0.20, 2410.00, 0, 0, 2398.50, 0, -230.00],
  ]

  writeXlsx(
    path.join(ROOT, 'mt5'),
    'mt5-account-history.xlsx',
    [{ name: 'Account History', data }]
  )
}

/* ────────────────────────────────────────────────────────────────────
   Run all
   ──────────────────────────────────────────────────────────────────── */
console.log('Generating XLSX fixtures...')
buildGroww()
buildIbkrXlsx()
buildMt5()
console.log('done.')
