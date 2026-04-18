-- TradeSaath: Raw Files Table for raw-first data architecture
-- Run this migration in your Supabase SQL editor

-- Create the raw_files table
CREATE TABLE IF NOT EXISTS raw_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id UUID REFERENCES trade_sessions(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  broker TEXT NOT NULL DEFAULT 'Unknown',
  market TEXT NOT NULL DEFAULT 'Unknown',
  currency TEXT NOT NULL DEFAULT '',
  trade_date TEXT NOT NULL DEFAULT '',
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  extraction_warnings TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dedup lookups
CREATE INDEX IF NOT EXISTS idx_raw_files_user_hash ON raw_files(user_id, file_hash);

-- Index for listing files by user
CREATE INDEX IF NOT EXISTS idx_raw_files_user_date ON raw_files(user_id, created_at DESC);

-- Add raw_file_id to trade_sessions for linking
ALTER TABLE trade_sessions
  ADD COLUMN IF NOT EXISTS raw_file_id UUID REFERENCES raw_files(id) ON DELETE SET NULL;

-- RLS policies
ALTER TABLE raw_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own raw files"
  ON raw_files FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can insert raw files"
  ON raw_files FOR INSERT
  WITH CHECK (true);

-- Grant access
GRANT SELECT ON raw_files TO authenticated;
GRANT ALL ON raw_files TO service_role;
