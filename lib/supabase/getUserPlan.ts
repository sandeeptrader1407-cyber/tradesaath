import { getSupabaseAdmin } from '@/lib/supabase'

export async function getUserPlan(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('user_plans')
    .select('plan, plan_expires_at')
    .eq('user_id', userId)
    .single()

  if (!data) return 'free'

  // Check if subscription has expired
  if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
    return 'free'
  }

  return data.plan || 'free'
}
