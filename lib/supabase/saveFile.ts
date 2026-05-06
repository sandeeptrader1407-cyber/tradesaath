import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Persist a raw upload to Storage + insert a `raw_files` metadata row.
 *
 * @deprecated PR 2d (audit Finding E, 2026-05-04) — use `saveRawData()`
 *   from `lib/intake/saveRawData.ts` instead. saveRawData is now the
 *   single owner of `raw_files` row creation AND Storage archive (via
 *   `lib/storage/rawFileArchive.ts`). saveRawFile creates a duplicate
 *   row that lacks `parser_version` + the rich Module 1 metadata
 *   (broker_id, market, currency, headers, raw_data, column_mapping,
 *   etc.), and uses a legacy storage path scheme without hash dedup.
 *   Removal targeted for PR 4 cleanup pass once all callers have been
 *   migrated to saveRawData. Until then this function still works as
 *   before — the console.warn below logs each call site so we can
 *   identify any remaining users.
 */
export async function saveRawFile({
  userId,
  anonId,
  fileName,
  fileType,
  fileSize,
  fileBuffer,
  sessionId,
  brokerDetected,
  tradesCount,
}: {
  userId?: string
  anonId?: string
  fileName: string
  fileType: string
  fileSize: number
  fileBuffer: Buffer
  sessionId?: string
  brokerDetected?: string
  tradesCount?: number
}) {
  // PR 2d deprecation breadcrumb (audit Finding E). Stack frames help
  // pinpoint which caller still triggers the legacy path during/after
  // route rewires. Safe to leave in place until removal in PR 4.
  console.warn(
    '[DEPRECATED] saveRawFile() called — should use saveRawData (PR 2d). Source location:',
    new Error().stack?.split('\n').slice(1, 4).join('\n'),
  )

  const supabase = getSupabaseAdmin()

  // Generate storage path: owner/timestamp_filename
  const owner = userId || anonId || 'unknown'
  const timestamp = Date.now()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${owner}/${timestamp}_${safeName}`

  // Upload to Supabase Storage
  let uploadOk = false
  try {
    const { error: uploadError } = await supabase.storage
      .from('trade-files')
      .upload(storagePath, fileBuffer, {
        contentType: fileType,
        upsert: false,
      })

    if (uploadError) {
      console.error('File upload to storage error:', uploadError.message)
    } else {
      uploadOk = true
    }
  } catch (err) {
    console.error('File upload exception:', err)
  }

  // Save metadata to raw_files table
  let fileId: string | null = null
  try {
    const { data, error: dbError } = await supabase
      .from('raw_files')
      .insert({
        user_id: userId || null,
        anon_id: anonId || null,
        session_id: sessionId || null,
        file_name: fileName,
        file_type: fileType,
        file_size_bytes: fileSize,
        storage_path: uploadOk ? storagePath : null,
        broker_detected: brokerDetected || null,
        trades_count: tradesCount || null,
        analysed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('File metadata save error:', dbError.message)
    } else {
      fileId = data?.id || null
    }
  } catch (err) {
    console.error('File metadata save exception:', err)
  }

  return { fileId, storagePath: uploadOk ? storagePath : null }
}
