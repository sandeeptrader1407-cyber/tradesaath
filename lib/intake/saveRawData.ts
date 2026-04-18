/**
 * TradeSaath Raw Data Storage (Intake Module)
 * Saves RawFileData to Supabase raw_files table.
 * Handles both Module 1 local parse AND Claude AI fallback cases.
 */

import { createClient } from '@supabase/supabase-js';
import { RawFileData } from './types';
import { createHash } from 'crypto';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Compute SHA-256 hash of a buffer */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Derive a short broker_id slug from a broker name.
 */
function toBrokerId(brokerName: string): string {
  if (!brokerName || brokerName === 'Unknown') return 'unknown';
  return brokerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Save raw file data from Module 1 local parse.
 * Returns { id } on success or { error } on failure.
 */
export async function saveRawData(
  rawFile: RawFileData,
  userId: string,
  sessionId?: string,
): Promise<{ id: string } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Missing Supabase credentials' };

  // Dedup check
  if (rawFile.fileHash) {
    const { data: existing } = await supabase
      .from('raw_files')
      .select('id')
      .eq('user_id', userId)
      .eq('file_hash', rawFile.fileHash)
      .maybeSingle();

    if (existing) {
      console.log('[Intake] Duplicate file (hash: ' + rawFile.fileHash.slice(0, 12) + '...), returning existing ID');
      if (sessionId) {
        await supabase.from('raw_files').update({ session_id: sessionId }).eq('id', existing.id);
      }
      return { id: existing.id };
    }
  }

  // Compute date range from rows
  const dates = rawFile.rows
    .map(r => r.mapped.date)
    .filter((d): d is string => !!d)
    .sort();
  const dateRangeStart = dates[0] || rawFile.tradeDate || '';
  const dateRangeEnd = dates[dates.length - 1] || rawFile.tradeDate || '';

  // Check if file had time data
  const hasTimeColumn = rawFile.rows.some(r => !!r.mapped.time);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record: Record<string, any> = {
    user_id: userId,
    session_id: sessionId || null,
    file_name: rawFile.filename,
    file_size_bytes: rawFile.sizeBytes,
    file_hash: rawFile.fileHash,
    broker_id: toBrokerId(rawFile.broker),
    broker_name: rawFile.broker,
    market: rawFile.market,
    currency: rawFile.currency,
    headers: rawFile.headers,
    total_rows: rawFile.rows.length,
    data_rows: rawFile.rows.length,
    skipped_rows: 0,
    has_time_column: hasTimeColumn,
    date_range_start: dateRangeStart || null,
    date_range_end: dateRangeEnd || null,
    raw_data: rawFile,
    column_mapping: rawFile.columnMapping,
    parser_version: 'intake-1.0',
    parsed_at: rawFile.extractedAt || new Date().toISOString(),
    warnings: rawFile.warnings,
  };

  const { data, error } = await supabase
    .from('raw_files')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    console.error('[Intake] Failed to save raw data:', error.message);
    return { error: error.message };
  }

  console.log('[Intake] Saved raw file ' + rawFile.filename + ' (' + rawFile.rows.length + ' rows) as ' + data.id);
  return { id: data.id };
}

/**
 * Save a raw_files row for Claude AI PDF fallback.
 * Even when Module 1 cannot parse a PDF, we still want a raw_files record.
 */
export async function saveClaudeFallbackRawData(
  params: {
    filename: string;
    fileHash: string;
    fileSizeBytes: number;
    broker: string;
    market: string;
    currency: string;
    tradeDate: string;
    tradeCount: number;
    trades: unknown[];
  },
  userId: string,
  sessionId?: string,
): Promise<{ id: string } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Missing Supabase credentials' };

  // Dedup check
  if (params.fileHash) {
    const { data: existing } = await supabase
      .from('raw_files')
      .select('id')
      .eq('user_id', userId)
      .eq('file_hash', params.fileHash)
      .maybeSingle();

    if (existing) {
      console.log('[Intake] Duplicate Claude file (hash: ' + params.fileHash.slice(0, 12) + '...), returning existing ID');
      if (sessionId) {
        await supabase.from('raw_files').update({ session_id: sessionId }).eq('id', existing.id);
      }
      return { id: existing.id };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasTime = params.trades.some((t: any) => !!(t as any).time || !!(t as any).entry_time);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record: Record<string, any> = {
    user_id: userId,
    session_id: sessionId || null,
    file_name: params.filename,
    file_size_bytes: params.fileSizeBytes,
    file_hash: params.fileHash,
    broker_id: 'claude-extracted',
    broker_name: 'Claude AI (' + (params.broker || 'PDF fallback') + ')',
    market: params.market || 'Unknown',
    currency: params.currency || 'INR',
    headers: [],
    total_rows: params.tradeCount,
    data_rows: params.tradeCount,
    skipped_rows: 0,
    has_time_column: hasTime,
    date_range_start: params.tradeDate || null,
    date_range_end: params.tradeDate || null,
    raw_data: { source: 'claude-ai', trades: params.trades, extractedAt: new Date().toISOString() },
    column_mapping: {},
    parser_version: 'claude-2.0',
    parsed_at: new Date().toISOString(),
    warnings: ['Extracted via Claude AI - local parser could not handle this file format'],
  };

  const { data, error } = await supabase
    .from('raw_files')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    console.error('[Intake] Failed to save Claude fallback raw data:', error.message);
    return { error: error.message };
  }

  console.log('[Intake] Saved Claude-extracted file ' + params.filename + ' (' + params.tradeCount + ' trades) as ' + data.id);
  return { id: data.id };
}
