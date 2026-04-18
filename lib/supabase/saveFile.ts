import { getSupabaseAdmin } from '@/lib/supabase'

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
