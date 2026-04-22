-- Migration 012: Admin audit log
-- Every admin action (plan changes, quota resets, flag toggles) is recorded here.

CREATE TABLE IF NOT EXISTS admin_actions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_clerk_id   text NOT NULL,
  target_user_id   text NOT NULL,
  action           text NOT NULL,
  payload          jsonb,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin    ON admin_actions (admin_clerk_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target   ON admin_actions (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created  ON admin_actions (created_at DESC);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage admin_actions" ON admin_actions FOR ALL USING (true);
-- Migration 013: Feature flags stored in DB
-- Admins toggle these from the admin panel. AI routes read them at request time.

CREATE TABLE IF NOT EXISTS feature_flags (
  key        text PRIMARY KEY,
  value      boolean NOT NULL DEFAULT false,
  updated_by text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage feature_flags" ON feature_flags FOR ALL USING (true);

INSERT INTO feature_flags (key, value) VALUES
  ('DISABLE_AI_ANALYSIS',    false),
  ('DISABLE_BATCH_ANALYSIS', false)
ON CONFLICT (key) DO NOTHING;
-- Migration 014: AI cost tracking
-- Every Claude API call is logged here for spend monitoring.
-- Cost formula: (input_tokens * 3 + output_tokens * 15) / 1_000_000 USD

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             text NOT NULL,
  route               text NOT NULL,
  model               text NOT NULL,
  input_tokens        integer DEFAULT 0,
  output_tokens       integer DEFAULT 0,
  estimated_cost_usd  numeric(10,6) DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user   ON ai_usage_log (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date   ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_route  ON ai_usage_log (route);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service can manage ai_usage_log" ON ai_usage_log FOR ALL USING (true);
