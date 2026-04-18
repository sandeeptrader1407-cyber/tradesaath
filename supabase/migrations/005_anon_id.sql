-- Add anon_id column to trade_sessions for anonymous user tracking
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS anon_id text;
CREATE INDEX IF NOT EXISTS idx_trade_sessions_anon ON trade_sessions(anon_id);

-- Add anon_id column to trade_analysis
ALTER TABLE trade_analysis ADD COLUMN IF NOT EXISTS anon_id text;
