-- Migration 006: Coupon code system for free beta access
-- Run this in Supabase Dashboard → SQL Editor

-- ─── Coupons table ───
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro_monthly',
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- ─── Redemptions table (one row per (user, coupon) pair) ───
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);

-- ─── RLS (service role only — API routes use service key) ───
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Service can manage coupons') THEN
    CREATE POLICY "Service can manage coupons" ON coupons FOR ALL USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coupon_redemptions' AND policyname = 'Service can manage redemptions') THEN
    CREATE POLICY "Service can manage redemptions" ON coupon_redemptions FOR ALL USING (TRUE);
  END IF;
END $$;

-- ─── Seed beta coupon codes ───
INSERT INTO coupons (code, plan, duration_days, max_uses) VALUES
  ('BETA2026', 'pro_monthly', 90, 50),
  ('TRADESAATHFREE', 'pro_monthly', 30, 20),
  ('EARLYBIRD', 'pro_monthly', 60, 10)
ON CONFLICT (code) DO NOTHING;
