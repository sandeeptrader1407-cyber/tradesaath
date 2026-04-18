-- Migration 002: Add computed KPI columns to trade_sessions + create user_plans table
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Add KPI columns to existing trade_sessions table ───
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS trade_count INTEGER DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS net_pnl NUMERIC DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS win_count INTEGER DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS loss_count INTEGER DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS win_rate NUMERIC DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS profit_factor NUMERIC DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS best_trade NUMERIC DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS worst_trade NUMERIC DEFAULT 0;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS detected_market TEXT;
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS detected_currency TEXT DEFAULT 'INR';
ALTER TABLE trade_sessions ADD COLUMN IF NOT EXISTS detected_broker TEXT;

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_trade_sessions_created_at ON trade_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_sessions_trade_date ON trade_sessions(trade_date);

-- ─── User Plans table ───
CREATE TABLE IF NOT EXISTS user_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  plan_started_at TIMESTAMPTZ DEFAULT NOW(),
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);

-- Enable RLS on user_plans
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Service role can manage all plans (API routes use service role key)
CREATE POLICY "Service can manage all plans" ON user_plans FOR ALL USING (true);

-- Also add service-level policy on trade_sessions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trade_sessions' AND policyname = 'Service can manage all sessions'
  ) THEN
    CREATE POLICY "Service can manage all sessions" ON trade_sessions FOR ALL USING (true);
  END IF;
END $$;
