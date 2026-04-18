-- User Journeys table for Trading Journey questionnaire
CREATE TABLE IF NOT EXISTS user_journeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  experience TEXT,
  instruments TEXT,
  challenge TEXT,
  goal TEXT,
  perfect_day TEXT,
  one_change TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_journeys_user_id ON user_journeys(user_id);

ALTER TABLE user_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage all journeys" ON user_journeys FOR ALL USING (true);
