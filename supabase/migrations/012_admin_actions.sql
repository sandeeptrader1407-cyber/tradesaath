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
