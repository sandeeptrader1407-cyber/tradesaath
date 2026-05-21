/**
 * Gemini 2.5 Flash parser — extracts RawFileData from broker file.
 *
 * This is the primary AI extraction layer. Output is consumed by the
 * existing intake pipeline (pairTrades → validateTrades → KPIs).
 *
 * Pricing: ~$0.0015 per file at typical token sizes.
 * Timeout: 30 seconds.
 *
 * Cost on error: caller can read err.costUsd to log partial spend.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RawFileData, ConfidenceLevel } from '@/lib/intake/types';
import { GEMINI_EXTRACTION_SCHEMA } from './gemini-schema';
import { AIParserError, type AIParserResult } from './types';
import { calculateAIParserCost } from './cost-tracker';

const MODEL_NAME = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * MIME types Gemini supports for inline file content.
 * Reject unsupported types early to avoid wasted API calls.
 */
const SUPPORTED_MIMES = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * System instruction — defines the extraction task.
 *
 * Exported so other parsers (Claude Haiku in Prompt 3) can reuse it
 * verbatim. Keeping it DRY makes A/B comparisons fair.
 */
export const SYSTEM_INSTRUCTION = `You are a precise trade extraction engine for retail F&O traders. Extract every individual trade FILL (execution) from the provided broker statement, contract note, or screenshot.

Rules:
1. Detect the broker from headers, logos, and format. Output one of: 'Zerodha', 'Upstox', 'Groww', 'AngelOne', 'Fyers', '5Paisa', 'Dhan', 'ICICIDirect', 'HDFCSec', 'Kotak', 'MotilalOswal', 'IBKR', 'MT4', 'MT5', 'Binance', 'Robinhood', or 'Unknown'.
2. Extract every fill as a SEPARATE row. Do NOT pair buys with sells — that happens downstream. If a broker file has 7000 fills, return 7000 rows.
3. Symbol normalization for options: 'NIFTY 25000 PE 12JUN2025' format (underlying + strike + type + expiry). For equity: bare symbol like 'INFIBEAM'. Preserve broker convention for futures.
4. Side must be exactly 'BUY' or 'SELL' (uppercase, no synonyms like 'B'/'S'/'Buy'/'Long'/'Short').
5. Quantity is positive integer shares/lots as broker reports. Do NOT negate sells. Preserve broker convention (lot size vs share count).
6. Date format YYYY-MM-DD. Time format HH:MM (24-hour, IST for Indian brokers). If only date in file, time = empty string.
7. Price is per-unit execution price, positive number, no currency symbol.
8. Fees are total per-fill charges (brokerage + STT + GST + misc + exchange + SEBI). 0 if not in file. If broker has multiple fee columns (e.g. Kotak has "Total Charges" + "STT/CTT"), sum them.
9. Never fabricate. Missing field → empty string for strings, 0 for numbers. Better to return fewer accurate fills than many guessed ones.
10. Skip non-trade rows: headers, summaries, totals, brokerage statements, page footers, watermarks.
11. Do NOT reject files based on filename, sheet title, or report header. Judge by data shape only.
   If a "Status" (or similarly named) column is present:
   - Treat rows with Status in {Executed, Filled, Complete, Traded, Done, Success} as actual trades — extract them.
   - Discard rows with Status in {Pending, Cancelled, Rejected, Open, Failed, Expired}.

   Files labeled "orderbook" often contain executed trades mixed with cancelled/rejected orders. Filter, do not reject. If, after filtering, fewer than 2 executed rows remain, then emit zero rows and add warning: "No executed trades found in this file. It may contain only pending or cancelled orders."
12. confidenceScore: 100 if you're certain of every field; 80 if column mapping is clean but a few rows ambiguous; 60 if symbol normalization required guessing; <40 if you're not sure this is a trade file at all.

Return ONLY the JSON object matching the schema. No prose, no markdown, no explanation.`;

/**
 * Map confidenceScore (0-100) to ConfidenceLevel enum for RawFileData.
 */
function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * SHA-256 hash for file dedup (matches existing intake pipeline convention).
 */
