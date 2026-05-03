-- Migration 015: Fix RLS policies — F-015 and F-016
-- -------------------------------------------------------
-- Several tables had FOR ALL / FOR INSERT / FOR SELECT policies scoped to ALL roles,
-- including the anon role. Because the anon key is published in the browser bundle,
-- any visitor could read trade data or enumerate coupon codes.
-- The application exclusively uses the service-role key through server-side API routes,
-- so authenticated-user or anon-facing policies are unnecessary and were only a leak surface.
-- This migration drops each offending policy and replaces it with a TO service_role equivalent.

-- ══════════════════════════════════════════════════════
-- trade_sessions
-- ══════════════════════════════════════════════════════

-- F-015: "Allow insert" applied WITH CHECK (true) to all roles → anyone could insert sessions
DROP POLICY IF EXISTS "Allow insert" ON trade_sessions;

-- F-015: "Service can manage all sessions" used USING (true) without role qualifier
DROP POLICY IF EXISTS "Service can manage all sessions" ON trade_sessions;

-- Replacement: service_role only (API routes use service-role key; bypasses RLS automatically,
-- but an explicit policy prevents future regressions if that changes)
CREATE POLICY "service_role_only_trade_sessions" ON trade_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- user_plans
-- ══════════════════════════════════════════════════════

-- F-015: FOR ALL USING (true) — anon could UPDATE plan='pro_yearly' on any row
DROP POLICY IF EXISTS "Service can manage all plans" ON user_plans;

CREATE POLICY "service_role_only_user_plans" ON user_plans
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- user_journeys
-- ══════════════════════════════════════════════════════

-- F-015: FOR ALL USING (true) — anon could read all users' journey data
DROP POLICY IF EXISTS "Service can manage all journeys" ON user_journeys;

CREATE POLICY "service_role_only_user_journeys" ON user_journeys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- trade_analysis
-- ══════════════════════════════════════════════════════

-- F-015: FOR INSERT WITH CHECK (true) — anon could insert arbitrary coaching rows
DROP POLICY IF EXISTS "Service can insert trade analysis" ON trade_analysis;

CREATE POLICY "service_role_only_trade_analysis" ON trade_analysis
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- raw_files
-- ══════════════════════════════════════════════════════

-- F-016: "Users can view own files" included OR anon_id IS NOT NULL, meaning any request
-- that matches a row with a non-null anon_id could read it — effectively a full table scan
-- for any anonymous caller holding the anon key.
DROP POLICY IF EXISTS "Users can view own files" ON raw_files;

-- F-015: FOR INSERT WITH CHECK (true) — anon could insert arbitrary file rows
DROP POLICY IF EXISTS "Users can insert files" ON raw_files;

CREATE POLICY "service_role_only_raw_files" ON raw_files
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- coupons
-- ══════════════════════════════════════════════════════

-- F-015: FOR ALL USING (TRUE) — anon could enumerate all coupon codes and redemption counts
DROP POLICY IF EXISTS "Service can manage coupons" ON coupons;

CREATE POLICY "service_role_only_coupons" ON coupons
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- coupon_redemptions
-- ══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service can manage redemptions" ON coupon_redemptions;

CREATE POLICY "service_role_only_coupon_redemptions" ON coupon_redemptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ══════════════════════════════════════════════════════
-- VERIFICATION (run manually after applying this migration)
-- ══════════════════════════════════════════════════════
--
-- 1. Open a new browser tab in incognito.
-- 2. Visit https://supabase.com/dashboard/project/dpfraevetqdbqgcpsvro/api
-- 3. Copy the anon key from the "Project API keys" section.
-- 4. Run each of these curl commands and confirm the response is [] (empty array):
--
--    curl 'https://dpfraevetqdbqgcpsvro.supabase.co/rest/v1/trade_sessions?select=*' \
--      -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
--
--    curl 'https://dpfraevetqdbqgcpsvro.supabase.co/rest/v1/user_plans?select=*' \
--      -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
--
--    curl 'https://dpfraevetqdbqgcpsvro.supabase.co/rest/v1/user_journeys?select=*' \
--      -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
--
--    curl 'https://dpfraevetqdbqgcpsvro.supabase.co/rest/v1/raw_files?select=*' \
--      -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
--
--    curl 'https://dpfraevetqdbqgcpsvro.supabase.co/rest/v1/coupons?select=*' \
--      -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
--
--    curl 'https://dpfraevetqdbqgcpsvro.supabase.co/rest/v1/coupon_redemptions?select=*' \
--      -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
--
-- 5. Expected result for every request: {"message":"0 rows"} or []
--    If you receive any rows, the migration did not apply correctly — check pg_policies.
--
-- 6. Also verify the app still works end-to-end by uploading a test file and
--    confirming analysis completes (service-role path must be unaffected).
