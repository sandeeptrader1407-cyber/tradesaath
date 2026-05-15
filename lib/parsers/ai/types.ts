/**
 * AI parser types. The AI parsers (Gemini, Claude Haiku) produce
 * a `RawFileData`-compatible result (from lib/intake/types). Pairing,
 * validation, and KPI computation remain in the existing intake pipeline.
 *
 * @see lib/intake/parseFile.ts for the orchestrator that calls these.
 */
import type { RawFileData } from '@/lib/intake/types';

export type AIParserName = 'gemini' | 'claude-haiku';

export type ParserName =
  | AIParserName
  | 'pdf-coord'
  | 'pdf-ocr'
  | 'pdf-legacy'
  | 'claude-vision'
  | 'csv'
  | 'excel'
  | 'unknown';

export interface AIParserResult {
  /** RawFileData-shaped extraction output, ready for tradePairer */
  data: RawFileData;
  /** Which parser produced this */
  parserUsed: AIParserName;
  /** Model identifier (e.g., 'gemini-2.5-flash', 'claude-haiku-4-5-20251001') */
  modelName: string;
  /** USD cost of this call */
  costUsd: number;
  /** Wall-clock duration */
  durationMs: number;
  /** Token usage (for cost auditing) */
  inputTokens: number;
  outputTokens: number;
  /** Non-fatal warnings (column ambiguity, partial data, etc.) */
  warnings: string[];
}

/**
 * Error thrown by AI parsers. Carries cost-so-far so caller can log
 * what we spent before failure.
 */
export class AIParserError extends Error {
  constructor(
    message: string,
    public readonly parser: AIParserName,
    public readonly costUsd: number = 0,
    public readonly durationMs: number = 0,
  ) {
    super(message);
    this.name = 'AIParserError';
  }
}
