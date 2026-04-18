import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Migrate all anonymous user data to a real user account.
 * Called after signup/login when an anon_id cookie exists.
 * Idempotent — safe to call multiple times.
 */
export async function migrateAnonToUser(anonId: string, userId: string) {
  if (!anonId || !userId) return { migrated: false, counts: {} }

  const counts: Record<string, number> = {}

  try {
    const supabase = getSupabaseAdmin()

    // Migrate trade_sessions: set user_id, clear anon_id
    const { data: sessions, error: sessErr } = await supabase
      .from('trade_sessions')
      .update({ user_id: userId, anon_id: null })
      .eq('anon_id', anonId)
      .select('id')

    if (sessErr) {
      console.error('[migrateAnonToUser] trade_sessions error:', sessErr.message)
    }
    counts.sessions = sessions?.length || 0

    // Migrate trade_analysis: clear anon_id on matched rows
    const { data: analyses, error: anaErr } = await supabase
      .from('trade_analysis')
      .update({ anon_id: null })
      .eq('anon_id', anonId)
      .select('id')

    if (anaErr) {
      console.error('[migrateAnonToUser] trade_analysis error:', anaErr.message)
    }
    counts.analyses = analyses?.length || 0

    // Also update trade_analysis via session_id for rows without direct anon_id
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id)
      await supabase
        .from('trade_analysis')
        .update({ anon_id: null })
        .in('session_id', sessionIds)
        .not('anon_id', 'is', null)
    }

    // Migrate raw_files: set user_id, clear anon_id
    const { data: files, error: fileErr } = await supabase
      .from('raw_files')
      .update({ user_id: userId, anon_id: null })
      .eq('anon_id', anonId)
      .select('id')

    if (fileErr) {
      console.error('[migrateAnonToUser] raw_files error:', fileErr.message)
    }
    counts.files = files?.length || 0

    console.log(`[migrateAnonToUser] Migrated anon=${anonId} to user=${userId}:`, counts)
    return { migrated: true, counts }

  } catch (err) {
    console.error('[migrateAnonToUser] Error:', err)
    return { migrated: false, counts, error: err }
  }
}
