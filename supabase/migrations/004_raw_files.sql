-- Raw uploaded files tracking
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS raw_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,              -- Clerk user ID (null for anonymous)
  anon_id text,              -- Anonymous session ID (for pre-login users)
  session_id uuid REFERENCES trade_sessions(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,   -- pdf, csv, xlsx, png, jpg
  file_size_bytes bigint,
  storage_path text,         -- Supabase storage path
  broker_detected text,      -- Auto-detected broker name
  trades_count integer,      -- Number of trades found in file
  uploaded_at timestamptz DEFAULT now(),
  analysed_at timestamptz    -- When analysis was completed
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_raw_files_user ON raw_files(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_files_anon ON raw_files(anon_id);

-- RLS policies
ALTER TABLE raw_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON raw_files
  FOR SELECT USING (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR anon_id IS NOT NULL
  );

CREATE POLICY "Users can insert files" ON raw_files
  FOR INSERT WITH CHECK (true);
