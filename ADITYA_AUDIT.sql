-- ============================================================================
-- ADITYA DATA-ACCURACY AUDIT — run sections 1-8 in Supabase SQL Editor
-- ============================================================================
-- HOW TO USE:
--   1. Open https://supabase.com/dashboard → TradeSaath → SQL Editor → New query
--   2. Paste SECTION 1, click Run, copy the clerk_id from the result.
--   3. For SECTIONS 2-8: replace every  <CLERK>  with Aditya's clerk_id and Run.
--   4. Paste each section's result back in chat.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — FIND ADITYA'S ACCOUNT
-- ============================================================================
SELECT clerk_id, email, created_at, plan
  FROM users
 WHERE email ILIKE '%aditya%'
 ORDER BY created_at DESC;

-- If the email search misses, also try recent signups:
-- SELECT clerk_id, email, created_at
--   FROM users
--  WHERE created_at > NOW() - INTERVAL '7 days'
--  ORDER BY created_at DESC
--  LIMIT 10;


-- ============================================================================
-- SECTION 2 — ALL UPLOADS BY ADITYA
--   Integrity check: data_rows SHOULD equal raw_rows_stored
-- ============================================================================
SELECT
  id                                                            AS raw_file_id,
  file_name,
  file_type,
  file_size_bytes,
  broker_id,
  broker_name,
  market,
  currency,
  total_rows,
  data_rows,
  skipped_rows,
  parser_version,
  jsonb_array_length(COALESCE(raw_data, '[]'::jsonb))            AS raw_rows_stored,
  (data_rows = jsonb_array_length(COALESCE(raw_data,'[]'::jsonb)))
                                                                 AS parse_integrity_ok,
  has_time_column,
  date_range_start,
  date_range_end,
  (file_hash IS NOT NULL)                                        AS has_hash,
  COALESCE(parsed_at, uploaded_at)                               AS when_uploaded,
  warnings,
  extraction_warnings
FROM raw_files
WHERE user_id = '<CLERK>'
ORDER BY COALESCE(parsed_at, uploaded_at) DESC;


-- ============================================================================
-- SECTION 3 — SESSIONS BUILT FROM THOSE UPLOADS
--   Integrity check: trade_count SHOULD equal trades_json_count
-- ============================================================================
SELECT
  ts.id                                                          AS session_id,
  ts.trade_date,
  ts.trade_count,
  ts.net_pnl,
  ts.gross_pnl,
  ts.win_count,
  ts.loss_count,
  ts.raw_file_id,
  ts.created_at,
  ts.updated_at,
  (ts.analysis->>'analysed_version')::int                        AS analysed_version,
  jsonb_array_length(COALESCE(ts.trades, '[]'::jsonb))           AS trades_json_count,
  (ts.trade_count = jsonb_array_length(COALESCE(ts.trades,'[]'::jsonb)))
                                                                 AS count_integrity_ok,
  (ts.updated_at > ts.created_at + INTERVAL '5 seconds')         AS was_rewritten_after_insert,
  rf.file_name,
  rf.data_rows                                                   AS raw_data_rows
FROM trade_sessions ts
LEFT JOIN raw_files rf ON ts.raw_file_id = rf.id
WHERE ts.user_id = '<CLERK>'
ORDER BY ts.trade_date DESC;


-- ============================================================================
-- SECTION 4 — FIELD-BY-FIELD SAMPLE (first 3 trades of most recent session)
--   Run in TWO parts. First this:
-- ============================================================================
SELECT
  trade_date,
  trades->0                                                      AS first_trade,
  trades->1                                                      AS second_trade,
  trades->2                                                      AS third_trade,
  raw_file_id
FROM trade_sessions
WHERE user_id = '<CLERK>'
ORDER BY trade_date DESC
LIMIT 1;

-- Then copy the raw_file_id from that result and run:
-- SELECT
--   raw_data->0  AS raw_first,
--   raw_data->1  AS raw_second,
--   raw_data->2  AS raw_third,
--   headers,
--   column_mapping
-- FROM raw_files
-- WHERE id = '<raw_file_id from above>';


