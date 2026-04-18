-- Module 1: Raw-first intake pipeline — DB migration
-- Run this in Supabase SQL Editor before deploying

-- 1. Add raw_file_id column to trade_sessions (links session to its raw file)
ALTER TABLE trade_sessions
  ADD COLUMN IF NOT EXISTS raw_file_id UUID REFERENCES raw_files(id) ON DELETE SET NULL;

-- 2. Ensure raw_files table has all columns needed by Module 1 saveRawData
-- (These columns may already exist from the old saveRawFile — add only if missing)
DO $$
BEGIN
  -- Structured raw data (JSONB) — the core of raw-first architecture
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'raw_data') THEN
    ALTER TABLE raw_files ADD COLUMN raw_data JSONB;
  END IF;

  -- File hash for dedup
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'file_hash') THEN
    ALTER TABLE raw_files ADD COLUMN file_hash TEXT;
  END IF;

  -- Filename (may exist as file_name from old schema)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'filename') THEN
    ALTER TABLE raw_files ADD COLUMN filename TEXT;
  END IF;

  -- Market, currency, trade_date metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'broker') THEN
    ALTER TABLE raw_files ADD COLUMN broker TEXT DEFAULT 'Unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'market') THEN
    ALTER TABLE raw_files ADD COLUMN market TEXT DEFAULT 'Unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'currency') THEN
    ALTER TABLE raw_files ADD COLUMN currency TEXT DEFAULT 'INR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'trade_date') THEN
    ALTER TABLE raw_files ADD COLUMN trade_date TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'row_count') THEN
    ALTER TABLE raw_files ADD COLUMN row_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'extraction_warnings') THEN
    ALTER TABLE raw_files ADD COLUMN extraction_warnings JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Index for fast duplicate check
CREATE INDEX IF NOT EXISTS idx_raw_files_user_hash ON raw_files(user_id, file_hash);

-- 4. Index for linking sessions to raw files
CREATE INDEX IF NOT EXISTS idx_trade_sessions_raw_file_id ON trade_sessions(raw_file_id);
