/**
 * Gemini structured-output schema for trade file extraction.
 *
 * Target shape mirrors `RawFileData` from lib/intake/types.ts.
 * Gemini fills these fields from the broker file; the pairTrades and
 * validateTrades stages downstream consume this output.
 *
 * IMPORTANT: this schema must stay in sync with RawFileData.
 * If RawFileData changes, update this AND re-run the parser test fixtures.
 */
import { SchemaType, type Schema } from '@google/generative-ai';

export const GEMINI_EXTRACTION_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description:
    'Extracted broker file data: detected metadata + raw fills, one per trade execution.',
  properties: {
    broker: {
      type: SchemaType.STRING,
      description:
        "Detected broker: 'Zerodha', 'Upstox', 'Groww', 'AngelOne', 'Fyers', '5Paisa', 'Dhan', 'ICICIDirect', 'HDFCSec', 'Kotak', 'MotilalOswal', 'IBKR', 'MT4', 'MT5', 'Binance', 'Robinhood', or 'Unknown'",
      nullable: false,
    },
    market: {
      type: SchemaType.STRING,
      description: "Market identifier: 'NSE', 'BSE', 'NYSE', 'NASDAQ', 'CRYPTO', or 'Unknown'",
      nullable: false,
    },
    currency: {
      type: SchemaType.STRING,
      description: "Currency: 'INR', 'USD', 'EUR', 'GBP', etc. Empty string if undetectable.",
      nullable: false,
    },
    tradeDate: {
      type: SchemaType.STRING,
      description:
        "Best-effort trade date from the file in YYYY-MM-DD. If multiple dates, use the earliest. Empty string if undetectable.",
      nullable: false,
    },
    headers: {
      type: SchemaType.ARRAY,
      description: 'Column headers AS THEY APPEAR in the file (preserve original casing/spacing)',
      items: { type: SchemaType.STRING },
    },
    columnMapping: {
      type: SchemaType.OBJECT,
      description:
        'Map header name (as in `headers`) to canonical field. Canonical fields: symbol, side, qty, price, date, time, pnl, fees, exchange, tradeId. Use null for headers that have no canonical mapping.',
      properties: {},
    },
    rows: {
      type: SchemaType.ARRAY,
      description:
        'One row per individual trade execution (fill). Do NOT pair buys/sells — emit every fill separately. Pair downstream.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          symbol: {
            type: SchemaType.STRING,
            description:
              "Normalized symbol. For options: 'NIFTY 25000 PE 12JUN2025' format (underlying + strike + type + expiry).",
            nullable: false,
          },
          side: {
            type: SchemaType.STRING,
            description: "Either 'BUY' or 'SELL' (uppercase, no synonyms)",
            nullable: false,
          },
          qty: {
            type: SchemaType.NUMBER,
            description: 'Quantity in shares/lots as broker reports it. Always positive.',
            nullable: false,
          },
          price: {
            type: SchemaType.NUMBER,
            description: 'Execution price per share/unit',
            nullable: false,
          },
          date: {
            type: SchemaType.STRING,
            description: 'Trade date in YYYY-MM-DD',
            nullable: false,
          },
          time: {
            type: SchemaType.STRING,
            description: "Trade time HH:MM (24h, IST for Indian brokers). Empty string if not in file.",
            nullable: false,
          },
          fees: {
            type: SchemaType.NUMBER,
            description: 'Total fees for this fill (brokerage + STT + GST + misc). 0 if not in file.',
            nullable: false,
          },
          exchange: {
            type: SchemaType.STRING,
            description: "Exchange code: 'NSE', 'BSE', 'NSEDERV', etc. Empty if not in file.",
            nullable: false,
          },
          tradeId: {
            type: SchemaType.STRING,
            description: 'Broker trade/fill ID. Empty if not in file.',
            nullable: false,
          },
        },
        required: ['symbol', 'side', 'qty', 'price', 'date'],
      },
    },
    warnings: {
      type: SchemaType.ARRAY,
      description:
        'Non-fatal extraction warnings: ambiguous column mappings, partial data, suspected wrong rows, etc. Empty array if none.',
      items: { type: SchemaType.STRING },
    },
    confidenceScore: {
      type: SchemaType.NUMBER,
      description: 'Confidence in the extraction quality, 0-100. <60 means high uncertainty.',
      nullable: false,
    },
  },
  required: [
    'broker',
    'market',
    'currency',
    'tradeDate',
    'headers',
    'columnMapping',
    'rows',
    'warnings',
    'confidenceScore',
  ],
};
