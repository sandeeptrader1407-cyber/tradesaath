-- Migration 012: Fix RLS policy exposure (audit findings F-015 + F-016)
--
-- WHY: Migrations 001/002/003/004/006 created policies with `USING (true)` and
-- `WITH CHECK (true)` without role qualifiers. Supabase applies these to ALL
-- roles (anon, authenticated, service_role), which means anyone with the public
-- NEXT_PUBLIC_SUPABASE_ANON_KEY (published in every browser bundle) could:
--   - SELECT every user's trade_sessions / user_plans / coupons / etc.
--   - UPDATE their own user_plans row to a paid plan
--   - INSERT garbage rows into trade_sessions / raw_files / trade_analysis
-- The application code routes everything through API routes using the service-
-- role key, which bypasses RLS by default. So these permissive policies serve
-- NO purpose for legitimate traffic — they only exist as a leak surface.
-- This migration drops them and replaces each with a narrow `TO service_role`
-- policy that documents intent (service_role bypasses RLS regardless, but the
-- explicit policy is defense-in-depth and self-documenting).
--
-- IDEMPOTENT: uses DROP POLICY IF EXISTS so it is safe to re-run.

-- ─── trade_sessions ──────────────────────────────────────────────
-- Drops the permissive INSERT (F-015) and the broad service-management policy.
-- Leaves "Allow read own" and "Allow update own" intact — those use
-- session_key + auth.uid() predicates that already return zero rows for the
-- anon role and are out of scope for this fix.
DROP POLICY IF EXISTS "Allow insert" ON trade_sessions;
DROP POLICY IF EXISTS "Service can manage all sessions" ON trade_sessions;

CREATE POLICY "service_role_only_trade_sessions" ON trade_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── user_plans ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service can manage all plans" ON user_plans;

CREATE POLICY "service_role_only_user_plans" ON user_plans
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── user_journeys ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Service can manage all journeys" ON user_journeys;

CREATE POLICY "service_role_only_user_journeys" ON user_journeys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── trade_analysis ──────────────────────────────────────────────
-- Drops the permissive INSERT. Leaves "Users can view own trade analysis"
-- intact — its JWT-claim predicate returns zero rows for anon and is out of
-- scope for this fix.
DROP POLICY IF EXISTS "Service can insert trade analysis" ON trade_analysis;

CREATE POLICY "service_role_only_trade_analysis" ON trade_analysis
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── raw_files ───────────────────────────────────────────────────
-- F-016: "Users can view own files" had `OR anon_id IS NOT NULL`, which is
-- TRUE for every row that has any anon_id at all — i.e. all guest uploads
-- were readable by anyone with the anon key. Drop both that policy and the
-- permissive INSERT.
DROP POLICY IF EXISTS "Users can view own files" ON raw_files;
DROP POLICY IF EXISTS "Users can insert files" ON raw_files;

CREATE POLICY "service_role_only_raw_files" ON raw_files
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── coupons ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service can manage coupons" ON coupons;

CREATE POLICY "service_role_only_coupons" ON coupons
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── coupon_redemptions ──────────────────────────────────────────
DROP POLICY IF EXISTS "Service can manage redemptions" ON coupon_redemptions;

CREATE POLICY "service_role_only_coupon_redemptions" ON coupon_redemptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── VERIFICATION (run manually after migration) ─────────────────
-- 1. Open a new browser tab in incognito.
-- 2. Visit https://supabase.com/dashboard/project/<your-project>/settings/api
-- 3. Copy the "anon public" key.
-- 4. Replace <PROJECT_REF> and <ANON_KEY> below and run each curl. Each must
--    return an empty JSON array `[]`. If any returns rows, the fix did not land.
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/trade_sessions?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/user_plans?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/user_journeys?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/trade_analysis?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/raw_files?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/coupons?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
--    curl 'https://<PROJECT_REF>.supabase.co/rest/v1/coupon_redemptions?select=*' \
--      -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
-- 5. Smoke-test the app afterwards: sign in, upload a file, view dashboard,
--    and complete a ₹99 test payment. All must still work — service-role
--    paths are unaffected by this migration.
