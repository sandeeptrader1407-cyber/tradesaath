export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: 'error',
      message: 'ANTHROPIC_API_KEY not set',
      env_keys: Object.keys(process.env).filter(k => k.includes('ANTHROPIC') || k.includes('SUPABASE') || k.includes('CLERK')).sort()
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply with just the word OK' }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({
        status: 'error',
        api_status: response.status,
        error_type: data.error.type,
        error_message: data.error.message,
        key_prefix: apiKey.substring(0, 10) + '...'
      });
    }

    const text = data.content?.[0]?.text || '';
    return NextResponse.json({
      status: 'ok',
      model: data.model,
      response: text,
      key_prefix: apiKey.substring(0, 10) + '...'
    });
  } catch (err: unknown) {
    return NextResponse.json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
      key_prefix: apiKey.substring(0, 10) + '...'
    });
  }
}
