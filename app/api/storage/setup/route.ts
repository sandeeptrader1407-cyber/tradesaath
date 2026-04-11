import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * One-time setup: creates the 'trade-files' storage bucket.
 * Call via POST /api/storage/setup (e.g., from Postman or curl).
 */
export async function POST() {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase.storage.createBucket('trade-files', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: [
        'application/pdf',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'image/png',
        'image/jpeg',
      ],
    })

    if (error && !error.message.includes('already exists')) {
      console.error('Bucket creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, bucket: 'trade-files', data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Setup failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
