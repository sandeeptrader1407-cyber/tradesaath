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
