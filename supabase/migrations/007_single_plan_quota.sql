-- Migration 007: Add session_quota tracking for Single (Starter) plan
-- Single plan: ₹99 one-time, unlocks all past sessions + 50 future analyses

-- Add session_quota column to user_plans (NULL = unlimited for pro plans)
ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS session_quota integer DEFAULT NULL;

-- Add sessions_used counter
ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS sessions_used integer DEFAULT 0;

-- When a single-plan user uploads, the analyse route will:
--   1. Check session_quota IS NOT NULL AND sessions_used < session_quota
--   2. Increment sessions_used after successful analysis
-- Pro plans have session_quota = NULL (unlimited).
