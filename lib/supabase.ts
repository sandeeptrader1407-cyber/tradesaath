import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Browser client — uses anon key, respects RLS
export const supabaseClient = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server/admin client — uses service role key, bypasses RLS
// Only use in API routes, never expose to the browser
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Upsert a user into the users table.
 * Uses supabaseAdmin so it bypasses RLS.
 */
export async function syncUser(clerkId: string, email: string, name: string) {
  const { data, error } = await supabaseAdmin
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
