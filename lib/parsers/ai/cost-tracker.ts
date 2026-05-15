/**
 * Pricing reference for AI parser cost tracking.
 *
 * VERIFY pricing before production. Sources:
 *   - Gemini 2.5 Flash: https://ai.google.dev/pricing
 *   - Claude Haiku 4.5: https://www.anthropic.com/pricing
 *
 * Last verified: 2026-05-10. Re-verify quarterly.
 *
 * Cost in USD per 1M tokens.
 */
export const AI_PARSER_PRICING = {
  'gemini-2.5-flash': {
    inputPerM: 0.15,
    outputPerM: 0.60,
  },
  'claude-haiku-4-5': {
    inputPerM: 1.00,
    outputPerM: 5.00,
  },
} as const;

export type AIPriceableModel = keyof typeof AI_PARSER_PRICING;

/**
 * Calculate USD cost for a single API call given input + output tokens.
 */
export function calculateAIParserCost(
  model: AIPriceableModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = AI_PARSER_PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerM;
  return inputCost + outputCost;
}
