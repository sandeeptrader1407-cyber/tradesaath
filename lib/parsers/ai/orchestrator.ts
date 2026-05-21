/**
 * AI extraction orchestrator.
 *
 * Try Gemini → return null on failure. Caller (intake pipeline) then
 * falls through to the existing extractRawFile() 4-layer chain.
 *
 * Claude Haiku failover was removed — Gemini latency in production
 * exceeded the prior 25s timeout, and Haiku showed no benefit on the
 * same files (same timeout symptom from the same broker exports).
 * The file lib/parsers/ai/claude-haiku-parser.ts is intentionally kept
 * for potential future re-introduction.
 */
import type { RawFileData } from '@/lib/intake/types';
import { parseWithGemini } from './gemini-parser';
import { normalizeAIRawFile } from './normalizer';
import { AIParserError, type AIParserName } from './types';

export interface AIExtractionResult {
  data: RawFileData;
  parserUsed: AIParserName;
  modelName: string;
  costUsd: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Mime type detection from file extension. Conservative fallback to
 * 'text/csv' for unknown CSV-like extensions; throws (returns null
 * from orchestrator) for completely unrecognized types.
 */
function detectMimeType(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'csv':
    case 'tsv':
    case 'txt':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

/**
 * Try AI extraction. Returns null if Gemini fails.
 *
 * Caller MUST handle null by falling through to legacy parser.
 */
export async function tryAIExtract(
  buffer: Buffer,
  filename: string,
): Promise<AIExtractionResult | null> {
  const mimeType = detectMimeType(filename);
  if (!mimeType) {
    console.warn(`[ai-orchestrator] unknown mime for ${filename}, skipping AI`);
    return null;
  }

  try {
    const result = await parseWithGemini(buffer, mimeType, filename);
    const normalized = normalizeAIRawFile(result.data);
    return {
      data: normalized,
      parserUsed: result.parserUsed,
      modelName: result.modelName,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (err) {
    const cost = err instanceof AIParserError ? err.costUsd : 0;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ai-orchestrator] Gemini failed (cost: $${cost.toFixed(6)}): ${msg}`,
    );
  }

  console.warn(`[ai-orchestrator] Gemini failed, falling through to legacy parser`);
  return null;
}
