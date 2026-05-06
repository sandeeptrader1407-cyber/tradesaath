-- Add open_position_count to trade_sessions
-- Code in lib/supabase/saveTrades.ts has been writing this column
-- since the closed-trades redefinition of trade_count, but the
-- migration was never authored. PGRST204 errors in production
-- confirmed the column is missing from the schema cache.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running is safe.
ALTER TABLE trade_sessions
  ADD COLUMN IF NOT EXISTS open_position_count INTEGER DEFAULT 0;

-- Backfill existing rows: count open positions in the trades JSONB
-- where exit_price is null/zero AND pnl is zero, mirroring
-- isOpenPosition() in lib/supabase/saveTrades.ts.
UPDATE trade_sessions
SET open_position_count = (
  SELECT COUNT(*)
  FROM jsonb_array_elements(trades) AS t
  WHERE
    (t->>'exit_price' IS NULL OR (t->>'exit_price')::numeric = 0)
    AND (t->>'pnl' IS NULL OR (t->>'pnl')::numeric = 0)
)
WHERE open_position_count = 0
  AND trades IS NOT NULL
  AND jsonb_typeof(trades) = 'array';

-- Note: the WHERE open_position_count = 0 guard means re-running
-- the backfill won't double-count. New rows inserted by the
-- application will populate this column directly via the
-- saveSession code path; backfill only handles legacy rows.
