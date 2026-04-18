import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * One-time setup: creates the 'trade-files' storage bucket.
 * Requires authentication. Call via POST /api/storage/setup.
 */
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
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
      return NextResponse.json({ error: 'Bucket creation failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, bucket: 'trade-files', data })
  } catch (err) {
    console.error('Storage setup error:', err)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}
