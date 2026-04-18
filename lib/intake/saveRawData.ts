/**
 * TradeSaath Raw Data Storage (Intake Module)
 * Saves RawFileData to Supabase for future re-parsing.
 */

import { createClient } from '@supabase/supabase-js';
import { RawFileData, RawFileRecord } from './types';

/**
 * Save raw file data to Supabase.
 * Uses the service role key for server-side inserts.
 * Returns the inserted record ID, or null on failure.
 */
export async function saveRawData(
  rawFile: RawFileData,
  userId: string,
  sessionId?: string,
): Promise<{ id: string } | { error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { error: 'Missing Supabase credentials' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check for duplicate by file hash
  const { data: existing } = await supabase
    .from('raw_files')
    .select('id')
    .eq('user_id', userId)
    .eq('file_hash', rawFile.fileHash)
    .maybeSingle();

  if (existing) {
    console.log(`[Intake] Duplicate file detected (hash: ${rawFile.fileHash.slice(0, 12)}...), returning existing ID`);
    return { id: existing.id };
  }

  const record: Omit<RawFileRecord, 'created_at'> = {
    user_id: userId,
    session_id: sessionId,
    filename: rawFile.filename,
    file_hash: rawFile.fileHash,
    file_size_bytes: rawFile.sizeBytes,
    broker: rawFile.broker,
    market: rawFile.market,
    currency: rawFile.currency,
    trade_date: rawFile.tradeDate,
    raw_data: rawFile,
    row_count: rawFile.rows.length,
    extraction_warnings: rawFile.warnings,
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

  console.log(`[Intake] Saved raw file ${rawFile.filename} (${rawFile.rows.length} rows) as ${data.id}`);
  return { id: data.id };
}
