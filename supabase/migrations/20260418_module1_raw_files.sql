-- Module 1: Raw-first intake pipeline — DB migration (v2)
-- Run this in Supabase SQL Editor before deploying
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- 1. Add raw_file_id column to trade_sessions (links session to its raw file)
ALTER TABLE trade_sessions
  ADD COLUMN IF NOT EXISTS raw_file_id UUID REFERENCES raw_files(id) ON DELETE SET NULL;

-- 2. Add all Module 1 columns to raw_files table
-- Uses DO $$ block for safe IF NOT EXISTS checks on each column
DO $$
BEGIN
  -- ── Core Module 1 columns ──

  -- Structured raw data (JSONB) — the core of raw-first architecture
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'raw_data') THEN
    ALTER TABLE raw_files ADD COLUMN raw_data JSONB;
  END IF;

  -- File hash for dedup (SHA-256)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'file_hash') THEN
    ALTER TABLE raw_files ADD COLUMN file_hash TEXT;
  END IF;

  -- Broker identification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'broker_id') THEN
    ALTER TABLE raw_files ADD COLUMN broker_id TEXT DEFAULT 'unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'broker_name') THEN
    ALTER TABLE raw_files ADD COLUMN broker_name TEXT DEFAULT 'Unknown';
  END IF;

  -- Market and currency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'market') THEN
    ALTER TABLE raw_files ADD COLUMN market TEXT DEFAULT 'Unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'currency') THEN
    ALTER TABLE raw_files ADD COLUMN currency TEXT DEFAULT 'INR';
  END IF;

  -- Column headers from file (JSONB array)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'headers') THEN
    ALTER TABLE raw_files ADD COLUMN headers JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- Row counts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'total_rows') THEN
    ALTER TABLE raw_files ADD COLUMN total_rows INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'data_rows') THEN
    ALTER TABLE raw_files ADD COLUMN data_rows INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'skipped_rows') THEN
    ALTER TABLE raw_files ADD COLUMN skipped_rows INTEGER DEFAULT 0;
  END IF;

  -- Time column detection
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'has_time_column') THEN
    ALTER TABLE raw_files ADD COLUMN has_time_column BOOLEAN DEFAULT false;
  END IF;

  -- Date range
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'date_range_start') THEN
    ALTER TABLE raw_files ADD COLUMN date_range_start TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'date_range_end') THEN
    ALTER TABLE raw_files ADD COLUMN date_range_end TEXT;
  END IF;

  -- Column mapping (header→standard field)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'column_mapping') THEN
    ALTER TABLE raw_files ADD COLUMN column_mapping JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Parser metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'parser_version') THEN
    ALTER TABLE raw_files ADD COLUMN parser_version TEXT DEFAULT 'unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'parsed_at') THEN
    ALTER TABLE raw_files ADD COLUMN parsed_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Warnings (replaces old extraction_warnings)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'raw_files' AND column_name = 'warnings') THEN
    ALTER TABLE raw_files ADD COLUMN warnings JSONB DEFAULT '[]'::jsonb;
  END IF;

END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_raw_files_user_hash ON raw_files(user_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_trade_sessions_raw_file_id ON trade_sessions(raw_file_id);
CREATE INDEX IF NOT EXISTS idx_raw_files_broker_id ON raw_files(broker_id);
CREATE INDEX IF NOT EXISTS idx_raw_files_parsed_at ON raw_files(parsed_at);