-- ============================================================================
-- SECTION 5 — SIMULATE DASHBOARD TOTALS
-- ============================================================================
-- Totals the dashboard SHOULD show (from pre-computed row columns):
SELECT
  COUNT(*)                                                       AS total_sessions,
  COALESCE(SUM(trade_count), 0)                                  AS total_trades,
  COALESCE(SUM(net_pnl), 0)                                      AS total_net_pnl,
  COALESCE(SUM(gross_pnl), 0)                                    AS total_gross_pnl,
  COALESCE(SUM(win_count), 0)                                    AS total_wins,
  COALESCE(SUM(loss_count), 0)                                   AS total_losses,
  ROUND(
    COALESCE(SUM(win_count), 0)::numeric
    / NULLIF(COALESCE(SUM(win_count)+SUM(loss_count), 0), 0)
    * 100, 2
  )                                                              AS win_rate_pct
FROM trade_sessions
WHERE user_id = '<CLERK>';

-- Re-computed totals from the JSONB trades array (should match above if
-- the per-row aggregates are trustworthy):
SELECT
  COUNT(*)                                                       AS total_sessions,
  SUM(jsonb_array_length(COALESCE(trades,'[]'::jsonb)))          AS trades_from_jsonb,
  SUM((
    SELECT COALESCE(SUM((t->>'pnl')::numeric), 0)
    FROM jsonb_array_elements(COALESCE(trades,'[]'::jsonb)) t
  ))                                                             AS pnl_from_jsonb
FROM trade_sessions
WHERE user_id = '<CLERK>';


-- ============================================================================
-- SECTION 6 — DATE INTEGRITY
--   Does session.trade_date match the dates inside the trades JSONB?
-- ============================================================================
SELECT
  trade_date                                                     AS session_date,
  trades->0->>'date'                                             AS first_trade_date,
  trades->0->>'entry_time'                                       AS first_entry_time,
  trades->(jsonb_array_length(COALESCE(trades,'[]'::jsonb)) - 1)->>'date'
                                                                 AS last_trade_date,
  created_at,
  updated_at,
  created_at AT TIME ZONE 'Asia/Kolkata'                         AS created_in_ist
FROM trade_sessions
WHERE user_id = '<CLERK>'
ORDER BY trade_date DESC
LIMIT 10;


-- ============================================================================
-- SECTION 7 — PER-TRADE RE-AGGREGATION (drill-down on one session)
--   Tells us whether session.net_pnl = SUM(trades[*].pnl)
-- ============================================================================
-- Pick the session_id you suspect is wrong from SECTION 3 and paste below.
WITH s AS (
  SELECT *
    FROM trade_sessions
   WHERE id = '<SESSION_ID>'
)
SELECT
  s.trade_date,
  s.trade_count                                                  AS stored_count,
  jsonb_array_length(COALESCE(s.trades,'[]'::jsonb))             AS jsonb_count,
  s.net_pnl                                                      AS stored_net_pnl,
  (SELECT COALESCE(SUM((t->>'pnl')::numeric), 0)
     FROM jsonb_array_elements(COALESCE(s.trades,'[]'::jsonb)) t) AS jsonb_net_pnl,
  s.win_count                                                    AS stored_wins,
  (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(s.trades,'[]'::jsonb)) t
     WHERE (t->>'pnl')::numeric > 0)                             AS jsonb_wins,
  s.loss_count                                                   AS stored_losses,
  (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(s.trades,'[]'::jsonb)) t
     WHERE (t->>'pnl')::numeric < 0)                             AS jsonb_losses
FROM s;


-- ============================================================================
-- SECTION 8 — DUPLICATE TRADE DETECTION (did merge corrupt the session?)
--   Lists trades that appear more than once in the JSONB — a classic
--   merge-dedup failure symptom.
-- ============================================================================
WITH exploded AS (
  SELECT
    id                                                           AS session_id,
    trade_date,
    t->>'symbol'                                                 AS symbol,
    t->>'side'                                                   AS side,
    COALESCE(t->>'qty', t->>'quantity')                          AS qty,
    COALESCE(t->>'entry_price', t->>'entryPrice')                AS entry,
    COALESCE(t->>'exit_price', t->>'exitPrice')                  AS exit_,
    COALESCE(t->>'entry_time', t->>'entryTime')                  AS entry_time,
    t->>'pnl'                                                    AS pnl
  FROM trade_sessions,
       jsonb_array_elements(COALESCE(trades,'[]'::jsonb)) t
  WHERE user_id = '<CLERK>'
)
SELECT
  session_id,
  trade_date,
  symbol, side, qty, entry, exit_, entry_time, pnl,
  COUNT(*)                                                       AS occurrences
FROM exploded
GROUP BY session_id, trade_date, symbol, side, qty, entry, exit_, entry_time, pnl
HAVING COUNT(*) > 1
ORDER BY trade_date DESC, occurrences DESC;
