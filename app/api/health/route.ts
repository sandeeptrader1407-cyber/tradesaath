export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

/**
 * GET /api/health — lightweight health check.
 * Returns only { healthy: boolean } to unauthenticated callers.
 * No API key prefixes, env var names, or model details are exposed.
 */
export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key;

  const claudeOk = !!anthropicKey;
  const geminiOk = !!geminiKey;

  return NextResponse.json({ healthy: claudeOk || geminiOk });
}
