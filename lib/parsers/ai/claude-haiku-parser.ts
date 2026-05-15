/**
 * Claude Haiku 4.5 failover parser — extracts RawFileData from broker file.
 *
 * Failover when Gemini fails. ~5× more expensive (~$0.018/file vs Gemini
 * $0.0015). Used only when Gemini errors out or returns invalid output.
 *
 * Reuses SYSTEM_INSTRUCTION from gemini-parser.ts for prompt consistency.
 * Both parsers should produce equivalent output on the same file.
 *
 * Pricing: ~$0.018 per file at typical token sizes.
 * Timeout: 30 seconds.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { RawFileData, ConfidenceLevel } from '@/lib/intake/types';
import { SYSTEM_INSTRUCTION } from './gemini-parser';
import { AIParserError, type AIParserResult } from './types';
import { calculateAIParserCost } from './cost-tracker';

const MODEL_NAME = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * MIME types Claude supports natively via document/image content blocks.
 * For CSV/Excel, we send as text content (caller pre-converts).
 */
const PDF_MIMES = new Set<string>(['application/pdf']);
const IMAGE_MIMES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const TEXT_MIMES = new Set<string>([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * Output schema embedded into the user prompt for Claude (no native
 * structured output, so we instruct + parse).
 */
const SCHEMA_INSTRUCTION = `
Return ONLY a JSON object matching this TypeScript type. No markdown fences. No prose. No explanation.

type Output = {
  broker: string;            // detected broker name or 'Unknown'
  market: string;            // 'NSE', 'BSE', 'NYSE', 'NASDAQ', 'CRYPTO', 'Unknown'
  currency: string;          // 'INR', 'USD', etc. or empty string
  tradeDate: string;         // YYYY-MM-DD or empty string
  headers: string[];         // column headers as they appear in file
  columnMapping: Record<string, string>;  // header → canonical field
  rows: Array<{
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    price: number;
    date: string;            // YYYY-MM-DD
    time: string;            // HH:MM or empty
    fees: number;
    exchange: string;
    tradeId: string;
  }>;
  warnings: string[];
  confidenceScore: number;   // 0-100
};
`.trim();

function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

async function computeFileHash(buffer: Buffer): Promise<string> {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  costSoFar: number = 0,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AIParserError(
          `Claude Haiku timeout after ${timeoutMs}ms`,
          'claude-haiku',
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
        reject(err);
      });
  });
}

/**
 * Build content array for Anthropic Messages API based on file type.
 *
 * PDF: document content block with base64
 * Image: image content block with base64
 * Text (CSV/Excel-as-text): text content block (caller must pre-convert
 *   xlsx/xls to CSV text via existing parser).
 *
 * Excel binary files are NOT directly supported. If passed as
 * application/vnd.openxmlformats..., this function throws — orchestrator
 * is responsible for converting xlsx to CSV text before calling.
 */
type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: string; data: string };
    }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string };
    };

function buildContent(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
): ContentBlock[] {
  const base64Data = fileBuffer.toString('base64');

  if (PDF_MIMES.has(mimeType)) {
    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      },
      {
        type: 'text',
        text: `Extract trades from this PDF (file: ${fileName}).\n\n${SCHEMA_INSTRUCTION}`,
      },
    ];
  }

  if (IMAGE_MIMES.has(mimeType)) {
    // Narrow to acceptable image type for Anthropic SDK
    const imgType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imgType,
          data: base64Data,
        },
      },
      {
        type: 'text',
        text: `Extract trades from this image (file: ${fileName}).\n\n${SCHEMA_INSTRUCTION}`,
      },
    ];
  }

  if (TEXT_MIMES.has(mimeType)) {
    // Send as text. For xlsx binary, caller should have pre-converted.
    const text = fileBuffer.toString('utf-8');
    return [
      {
        type: 'text',
        text: `File: ${fileName} (${mimeType})\n\nContent:\n${text}\n\n${SCHEMA_INSTRUCTION}`,
      },
    ];
  }

  throw new AIParserError(
    `Unsupported MIME type for Claude Haiku: ${mimeType}`,
    'claude-haiku',
    0,
    0,
  );
}

/**
 * Strip markdown code fences from Claude output if present.
 * Claude sometimes wraps JSON in ```json ... ``` despite instructions.
 */
function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export interface ClaudeHaikuParserOptions {
  timeoutMs?: number;
}

/**
 * Parse a broker file using Claude Haiku 4.5.
 *
 * @throws AIParserError on any failure. err.costUsd reflects partial spend.
 */
export async function parseWithClaudeHaiku(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  options: ClaudeHaikuParserOptions = {},
): Promise<AIParserResult> {
  const t0 = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AIParserError(
      'ANTHROPIC_API_KEY env var not configured',
      'claude-haiku',
      0,
      Date.now() - t0,
    );
  }

  console.log(
    `[claude-haiku-parser] start: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`,
  );

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build content
  let content: ContentBlock[];
  try {
    content = buildContent(fileBuffer, mimeType, fileName);
  } catch (err) {
    if (err instanceof AIParserError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AIParserError(
      `Claude Haiku content prep failed: ${msg}`,
      'claude-haiku',
      0,
      Date.now() - t0,
    );
  }

  // Call API
  let response;
  try {
    response = await withTimeout(
      client.messages.create({
        model: MODEL_NAME,
        max_tokens: 8192,
        system: SYSTEM_INSTRUCTION,
        messages: [
          {
            role: 'user',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK accepts mixed content blocks
            content: content as any,
          },
        ],
      }),
      timeoutMs,
    );
  } catch (err) {
    if (err instanceof AIParserError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AIParserError(
      `Claude Haiku API call failed: ${msg}`,
      'claude-haiku',
      0,
      Date.now() - t0,
    );
  }

  // Extract usage + cost
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const costUsd = calculateAIParserCost('claude-haiku-4-5', inputTokens, outputTokens);

  // Extract text from response (Claude returns array of content blocks)
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new AIParserError(
      `Claude Haiku returned no text response`,
      'claude-haiku',
      costUsd,
      Date.now() - t0,
    );
  }
  const rawText = textBlock.text;
  const cleaned = stripMarkdownFences(rawText);

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
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AIParserError(
      `Claude Haiku returned invalid JSON: ${msg}. Response (first 500 chars): ${cleaned.slice(0, 500)}`,
      'claude-haiku',
      costUsd,
      Date.now() - t0,
    );
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rows)) {
    throw new AIParserError(
      `Claude Haiku returned malformed result (no rows array)`,
      'claude-haiku',
      costUsd,
      Date.now() - t0,
    );
  }

  const fileHash = await computeFileHash(fileBuffer);
  const extension = fileName.toLowerCase().split('.').pop() ?? '';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RawTradeRow is open-shaped; orchestrator normalizes
    rows: rows as any,
    rawText: '',
    warnings: parsed.warnings ?? [],
    extractedAt: new Date().toISOString(),
    confidence: scoreToLevel(parsed.confidenceScore ?? 0),
    confidenceScore: parsed.confidenceScore ?? 0,
  };

  const durationMs = Date.now() - t0;
  console.log(
    `[claude-haiku-parser] done: ${rows.length} rows, $${costUsd.toFixed(6)}, ${durationMs}ms`,
  );

  return {
    data,
    parserUsed: 'claude-haiku',
    modelName: MODEL_NAME,
    costUsd,
    durationMs,
    inputTokens,
    outputTokens,
    warnings: parsed.warnings ?? [],
  };
}
