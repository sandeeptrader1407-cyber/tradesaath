/**
 * Normalize AI parser output (flat-shape rows with numbers) to the
 * RawTradeRow shape that pairRawTrades expects (nested mapped object
 * with STRING values).
 *
 * AI parsers currently emit rows with `as any` cast in their RawFileData
 * output. This normalizer fixes that — converts to the strict shape so
 * the existing intake pipeline (pairer/validator/KPI) consumes AI output
 * identically to legacy parser output.
 */
import type { RawFileData, RawTradeRow } from '@/lib/intake/types';

/**
 * Flat row shape produced by AI parsers (gemini-parser.ts, claude-haiku-parser.ts).
 * Each is the `rows: rows as any` cast value from those files.
 */
interface AIFlatRow {
  index: number;
  symbol: string;
  side: 'BUY' | 'SELL' | string;
  qty: number;
  price: number;
  date: string;
  time: string;
  fees: number;
  exchange: string;
  tradeId: string;
}

/**
 * Convert a single AI flat row to RawTradeRow shape.
 */
function normalizeRow(flat: AIFlatRow): RawTradeRow {
  return {
    rowIndex: flat.index,
    raw: {
      symbol: flat.symbol,
      side: flat.side,
      qty: String(flat.qty),
      price: String(flat.price),
      date: flat.date,
      time: flat.time,
      fees: String(flat.fees),
      exchange: flat.exchange,
      tradeId: flat.tradeId,
    },
    mapped: {
      symbol: flat.symbol,
      side: flat.side,
      qty: String(flat.qty),
      price: String(flat.price),
      date: flat.date,
      time: flat.time,
      fees: String(flat.fees),
      exchange: flat.exchange,
      tradeId: flat.tradeId,
    },
    columnMapping: {
      symbol: 'symbol',
      side: 'side',
      qty: 'qty',
      price: 'price',
      date: 'date',
      time: 'time',
      fees: 'fees',
      exchange: 'exchange',
      tradeId: 'tradeId',
    },
    warnings: [],
  };
}

/**
 * Normalize an AI parser's RawFileData (with flat rows) to a strict
 * RawFileData (with nested RawTradeRow). Returns a NEW RawFileData
 * with rows replaced and a normalization warning if any rows looked
 * malformed.
 */
export function normalizeAIRawFile(aiOutput: RawFileData): RawFileData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI parsers cast to any
  const flatRows = aiOutput.rows as any as AIFlatRow[];

  const normalizedRows: RawTradeRow[] = [];
  const malformedCount = { value: 0 };

  for (const flat of flatRows) {
    // Skip rows missing essential fields
    if (!flat || typeof flat !== 'object') {
      malformedCount.value++;
      continue;
    }
    if (!flat.symbol || !flat.side || !flat.date) {
      malformedCount.value++;
      continue;
    }
    if (typeof flat.qty !== 'number' || typeof flat.price !== 'number') {
      malformedCount.value++;
      continue;
    }
    normalizedRows.push(normalizeRow(flat));
  }

  const warnings = [...aiOutput.warnings];
  if (malformedCount.value > 0) {
    warnings.push(
      `Normalizer dropped ${malformedCount.value} malformed rows from AI output`,
    );
  }

  return {
    ...aiOutput,
    rows: normalizedRows,
    warnings,
  };
}