async function computeFileHash(buffer: Buffer): Promise<string> {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Wrap a promise with a timeout. Throws AIParserError if timeout fires.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  costSoFar: number = 0,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AIParserError(
          `Gemini timeout after ${timeoutMs}ms`,
          'gemini',
          costSoFar,
          timeoutMs,
        ),
      );
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[withTimeout/gemini] underlying SDK rejected: ${msg}`);
        reject(err);
      });
  });
}

export interface GeminiParserOptions {
  /** Timeout in milliseconds (default 30000) */
  timeoutMs?: number;
}

/**
 * Parse a broker file using Gemini 2.5 Flash.
 *
 * @throws AIParserError on any failure (API error, timeout, invalid JSON,
 *   unsupported mime). err.costUsd reflects any partial spend.
 */
export async function parseWithGemini(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  options: GeminiParserOptions = {},
): Promise<AIParserResult> {
  const t0 = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Pre-flight validation
  if (!process.env.GEMINI_API_KEY) {
    throw new AIParserError(
      'GEMINI_API_KEY env var not configured',
      'gemini',
      0,
      Date.now() - t0,
    );
  }
  if (!SUPPORTED_MIMES.has(mimeType)) {
    throw new AIParserError(
      `Unsupported MIME type: ${mimeType}`,
      'gemini',
      0,
      Date.now() - t0,
    );
  }

  console.log(
    `[gemini-parser] start: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`,
  );

  // Initialize SDK
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_EXTRACTION_SCHEMA,
    },
  });

  // Build request
  const base64Data = fileBuffer.toString('base64');

  // Call API with timeout
  let response;
  try {
    response = await withTimeout(
      model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
      ]),
      timeoutMs,
    );
  } catch (err) {
    if (err instanceof AIParserError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AIParserError(
      `Gemini API call failed: ${msg}`,
      'gemini',
      0,
      Date.now() - t0,
    );
  }

  // Extract usage + compute cost
  const usage = response.response.usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const costUsd = calculateAIParserCost(MODEL_NAME, inputTokens, outputTokens);

  // Parse JSON response
  const text = response.response.text();
  let parsed: {
    broker: string;
    market: string;
    currency: string;
    tradeDate: string;
    headers: string[];
    columnMapping: Record<string, string>;
    rows: Array<{
      symbol: string;
      side: 'BUY' | 'SELL';
      qty: number;
      price: number;
      date: string;
      time: string;
      fees: number;
      exchange: string;
      tradeId: string;
    }>;
    warnings: string[];
    confidenceScore: number;
  };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AIParserError(
      `Gemini returned invalid JSON: ${msg}. Response (first 500 chars): ${text.slice(0, 500)}`,
      'gemini',
      costUsd,
      Date.now() - t0,
    );
  }

  // Basic sanity check
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rows)) {
    throw new AIParserError(
      `Gemini returned malformed result (no rows array)`,
      'gemini',
      costUsd,
      Date.now() - t0,
    );
  }

  // Hash file for dedup (matches intake pipeline convention)
  const fileHash = await computeFileHash(fileBuffer);

  // Extension from filename
  const extension = fileName.toLowerCase().split('.').pop() ?? '';

  // Map rows to RawTradeRow shape expected downstream.
  // RawTradeRow is open shape per lib/intake/types.ts — index + raw fields.
  const rows = parsed.rows.map((r, index) => ({
    index,
    symbol: r.symbol,
    side: r.side,
    qty: r.qty,
    price: r.price,
    date: r.date,
    time: r.time,
    fees: r.fees,
    exchange: r.exchange,
    tradeId: r.tradeId,
  }));

  const data: RawFileData = {
    filename: fileName,
    extension,
    sizeBytes: fileBuffer.length,
    fileHash,
    broker: parsed.broker || 'Unknown',
    market: parsed.market || 'Unknown',
    currency: parsed.currency || '',
    tradeDate: parsed.tradeDate || new Date().toISOString().split('T')[0],
    headers: parsed.headers ?? [],
    columnMapping: parsed.columnMapping ?? {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RawTradeRow is open-shaped
    rows: rows as any,
    rawText: '', // Gemini extracts directly, no raw text intermediate
    warnings: parsed.warnings ?? [],
    extractedAt: new Date().toISOString(),
    confidence: scoreToLevel(parsed.confidenceScore ?? 0),
    confidenceScore: parsed.confidenceScore ?? 0,
  };

  const durationMs = Date.now() - t0;
  console.log(
    `[gemini-parser] done: ${rows.length} rows, $${costUsd.toFixed(6)}, ${durationMs}ms`,
  );

  return {
    data,
    parserUsed: 'gemini',
    modelName: MODEL_NAME,
    costUsd,
    durationMs,
    inputTokens,
    outputTokens,
    warnings: parsed.warnings ?? [],
  };
}
