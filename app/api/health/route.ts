export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.Gemini_API_Key
    || process.env.GEMINI_API_KEY
    || process.env.Gemini_Api_Key
    || process.env.GEMINI_API_key
    || process.env.gemini_api_key;

  // Log all env var names that contain 'gemini' (case-insensitive) for debugging
  const geminiEnvVars = Object.keys(process.env).filter(k => k.toLowerCase().includes('gemini'));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: Record<string, any> = {
    anthropic_key_set: !!anthropicKey,
    gemini_key_set: !!geminiKey,
    gemini_env_var_names: geminiEnvVars,
  };

  // Test Claude
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Reply with just the word OK' }]
        })
      });
      const data = await res.json();
      if (data.error) {
        results.claude = { status: 'error', http: res.status, error_type: data.error.type, error_msg: data.error.message, key_prefix: anthropicKey.substring(0, 10) + '...' };
      } else {
        results.claude = { status: 'ok', model: data.model, response: data.content?.[0]?.text || '', key_prefix: anthropicKey.substring(0, 10) + '...' };
      }
    } catch (err: unknown) {
      results.claude = { status: 'error', message: err instanceof Error ? err.message : 'Unknown' };
    }
  }

  // Test Gemini
  if (geminiKey) {
    try {
      const model = 'gemini-2.5-flash-preview-05-20';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with just the word OK' }] }],
          generationConfig: { maxOutputTokens: 50 }
        })
      });
      const data = await res.json();
      if (data.error) {
        results.gemini = { status: 'error', http: res.status, error_msg: data.error.message, key_prefix: geminiKey.substring(0, 10) + '...' };
      } else {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        results.gemini = { status: 'ok', model, response: text, key_prefix: geminiKey.substring(0, 10) + '...' };
      }
    } catch (err: unknown) {
      results.gemini = { status: 'error', message: err instanceof Error ? err.message : 'Unknown' };
    }
  }

  const anyWorking = results.claude?.status === 'ok' || results.gemini?.status === 'ok';
  return NextResponse.json({ healthy: anyWorking, ...results });
}
