-- Migration: 009_payments_table
-- Purpose: Document the payments table (created manually, now tracked in migrations)
-- Note: This table already exists in production. Use CREATE TABLE IF NOT EXISTS to be safe.
-- user_id references the Supabase auth user UUID (not clerk_id).

CREATE TABLE IF NOT EXISTS public.payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  amount      integer NOT NULL,
  currency    text NOT NULL DEFAULT 'INR',
  plan        text NOT NULL,
  provider    text NOT NULL DEFAULT 'razorpay',
  status      text NOT NULL DEFAULT 'pending',
  payment_id  text,
  created_at  timestamptz DEFAULT now()
);

-- Index for looking up payments by user
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);

-- Index for looking up by provider payment ID (used in webhook verification)
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments (payment_id);

-- RLS: enable and add SELECT policy so users can only read their own payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own payments"
  ON public.payments FOR SELECT
  USING (user_id = auth.uid());
