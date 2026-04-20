-- Migration: 008_users_table
-- Purpose: Document the public.users table (created manually, now tracked in migrations)
-- Note: This table already exists in production. Use CREATE TABLE IF NOT EXISTS to be safe.
-- The clerk_id column stores the Clerk user ID and is the primary lookup key.

CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    text NOT NULL UNIQUE,
  email       text NOT NULL,
  name        text,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz DEFAULT now()
);

-- Index for fast lookup by clerk_id (used by webhooks and plan checks)
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON public.users (clerk_id);

-- Index on email for lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- RLS: enable and add SELECT policy so users can only read their own row
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own row"
  ON public.users FOR SELECT
  USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');
