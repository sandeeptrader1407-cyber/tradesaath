-- Run this in your Supabase SQL editor
-- TradeSaath Trade Sessions table for storing parsed trades + analysis

create table if not exists trade_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id text,                          -- Clerk user ID, nullable for free/anonymous
  session_key text unique not null,      -- random UUID generated on client for anonymous sessions
  broker text not null,
  broker_name text not null,
  file_name text,
  trade_date date,                       -- date of first trade in session
  trades jsonb not null,                 -- full StandardTrade[] array
  raw_row_count int,
  parsed_count int,
  context jsonb,                         -- trading context answers (mood, strategy, etc.)
  analysis jsonb,                        -- Claude's free analysis result
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for user lookups
create index if not exists trade_sessions_user_id_idx on trade_sessions(user_id);
create index if not exists trade_sessions_session_key_idx on trade_sessions(session_key);

-- RLS
alter table trade_sessions enable row level security;

-- Allow anyone to insert (free anonymous analysis)
create policy "Allow insert" on trade_sessions for insert with check (true);

-- Allow read by session_key (anonymous) or user_id (logged in)
create policy "Allow read own" on trade_sessions for select
  using (session_key = current_setting('app.session_key', true) or user_id = auth.uid()::text);

-- Allow update by session_key
create policy "Allow update own" on trade_sessions for update
  using (session_key = current_setting('app.session_key', true) or user_id = auth.uid()::text);
