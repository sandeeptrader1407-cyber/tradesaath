-- Migration: 009_payments_table
-- Aligned with production schema as of 2026-05-03.
-- Previous version had column type mismatches (user_id uuid vs clerk_id text,
-- single payment_id vs separate razorpay_order_id + razorpay_payment_id) that
-- would silently break payment writes on a fresh DB restore or staging deploy.
-- Columns and types derived from app/api/payments/create-order/route.ts and
-- app/api/webhooks/razorpay/route.ts.

CREATE TABLE IF NOT EXISTS public.payments (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id             text,                                -- Clerk user ID (not Supabase UUID)
  email                text,                                -- user email for Razorpay prefill / audit
  razorpay_order_id    text,                                -- set on order creation; used for webhook lookup
  razorpay_payment_id  text,                                -- set on payment.captured webhook
  plan                 text        NOT NULL,
  amount               integer     NOT NULL,                -- amount in paise (INR smallest unit)
  currency             text        NOT NULL DEFAULT 'INR',
  status               text        NOT NULL DEFAULT 'pending', -- pending | completed | failed
  completed_at         timestamptz,                         -- set when status → completed
  created_at           timestamptz DEFAULT now()
);

-- Lookup by Clerk user (create-order and admin queries)
CREATE INDEX IF NOT EXISTS idx_payments_clerk_id
  ON public.payments (clerk_id);

-- Lookup by Razorpay order ID (webhook: idempotency check + amount verification)
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id
  ON public.payments (razorpay_order_id);

-- Lookup by Razorpay payment ID (webhook: duplicate-capture guard)
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id
  ON public.payments (razorpay_payment_id);

-- Analytics / admin: recent payments by status
CREATE INDEX IF NOT EXISTS idx_payments_status_created
  ON public.payments (status, created_at DESC);

-- RLS: service_role only — all writes go through server-side API routes
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
DROP POLICY IF EXISTS "service_role_only_payments" ON public.payments;

CREATE POLICY "service_role_only_payments" ON public.payments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
