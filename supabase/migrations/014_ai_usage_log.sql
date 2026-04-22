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
