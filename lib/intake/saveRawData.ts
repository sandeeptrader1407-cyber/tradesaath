/**
 * TradeSaath Raw Data Storage (Intake Module)
 * Saves RawFileData to Supabase raw_files table.
 * Handles both Module 1 local parse AND Claude AI fallback cases.
 */

import { createClient } from '@supabase/supabase-js';
import { RawFileData } from './types';
import { createHash } from 'crypto';
import { resolveCurrency } from '@/lib/utils/currency';
import { LOCAL_PARSER_VERSION, CLAUDE_PARSER_VERSION } from './parserVersion';
import { archiveRawFile } from '@/lib/storage/rawFileArchive';

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
 *
 * @param fileBuffer Optional. Raw file bytes — required for Storage
 *   archive (passed to archiveRawFile so the file ends up in the
 *   trade-files bucket alongside the metadata row). When null/undefined
 *   the archive step is skipped and `storage_path` stays null in the
 *   inserted row. PR 2d (audit Finding E).
 *
 * Returns { id, storagePath } on success or { error } on failure.
 * `storagePath` is null when the archive was skipped or failed silently
 * (best-effort; failures log `[STORAGE_ARCHIVE_FAILED]` but never throw).
 */
export async function saveRawData(
  rawFile: RawFileData,
  userId: string,
  sessionId?: string,
  fileBuffer?: Buffer | null,
): Promise<{ id: string; storagePath: string | null } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Missing Supabase credentials' };

  // Dedup check
  if (rawFile.fileHash) {
    const { data: existing } = await supabase
      .from('raw_files')
      .select('id, storage_path')
      .eq('user_id', userId)
      .eq('file_hash', rawFile.fileHash)
      .maybeSingle();

    if (existing) {
      console.log('[Intake] Duplicate file (hash: ' + rawFile.fileHash.slice(0, 12) + '...), returning existing ID');
      if (sessionId) {
        await supabase.from('raw_files').update({ session_id: sessionId }).eq('id', existing.id);
      }
      return { id: existing.id, storagePath: existing.storage_path ?? null };
    }
  }

  // PR 2d (audit Finding E): archive the raw bytes to Supabase Storage
  // BEFORE the DB insert so storage_path is populated on the same row.
  // Best-effort: archive failure logs and returns null; the trade row
  // still inserts with storage_path: null.
  let storagePath: string | null = null;
  if (fileBuffer && fileBuffer.length > 0 && rawFile.fileHash) {
    const archiveResult = await archiveRawFile({
      buffer: fileBuffer,
      filename: rawFile.filename,
      fileHash: rawFile.fileHash,
      userId,
    });
    if (archiveResult) {
      storagePath = archiveResult.storagePath;
    } else {
      console.log('[Intake] Storage archive returned null for ' + rawFile.filename + ' — proceeding with storage_path: null');
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
    file_type: (rawFile.extension || 'unknown').toLowerCase(), // NOT NULL in schema
    file_size_bytes: rawFile.sizeBytes,
    file_hash: rawFile.fileHash,
    storage_path: storagePath,
    broker_id: toBrokerId(rawFile.broker),
    broker_name: rawFile.broker,
    broker_detected: rawFile.broker,
    market: rawFile.market,
    currency: rawFile.currency,
    headers: rawFile.headers,
    total_rows: rawFile.rows.length,
    data_rows: rawFile.rows.length,
    trades_count: rawFile.rows.length,
    skipped_rows: 0,
    has_time_column: hasTimeColumn,
    date_range_start: dateRangeStart || null,
    date_range_end: dateRangeEnd || null,
    raw_data: rawFile,
    column_mapping: rawFile.columnMapping,
    parser_version: LOCAL_PARSER_VERSION,
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

  console.log('[Intake] Saved raw file ' + rawFile.filename + ' (' + rawFile.rows.length + ' rows) as ' + data.id + (storagePath ? ' [archived]' : ' [no-archive]'));
  return { id: data.id, storagePath };
}

/**
 * Save a raw_files row for Claude AI PDF fallback.
 * Even when Module 1 cannot parse a PDF, we still want a raw_files record.
 *
 * `params.fileBuffer` is required for Storage archive (PR 2d, audit
 * Finding E). Null/undefined means archive is skipped — `storage_path`
 * stays null in the inserted row. Routes that have the bytes in scope
 * (analyse, extract) MUST pass them through.
 *
 * Returns { id, storagePath } on success or { error } on failure.
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
    /**
     * Value of the `tradesaath-currency` cookie set by middleware from
     * Vercel Edge geo. Used as fallback step 4 in resolveCurrency
     * (audit Finding F — 2026-05-04). Pass `null` when no request
     * context is available.
     */
    cookieCurrency?: string | null;
    /**
     * Raw `Accept-Language` header from the upload request. Used as
     * fallback step 5 in resolveCurrency (audit Finding F — 2026-05-04).
     * Pass `null` when no request context is available.
     */
    acceptLanguage?: string | null;
    /**
     * Raw file bytes — required for Storage archive (PR 2d, audit
     * Finding E). Null/undefined means archive is skipped (storage_path
     * stays null in the inserted row).
     */
    fileBuffer?: Buffer | null;
  },
  userId: string,
  sessionId?: string,
): Promise<{ id: string; storagePath: string | null } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Missing Supabase credentials' };

  // Dedup check
  if (params.fileHash) {
    const { data: existing } = await supabase
      .from('raw_files')
      .select('id, storage_path')
      .eq('user_id', userId)
      .eq('file_hash', params.fileHash)
      .maybeSingle();

    if (existing) {
      console.log('[Intake] Duplicate Claude file (hash: ' + params.fileHash.slice(0, 12) + '...), returning existing ID');
      if (sessionId) {
        await supabase.from('raw_files').update({ session_id: sessionId }).eq('id', existing.id);
      }
      return { id: existing.id, storagePath: existing.storage_path ?? null };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasTime = params.trades.some((t: any) => !!(t as any).time || !!(t as any).entry_time);

  // Derive file_type from filename extension
  const ext = (params.filename.split('.').pop() || 'unknown').toLowerCase();

  // FIX (audit Finding F — 2026-05-04): replace `|| 'INR'` fallback with
  // resolveCurrency chain. cookieCurrency / acceptLanguage flow in from
  // the route handler; for internal callers without request context they
  // default to null and the chain falls through to FALLBACK_CURRENCY.
  const resolvedCurrency = await resolveCurrency({
    detectedCurrency: params.currency,
    detectedMarket: params.market,
    symbols: (params.trades.map((t) => (t as { symbol?: string })?.symbol).filter(Boolean) as string[]),
    cookieCurrency: params.cookieCurrency ?? null,
    acceptLanguage: params.acceptLanguage ?? null,
  });

  // PR 2d (audit Finding E): archive raw bytes BEFORE the DB insert so
  // storage_path lands on the same row. Best-effort.
  let storagePath: string | null = null;
  if (params.fileBuffer && params.fileBuffer.length > 0 && params.fileHash) {
    const archiveResult = await archiveRawFile({
      buffer: params.fileBuffer,
      filename: params.filename,
      fileHash: params.fileHash,
      userId,
    });
    if (archiveResult) {
      storagePath = archiveResult.storagePath;
    } else {
      console.log('[Intake] Storage archive returned null for ' + params.filename + ' — proceeding with storage_path: null');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record: Record<string, any> = {
    user_id: userId,
    session_id: sessionId || null,
    file_name: params.filename,
    file_type: ext, // NOT NULL in schema
    file_size_bytes: params.fileSizeBytes,
    file_hash: params.fileHash,
    storage_path: storagePath,
    broker_id: 'claude-extracted',
    broker_name: 'Claude AI (' + (params.broker || 'PDF fallback') + ')',
    broker_detected: params.broker || 'Unknown',
    market: params.market || 'Unknown',
    currency: resolvedCurrency,
    headers: [],
    total_rows: params.tradeCount,
    data_rows: params.tradeCount,
    trades_count: params.tradeCount,
    skipped_rows: 0,
    has_time_column: hasTime,
    date_range_start: params.tradeDate || null,
    date_range_end: params.tradeDate || null,
    raw_data: { source: 'claude-ai', trades: params.trades, extractedAt: new Date().toISOString() },
    column_mapping: {},
    parser_version: CLAUDE_PARSER_VERSION,
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

  console.log('[Intake] Saved Claude-extracted file ' + params.filename + ' (' + params.tradeCount + ' trades) as ' + data.id + (storagePath ? ' [archived]' : ' [no-archive]'));
  return { id: data.id, storagePath };
}
