-- Per-trade AI analysis storage
-- Each row = one trade from a session, with full AI coaching output

CREATE TABLE IF NOT EXISTS trade_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES trade_sessions(id) ON DELETE CASCADE,
  trade_index integer NOT NULL,
  symbol text,
  side text,
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  pnl numeric,
  entry_time text,
  exit_time text,
  tag text,
  tag_label text,
  quick_summary text,
  psychology_coaching text,
  counterfactual text,
  technical_analysis text,
  cycle_stage text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_analysis_session ON trade_analysis(session_id);

ALTER TABLE trade_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade analysis" ON trade_analysis
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM trade_sessions
      WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Service can insert trade analysis" ON trade_analysis
  FOR INSERT WITH CHECK (true);
