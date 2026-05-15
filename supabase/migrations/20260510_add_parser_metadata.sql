-- ────────────────────────────────────────────────────────────────────
-- 20260510 — Parser metadata columns on trade_sessions
-- ────────────────────────────────────────────────────────────────────
--
-- Captures which parser handled each upload (AI vs legacy chain), the
-- cost in USD, wall-clock duration, and the model identifier. Powers
-- the admin parser-metrics dashboard (Prompt 5B) and per-session
-- reparse capability.
--
-- All columns are nullable — legacy sessions (uploaded before AI parser
-- shipped) will simply have null values, displayed as 'legacy' in the
-- admin dashboard.
--
-- IDEMPOTENT: uses IF NOT EXISTS so re-runs are safe.

ALTER TABLE trade_sessions
  ADD COLUMN IF NOT EXISTS parser_used text,
  ADD COLUMN IF NOT EXISTS parser_cost_usd numeric(10, 6),
  ADD COLUMN IF NOT EXISTS parser_duration_ms integer,
  ADD COLUMN IF NOT EXISTS parser_model_name text;

-- Indexes for admin dashboard queries (Prompt 5B).
-- Partial indexes — only non-null parser_used rows are interesting.
CREATE INDEX IF NOT EXISTS idx_trade_sessions_parser_used
  ON trade_sessions(parser_used)
  WHERE parser_used IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trade_sessions_parser_created
  ON trade_sessions(created_at DESC)
  WHERE parser_used IS NOT NULL;

-- Comment documentation for future spelunkers
COMMENT ON COLUMN trade_sessions.parser_used IS
  'Which parser produced this session: ''gemini'', ''claude-haiku'', or legacy parser name (''pdf-coord'', ''pdf-ocr'', etc.). NULL for pre-AI-parser sessions.';
COMMENT ON COLUMN trade_sessions.parser_cost_usd IS
  'USD cost of AI parser call. 0 for legacy parsers, NULL for pre-AI sessions.';
COMMENT ON COLUMN trade_sessions.parser_duration_ms IS
  'Wall-clock duration of the parse step in milliseconds.';
COMMENT ON COLUMN trade_sessions.parser_model_name IS
  'Full model identifier (e.g., ''gemini-2.5-flash'', ''claude-haiku-4-5-20251001''). NULL for legacy.';
