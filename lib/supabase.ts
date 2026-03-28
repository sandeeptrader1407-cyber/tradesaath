import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _admin: SupabaseClient | null = null

// Browser client — uses anon key, respects RLS
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing SUPABASE env vars')
    _client = createClient(url, key)
  }
  return _client
}

// Server/admin client — uses service role key, bypasses RLS
// Only use in API routes, never expose to the browser
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing SUPABASE env vars')
    _admin = createClient(url, key)
  }
  return _admin
}

// Backward-compatible exports (lazy getters)
export const supabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getSupabaseClient() as any)[prop] }
})

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getSupabaseAdmin() as any)[prop] }
})

/**
 * Upsert a user into the users table.
 * Uses supabaseAdmin so it bypasses RLS.
 */
export async function syncUser(clerkId: string, email: string, name: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('users')
    .upsert(
      { clerk_id: clerkId, email, name },
      { onConflict: 'clerk_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
