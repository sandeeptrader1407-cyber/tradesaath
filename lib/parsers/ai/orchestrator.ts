/**
 * AI extraction orchestrator.
 *
 * Try Gemini (primary, cheaper) → Claude Haiku (failover) → return null.
 *
 * Returns null when both AI parsers fail. Caller (intake pipeline) then
 * falls through to the existing extractRawFile() 4-layer chain.
 *
 * Cost note: Gemini timeout (30s) + Haiku timeout (30s) = max 60s on
 * worst-case dual-failure. Caller should be prepared for this.
 */
import type { RawFileData } from '@/lib/intake/types';
import { parseWithGemini } from './gemini-parser';
import { parseWithClaudeHaiku } from './claude-haiku-parser';
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
 * Try AI extraction. Returns null if both Gemini and Claude Haiku fail.
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

  // Try Gemini first (cheaper)
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

  // Failover to Claude Haiku
  try {
    const result = await parseWithClaudeHaiku(buffer, mimeType, filename);
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
      `[ai-orchestrator] Claude Haiku failed (cost: $${cost.toFixed(6)}): ${msg}`,
    );
  }

  // Both AI parsers failed — caller falls through to legacy
  console.warn(`[ai-orchestrator] both AI parsers failed for ${filename}, returning null`);
  return null;
}
