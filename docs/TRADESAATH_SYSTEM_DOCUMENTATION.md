# TradeSaath System Documentation

> Generated from codebase read on 2026-04-17. Every value comes from actual source code.

---

## 1. System Overview

TradeSaath is a trading psychology analytics platform for Indian retail traders. Users upload broker trade files (CSV, Excel, PDF), and the system parses trades, detects behavioral mistakes (revenge trading, FOMO, panic exits, etc.) using a deterministic multi-signal pattern detector, computes a Decision Quality Score across 7 factors, and provides AI-powered coaching via Claude. The goal is to show traders the real rupee cost of their emotional mistakes and help them improve discipline over time.

### Tech Stack (from package.json)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript | ^5 |
| UI | React | ^18 |
| Styling | Tailwind CSS | ^3.4.1 |
| Auth | Clerk (@clerk/nextjs) | ^6.39.0 |
| Database | Supabase (@supabase/supabase-js) | ^2.99.3 |
| Payments | Razorpay | ^2.9.6 |
| AI | Anthropic Claude SDK (@anthropic-ai/sdk) | ^0.80.0 |
| State | Zustand | ^5.0.12 |
| CSV Parsing | PapaParse | ^5.5.3 |
| Excel Parsing | SheetJS (xlsx) | ^0.18.5 |
| PDF Parsing | pdf-parse + unpdf | ^1.1.1 / ^1.4.0 |
| OCR | Tesseract.js | ^7.0.0 |
| Webhooks | Svix | ^1.88.0 |
| IDs | uuid | ^13.0.0 |

### Deployment Architecture

```
User Browser
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel      │────▶│   Supabase    │     │   Anthropic   │
│  (Next.js)    │     │  (PostgreSQL) │     │  (Claude API) │
│               │────▶│               │     │               │
│  App Router   │     │  Tables:      │     │  Models:      │
│  API Routes   │     │  - users      │     │  - Sonnet 4   │
│  Middleware    │     │  - trade_     │     │  - Haiku 4.5  │
│               │     │    sessions   │     │               │
└──────┬───────┘     │  - trade_     │     └───────────────┘
       │              │    analysis   │
       │              │  - user_plans │
       ▼              │  - payments   │
┌──────────────┐     │  - raw_files  │
│    Clerk      │     └──────────────┘
│  (Auth/SSO)   │
└──────────────┘     ┌──────────────┐
                     │   Razorpay    │
                     │  (Payments)   │
                     └──────────────┘
```

### Environment Variables

| Variable | Purpose | Used By |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (RLS enforced) | Browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypasses RLS) | Server only |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | Browser |
| `CLERK_SECRET_KEY` | Clerk backend key | Server |
| `CLERK_WEBHOOK_SECRET` | Svix signature verification | Webhook route |
| `ANTHROPIC_API_KEY` | Claude API access | Analysis, Chat, Coach |
| `RAZORPAY_KEY_ID` | Razorpay public key | Payment creation |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | Signature verification |

---

## 2. Complete Data Flow

### 2.1 Upload-to-Dashboard Pipeline

```
USER UPLOADS FILE
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/parse  (local, no AI, free)                  │
│                                                         │
│  1. Detect file type (.csv / .xlsx / .pdf)              │
│  2. Extract raw rows:                                   │
│     - CSV: PapaParse, scan first 15 lines for header    │
│     - Excel: SheetJS, scan first 15 rows for header     │
│     - PDF: unpdf → pdf-parse → raw BT/ET scan          │
│       Special parsers: Fyers order book, Kotak PDF      │
│  3. Detect broker via BROKER_REGISTRY (18 brokers)      │
│     Phase 1: instant-match high-specificity keywords    │
│     Phase 2: fallback ≥2 keyword matches                │
│  4. Pair trades: FIFO matching by symbol + date         │
│  5. Calculate preview KPIs                              │
│  6. Return preview to UI                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/analyse  (AI extraction, rate: 5/IP/15min)   │
│  maxDuration: 90s                                       │
│                                                         │
│  1. Claude Sonnet extracts trades from file content      │
│     (symbol, side, entry/exit price, qty, times, pnl)   │
│  2. Groups trades by date (multi-day file support)       │
│  3. For each date group:                                │
│     a. detectPatterns() — deterministic, 7 patterns     │
│     b. buildAnalysisJSON() — DQS, coaching, summaries   │
│     c. Optional: generateAICoaching() via Haiku         │
│     d. saveTradeSession() — insert into trade_sessions  │
│     e. saveTradeAnalysis() — insert per-trade rows      │
│  4. Return analysis + sessionId                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Batch Re-Analysis (from Dashboard)                     │
│                                                         │
│  POST /api/analyse/batch  (rate: 10/user/5min)          │
│  → Creates in-memory batch, CONCURRENCY = 3             │
│  → Calls analyseSession() per job                       │
│                                                         │
│  GET /api/analyse/batch?batchId=xxx  (polling)          │
│  → Returns job statuses every 1500ms                    │
│                                                         │
│  analyseSession() flow:                                 │
│  1. Fetch session, verify ownership                     │
│  2. Version gate: skip if analysed_version ≥ 4          │
│  3. Fetch user baselines (last 30 sessions):            │
│     - userAvgDailyTrades = mean(trade_count)            │
│     - userTypicalQty = median(qty) across ≤500 trades   │
│  4. detectPatterns(trades, {baselines})                  │
│  5. buildAnalysisJSON(session, result)                   │
│  6. Persist to trade_analysis + trade_sessions.analysis  │
│  7. Mirror dqs_score to trade_sessions column           │
│  8. bustDashboardCache(userId)                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  GET /api/dashboard/stats  (cache: 60s in-memory)       │
│                                                         │
│  1. Fetch ALL sessions for user                         │
│  2. computeAllPeriodKPIs(sessions)                      │
│     → allTime, thisMonth, thisWeek, today               │
│  3. Compute streaks (current, bestWin, worstLoss)       │
│  4. Fetch trade_analysis rows for all sessions          │
│  5. Aggregate mistake patterns from analysis JSONB      │
│  6. Apply global cost cap (85% of gross loss)           │
│  7. Build heatmap from trades (JSONB → TA rows → FB)    │
│  8. Compute bestTimeSlot (highest WR, min 5 trades)     │
│  9. Average DQS across all analysed sessions            │
│  10. Return complete dashboard payload                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
                 DASHBOARD UI
         (17 widgets, all from API)
```

### 2.2 Supabase Table Schema

```
┌─────────────────────────────────────────────┐
│  users                                       │
│  ├── clerk_id (PK)                          │
│  ├── email, name                            │
│  └── plan (free/single/pro_monthly/yearly)  │
├─────────────────────────────────────────────┤
│  user_plans                                  │
│  ├── user_id → users.clerk_id              │
│  ├── plan                                   │
│  └── plan_expires_at                        │
├─────────────────────────────────────────────┤
│  trade_sessions                              │
│  ├── id (UUID, PK)                          │
│  ├── user_id / anon_id                      │
│  ├── trades (JSONB — raw trade array)       │
│  ├── analysis (JSONB — full analysis)       │
│  │   ├── analysed_at, analysed_version      │
│  │   ├── dqs {score, grade, factors[]}      │
│  │   ├── mistake_patterns[]                 │
│  │   ├── trade_analyses[]                   │
│  │   ├── momentum_indicators[]              │
│  │   └── rules_for_next_session[]           │
│  ├── dqs_score (mirror of analysis.dqs)     │
│  ├── trade_count, net_pnl, win_rate         │
│  ├── win_count, loss_count                  │
│  ├── profit_factor, best_trade, worst_trade │
│  ├── trade_date, broker, detected_market    │
│  └── created_at, updated_at                 │
├─────────────────────────────────────────────┤
│  trade_analysis                              │
│  ├── session_id → trade_sessions.id         │
│  ├── trade_index                            │
│  ├── symbol, side, entry/exit price, qty    │
│  ├── pnl, entry_time, exit_time             │
│  ├── tag (rvg/fomo/pnc/avg/over/size/late) │
│  ├── tag_label, quick_summary               │
│  ├── psychology_coaching, counterfactual     │
│  ├── technical_analysis, cycle_stage        │
│  └── notes (user-editable)                  │
├─────────────────────────────────────────────┤
│  payments                                    │
│  ├── user_id                                │
│  ├── razorpay_order_id, payment_id          │
│  ├── amount, plan, status                   │
│  └── razorpay_signature                     │
├─────────────────────────────────────────────┤
│  raw_files                                   │
│  ├── user_id / anon_id                      │
│  └── file metadata                          │
└─────────────────────────────────────────────┘
```

---

## 3. Pattern Detector V2 — Complete Specification

Source: `lib/analysis/patternDetector.ts` (849 lines)

### 3.1 Architecture

The pattern detector uses multi-signal weighted scoring. Each of the 7 behavioral patterns has 3-5 independent signals, each with a weight. Signals are summed into a composite score (0.0-1.0). A trade is tagged only if the composite score meets or exceeds the pattern's threshold.

### 3.2 All 7 Patterns

#### REVENGE TRADE (5 signals, threshold: 0.55)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| S1 | Quick re-entry | 0.30 | Same-symbol re-entry within 5 min of a loss |
| S2 | Increased size | 0.25 | qty > lastLoss.qty × 1.15 |
| S3 | Losing streak | 0.20 | consecutiveLosses ≥ 2 |
| S4 | Bigger loss | 0.15 | abs(pnl) > sessionAvgLoss × 1.2 |
| S5 | Same symbol | 0.10 | Flat (always fires when lastLoss exists) |

Prerequisite: Previous loss on same symbol exists AND current trade is a loser.

#### AVERAGING DOWN (3 signals, threshold: 0.60)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| Base | Streak confirmed | 0.40 | Same-symbol consecutive entries detected |
| S1 | Long streak | 0.20 | Streak length ≥ 3 |
| S2 | Losing trade | 0.20 | pnl < 0 |
| S3 | Oversized | 0.20 | qty > sessionAvgQty × 1.3 |

#### FOMO ENTRY (5 signals, threshold: 0.55)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| S1 | Market open rush | 0.25 | Entry within first 3 min of market open |
| S2 | Oversized | 0.25 | qty > sessionAvgQty × 1.8 |
| S3 | Chasing win | 0.20 | Previous trade was a top-25th-percentile win |
| S4 | Loss on trade | 0.15 | pnl < 0 |
| S5 | Big loss | 0.15 | abs(pnl) > sessionAvgLoss × 1.5 |

#### PANIC EXIT (5 signals, threshold: 0.55)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| S1 | Ultra-short hold | 0.30 | Holding duration < 2 min |
| S2 | Sub-minute hold | 0.10 | Holding duration < 1 min (extra penalty) |
| S3 | Losing streak | 0.20 | consecutiveLosses ≥ 2 |
| S4 | Premature exit | 0.20 | Loss < sessionAvgLoss × 0.6 |
| S5 | Negative cum P&L | 0.20 | Session cumulative P&L negative at this point |

#### OVERTRADING (4 signals, threshold: 0.50)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| S1 | Beyond norm | 0.30 | Trade index > avgDailyTrades × 1.5 |
| S2 | Far beyond norm | 0.20 | Trade index ≥ avgDailyTrades × 2 |
| S3 | Losing trade | 0.25 | pnl < 0 |
| S4 | Declining P&L | 0.25 | Previous 2 trades both losers |

Prerequisite: Total trades in session > avgDailyTrades × 1.5.

#### OVERSIZE POSITION (3 signals, threshold: 0.55)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| S1 | Size spike | 0.40 / 0.20 | qty > userTypicalQty × 2.0 (or × 1.5) |
| S2 | Losing trade | 0.30 | pnl < 0 |
| S3 | Big loss | 0.30 | abs(pnl) > sessionAvgLoss × 1.5 |

#### LATE EXIT (3 signals, threshold: 0.60)

| # | Signal | Weight | Condition |
|---|--------|--------|-----------|
| S1 | Long hold | 0.35 / 0.18 | Hold time > avgHoldingTime × 2.0 (or × 1.5) |
| S2 | Big loss | 0.35 / 0.18 | abs(pnl) > avgLoss × 2.0 (or × 1.5) |
| S3 | Top-3 loss | 0.30 | Among 3 largest losses in session |

Prerequisite: pnl < 0 AND holdApprox > avgHoldingTime × 1.5.

### 3.3 Non-Mistake Tags

| Tag | Condition |
|-----|-----------|
| `disciplined` | Entry in high-probability window (marketOpen+5 to marketOpen+45) AND qty ≤ sessionAvgQty × 1.2 |
| `win` | Default tag when no mistake pattern detected |

### 3.4 Confidence Mapping

| Composite Score | Confidence | Cost Multiplier |
|----------------|------------|-----------------|
| ≥ 0.75 | high | 1.0 |
| ≥ 0.55 | medium | 0.7 |
| < 0.55 | low | 0.4 |

### 3.5 Cost Attribution Formula

For each losing trade tagged as a mistake:

```
cost = max(0, abs(trade.pnl) - sessionAvgLoss) × confidenceMultiplier
```

Where `sessionAvgLoss = mean(abs(pnl))` of all losing trades in the session.

For winners and trades tagged `win` or `disciplined`: cost = 0.

### 3.6 Capping Rules

| Cap | Formula | Purpose |
|-----|---------|---------|
| Per-session cost cap | totalMistakeCost ≤ grossLoss × 0.85 | Prevent cost exceeding session losses |
| Per-session tag rate | maxMistakeTrades ≤ ceil(n × 0.20) | Prevent over-tagging (keep highest-scored) |
| Global cost cap (stats route) | totalMistakeCost ≤ abs(allTimePnl) × 0.85 | Prevent cross-session aggregation exceeding total P&L |

When a cap is hit, all costs are scaled proportionally: `scaleFactor = maxAllowed / rawTotal`.

---

## 4. Decision Quality Score (DQS) — 7-Factor Model

Source: `lib/analysis/patternDetector.ts` (lines 661-710), `lib/analysis/sessionSummarizer.ts`

### 4.1 Factor Weights

| Factor | Weight | Formula |
|--------|--------|---------|
| Risk Management | 25% | `100 - max(0, (maxLoss/sessionAvgLoss - 1.5)) × 30` |
| Emotional Control | 20% | `((n - tiltCount) / n) × 100` where tiltCount = revenge + fomo + panic + averaging |
| Position Sizing | 15% | `100 - (CV × 80) - (oversizeIncidence × 40)` where CV = stddev(qty)/mean(qty) |
| Exit Discipline | 15% | `((n - badExits) / n) × 100` where badExits = panic + late_exit + averaging |
| Entry Quality | 10% | `(goodEntries / n) × 100` where goodEntries = trades in window [marketOpen+5, marketOpen+45] |
| Exit Timing | 10% | `((n - panic - late_exit) / n) × 100` |
| Rule Following | 5% | Base 100, -25 if overtrading detected, -min(40, afterThreshConsecLoss × 5) |

### 4.2 Overall Score

```
DQS = clamp(0, 100, Σ(factor_score × factor_weight))
```

### 4.3 Grade Thresholds

| Grade | Score Range |
|-------|-------------|
| A | ≥ 80 |
| B | 65 — 79 |
| C | 45 — 64 |
| D | 25 — 44 |
| F | < 25 |

### 4.4 Dashboard Discipline Score

Source: `lib/kpi/computeKPIs.ts` (lines 237-251)

When DQS values exist: `mean(dqs_scores)` across all sessions.

Fallback formula (no DQS data):
```
disciplineScore = clamp(winRate, 0, 100) × 0.6 + (clamp(profitFactor, 0, 3) / 3) × 100 × 0.4
```

---

## 5. KPI Formulas

Source: `lib/kpi/computeKPIs.ts` (252 lines)

### 5.1 Core KPIs

| KPI | Formula | Precision |
|-----|---------|-----------|
| Win Rate | `(totalWins / totalTrades) × 100` | 0.1% |
| Success Rate | `(profitableSessions / totalSessions) × 100` | Integer |
| Profit Factor | `totalWinSessionPnl / totalLossSessionPnl` | 0.01 |
| Risk:Reward | `perTradeAvgWin / perTradeAvgLoss` (per-trade, not session) | 0.01 |
| Max Drawdown | `max(runningPeak - runningPnl)` across equity curve | Integer |
| Avg Win (session) | `totalWinSessionPnl / profitableSessions` | — |
| Avg Loss (session) | `totalLossSessionPnl / losingSessions` | — |
| Best Session | `max(session.net_pnl)` | — |
| Worst Session | `min(session.net_pnl)` | — |

### 5.2 Period Filters

| Period | Filter Logic |
|--------|-------------|
| allTime | All sessions |
| thisMonth | `trade_date >= 1st of current month` |
| thisWeek | `trade_date >= start of week (Sunday)` |
| today | `trade_date === today's ISO date string` |

### 5.3 Counterfactual P&L

```
counterfactualPnl = actualAllTimePnl + abs(totalMistakeCost)
```

This represents what the user's P&L would be if they hadn't made the excess losses attributed to behavioral mistakes.

---

## 6. AI Prompt Inventory

### 6.1 Trade Extraction (POST /api/analyse)

**Model:** `claude-sonnet-4-20250514` | **Max Tokens:** 4096

**System Prompt Summary:** Extracts structured trade data from broker file content. Returns JSON array of trades with: symbol, side, entry_price, exit_price, quantity, entry_time, exit_time, pnl, trade_date. Supports multi-day files (groups by date). P&L formula: BUY = (exit - entry) × qty, SELL = (entry - exit) × qty. Detects market (NSE/NYSE/Forex/Crypto), currency, broker.

### 6.2 AI Coaching Line (generateAICoaching)

**Model:** `claude-haiku-4-5-20251001` | **Max Tokens:** 120 | **Timeout:** 15000ms

**System Prompt:**
```
You are TradeSaath, a brutally honest but empathetic trading psychology coach.
Given the bullet-point patterns below, write EXACTLY 2 sentences of coaching
(max 50 words total). Use 'I know...' empathetic phrasing in the first sentence,
then one concrete action. No markdown, no preamble.
```

**User Message:** `Today's patterns:\n{top 3 coaching bullets}\n\nWrite the 2-sentence coaching note.`

### 6.3 Chat (POST /api/chat)

**Model:** `claude-sonnet-4-20250514` | **Max Tokens:** 1024 | **Rate:** 30/user/hour

**System Prompt (BASE_SYSTEM_PROMPT):**
```
You are Saathi — the trader's companion, confidant, and psychology coach.

CRITICAL RULE: If user asks direct factual question about their data
(P&L, win rate, etc), answer with SPECIFIC NUMBER FIRST in first sentence.
No preamble.

- Warm but real, conversational, specific to trader's data
- Use ₹ symbol (never "INR")
- Bold **key insights** and **numbers**
- Keep responses 2-3 short paragraphs max
- Always end with ONE specific, actionable tip tied to their data
- NEVER predict markets or give buy/sell signals
- Focus on PROCESS over OUTCOME
```

**Context injected:** All-time totals (sessions, P&L, WR, trades), recent 10 sessions with P&L/WR/DQS, trader profile from user_journeys table. History: last 8 messages.

### 6.4 Coach Plans (POST /api/coach)

**Model:** `claude-sonnet-4-20250514` | **Max Tokens:** 4000 | **Rate:** 10/user/hour

**System Prompt:**
```
You are TradeSaath Saathi — personal psychology coach, accountability partner,
improvement planner. Coach Indian options/futures retail traders.

PHILOSOPHY:
- Every recommendation MUST reference trader's REAL ₹ amounts and numbers
- Generic advice BANNED — "manage risk better" not allowed
- Name patterns by name with exact costs: "Your revenge trading cost you ₹12,400"
- Use IF-THEN actionable rules: "IF 2 losses, THEN close terminal 15 min"
- Occasionally Hindi/slang: "FOMO ko apna saathi mat banao, discipline ko banao"
- Reference 10-stage vicious cycle when detected

TAG SYSTEM (each action item must have one):
- STOP (red) — behaviors to stop with exact cost
- DO (green) — behaviors to start with expected impact
- PRACTICE (blue) — exercises with clear instructions

Return ONLY valid JSON. No markdown, no backticks.
```

**Tab Prompts:**

| Tab | Content Generated |
|-----|-------------------|
| `tomorrow` | Psychology (3 STOP/DO/PRACTICE), Technical (3 rules), Monitor (3 TRIGGER→ACTION→COST) |
| `thisweek` | Focus on ONE worst pattern: fix plan, scenario planning (best/likely/worst), checklist |
| `learning_path` | Assess stage (AWARENESS→UNDERSTANDING→PRACTICE→MASTERY), skills, concepts |
| `patterns` | All patterns with frequency/cost/trend, chains, community comparison |
| `monthly_goals` | 5 measurable goals, 3 zones (RED/YELLOW/GREEN), 4 weekly milestones |

---

## 7. Psychology Templates

Source: `lib/analysis/sessionSummarizer.ts` (lines 82-115)

### 7.1 Coaching Phrases (per mistake tag)

| Tag | "I know..." Phrasing |
|-----|----------------------|
| Revenge | "I know losing hurts — loss aversion screams for immediate recovery..." |
| Averaging | "I know 'lowering the average' feels rational — that's sunk-cost fallacy..." |
| FOMO | "I know watching others make money while you sit out is painful..." |
| Panic | "I know the red candle felt like the start of a disaster..." |
| Overtrading | "I know the urge to 'make today count' is strong..." |
| Oversize | "I know when conviction is high you want to press..." |
| Late Exit | "I know closing a losing trade feels like admitting defeat..." |

### 7.2 Counterfactual Templates

Each mistake tag has a "Right action" + cost breakdown template explaining what the trader should have done and how much it cost them.

### 7.3 Cross-User Insights

| Condition | Insight |
|-----------|---------|
| revenge ≥ 3 | "Traders in bottom quartile average 4+ revenge trades..." |
| overtrading detected | "Profitable traders take ~40% fewer trades..." |
| disciplined ≥ 50% | "Sessions with >50% disciplined correlate with positive 5-day forward P&L..." |
| Default | Generic recovery-time message |

### 7.4 Frequency Labels

| Rate | Label |
|------|-------|
| < 5% | rare |
| 5-14% | occasional |
| 15-29% | frequent |
| ≥ 30% | chronic |

---

## 8. Broker Support

Source: `lib/config/brokers.ts` (226 lines)

### 8.1 Supported Brokers (21 total)

**Indian Brokers:** Zerodha, Upstox, Angel One, Groww, 5Paisa, ICICI Direct, HDFC Securities, Kotak Securities, Fyers, Dhan, Paytm Money, Motilal Oswal, Sharekhan, Finvasia, Flattrade

**International Brokers:** Interactive Brokers, TD Ameritrade, Robinhood, Webull, Trading212, eToro

### 8.2 Detection Algorithm

1. Phase 1: Check `BROKER_INSTANT_MATCH` map for high-specificity keywords (instant match)
2. Phase 2: Fallback to ≥2 keyword matches from broker.keywords array
3. Return broker name or "Unknown"

### 8.3 Special PDF Parsers

| Broker | Parser | Detection |
|--------|--------|-----------|
| Fyers | `parseFyersOrderBook()` | NIFTY/BANKNIFTY/FINNIFTY/SENSEX/MIDCPNIFTY patterns |
| Kotak | `parseKotakPDF()` | OPTIDXNIFTY patterns, qty range 25-100,000 |

---

## 9. Pricing & Plans

Source: `lib/config/pricing.ts` (39 lines)

| Plan | Price (₹) | Trade Limit | Duration | Features |
|------|-----------|-------------|----------|----------|
| Free | 0 | 3 | Unlimited | Basic upload + preview |
| Single Report | 99 | 99 | One-time | Full session analysis |
| Pro Monthly | 799/mo | 99 | 30 days | AI Chat, Coach, Journal, unlimited analysis |
| Pro Yearly | 499/mo (5,988/yr) | 99 | 365 days | Same as Pro Monthly, 38% savings |

Prices stored in paise in Razorpay (₹799 = 79900 paise).

---

## 10. API Route Reference

### 10.1 Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| POST /api/parse | 20 | 15 min | IP |
| POST /api/analyse | 5 | 15 min | IP |
| POST /api/analyse/session | 200 | 15 min | user:IP |
| POST /api/analyse/batch | 10 | 5 min | user:IP |
| POST /api/chat | 30 | 1 hour | userId |
| POST /api/coach | 10 | 1 hour | userId |
| POST /api/payments/create-order | 5 | 1 hour | userId |

### 10.2 Route Summary

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| /api/parse | POST | No | Local file parsing (no AI) |
| /api/analyse | POST | No | AI trade extraction + analysis |
| /api/analyse/session | POST | Clerk | Re-analyse single session |
| /api/analyse/batch | POST/GET | Clerk | Batch re-analysis with polling |
| /api/dashboard/stats | GET | Clerk | Full dashboard payload (60s cache) |
| /api/chat | POST | Clerk + Pro | Saathi AI chat |
| /api/coach | POST | Clerk + Pro | AI coaching plans |
| /api/journal/sessions | GET | Clerk | Session list with per-trade analysis |
| /api/user/sessions/pending-analysis | GET | Clerk | Pending vs analysed session counts |
| /api/user/plan | GET | Optional | User plan status |
| /api/payments/create-order | POST | Clerk | Create Razorpay order |
| /api/payments/verify | POST | Clerk | Verify payment signature |
| /api/webhooks/clerk | POST | Svix | User creation webhook |

### 10.3 AI Models Used

| Endpoint | Model | Max Tokens | Purpose |
|----------|-------|-----------|---------|
| /api/analyse | claude-sonnet-4-20250514 | 4096 | Trade extraction from files |
| /api/analyse (coaching) | claude-haiku-4-5-20251001 | 120 | Optional 2-sentence coaching |
| /api/chat | claude-sonnet-4-20250514 | 1024 | Real-time coaching chat |
| /api/coach | claude-sonnet-4-20250514 | 4000 | Structured coaching plans |

---

## 11. Dashboard Widget Map

### 11.1 Widget Data Sources

| # | Widget | Component | Data Source | Empty State |
|---|--------|-----------|-------------|-------------|
| 1 | Score Ring | TradeSaathScore | `stats.dqs.overall` → `dqsScore` → `disciplineScore` → 0 | Ring at 0, no factors shown |
| 2 | #1 Issue | Dashboard page | `stats.mistakeTrades[0]` | Hidden |
| 3 | Before You Trade | PreMarketCheckin | Hardcoded intentions (UI suggestions, not data) | Intention pills |
| 4 | Stats Strip | Dashboard page | `stats.allTime.*` (pnl, winRate, sessions, bestSessionPnl, disciplineScore) | Zeros |
| 5 | Discipline Score | TradeSaathScore | `stats.dqsFactors[]` → factor bars | Empty bar list |
| 6 | Benchmark Bars | TradeSaathScore | "You" = real score; Average=41, Profitable=58, Top 10%=72 (static benchmarks) | — |
| 7 | KPI Cards | PerformanceKPIs | `stats.month.*` or `stats.allTime.*` fallback + `stats.bestTimeSlot` | "—" for Best Time if no qualifying slot |
| 8 | Equity Curve | DashboardEquityCurve | `stats.equityCurve[]` (last 20 sessions) | No bars |
| 9 | Streaks | DashboardEquityCurve | `stats.streaks` (current, bestWin, worstLoss) | 0 values |
| 10 | Risk | DashboardEquityCurve | `stats.risk` (maxDrawdown, avgLossAvgWin) | 0 values |
| 11 | Heatmap | PerformanceHeatmap | `stats.tradesByTimeDay[]` | "Needs 5+ trades" message |
| 12 | Recent Trades | RecentActivity | `stats.recentTrades[]` (up to 5) | "No trades yet" |
| 13 | Recent Sessions | RecentActivity | `stats.recentSessions[]` (up to 4) | "No sessions yet" |
| 14 | Goal Tracking | GoalTracking | winRate from `stats.month`, revengeTrades from `stats.revengeTradeCount`, maxDailyTrades from `stats.maxDailyTrades`, riskReward from `stats.month.riskReward` | Progress bars at 0 |
| 15 | Mistake Cost | MistakeCostCalculator | `stats.patterns.byTag[]` or `stats.mistakeTrades[]` fallback | "No data" or "Analysis pending" |
| 16 | DQS Widget | DecisionQualityScore | `stats.dqs.overall`, `stats.dqs.grade`, `stats.dqsFactors[]` | "Upload sessions" or "Analysis pending" |
| 17 | Behavioral Insights | BehavioralInsights | Built from `stats.patterns.byTag[]` top 4 | "Upload 3+ sessions" or "Analysis pending" |
| 18 | Summary Cards | SummaryCards | `stats.today`, `stats.week`, `stats.month` | "No session yet" per period |

### 11.2 Heatmap Specification

**Grid:** 5 rows (Mon-Fri) × 14 columns (09:00-15:30, 30-min slots) = 70 cells

**Data Priority:**
1. JSONB trades from `trade_sessions.trades` (highest fidelity)
2. `trade_analysis` rows with entry_time
3. Synthetic fallback (one point per session at rotating slots)

**Cell Colors:**

| Win Rate | Color |
|----------|-------|
| > 60% | Green: `rgba(34,197,94,.45)` |
| 40-60% | Gold: `rgba(234,179,8,.4)` |
| < 40% | Red: `rgba(239,68,68,.4)` |
| No data | Light: `rgba(255,255,255,.04)` |

Low confidence (< 3 trades): faded text `rgba(255,255,255,.4)`.

**Best Time Slot:** Slot with highest win rate, minimum 5 trades. Displayed as 30-min range (e.g., "10:00-10:30").

### 11.3 Benchmark Values (Static Reference Points)

| Benchmark | Value | Source |
|-----------|-------|--------|
| Average trader DQS | 41 | Aggregated TradeSaath user base (updated quarterly) |
| Profitable trader DQS | 58 | Profitable trader median |
| Top 10% DQS | 72 | 90th percentile |

These are display-only static reference points in TradeSaathScore.tsx. The "You" value always uses the real computed DQS score.

---

## 12. Version Gate System

**Current Version:** `CURRENT_ANALYSIS_VERSION = 4`

Defined in 4 files (must stay synchronized):
1. `lib/analysis/sessionAnalyser.ts` (line 16)
2. `lib/analysis/sessionSummarizer.ts` (in buildAnalysisJSON output)
3. `app/api/dashboard/stats/route.ts` (line 289)
4. `app/api/user/sessions/pending-analysis/route.ts` (line 31)

**Gate Logic:** A session is considered "analysed" if:
```
analysis.analysed_at exists AND is non-empty string
AND analysis.analysed_version >= CURRENT_ANALYSIS_VERSION
```

Everything else is "pending" — old pipeline versions, partial analysis, missing fields.

---

## 13. File Parser Pipeline

Source: `lib/parsers/` (5 files)

### 13.1 Supported Formats

| Extension | Parser | Library |
|-----------|--------|---------|
| .csv, .tsv | csvParser | PapaParse |
| .xlsx, .xls | excelParser | SheetJS |
| .pdf | pdfParser | unpdf → pdf-parse → raw scan |
| .png, .jpg, .jpeg, .gif, .webp | — | Returns failure (requires AI/OCR) |

### 13.2 Header Detection

Scans first 15 rows for a header row matching column patterns. Requires ≥3 pattern matches from:
`symbol`, `instrument`, `scrip`, `trade_time`, `date_time`, `side`, `qty`, `quantity`, `price`, `traded_price`

### 13.3 Trade Pairing

Source: `lib/parsers/normalizer.ts`

Trades are paired using FIFO matching grouped by symbol + date. For each group, BUY and SELL trades are matched in order. P&L per pair:
```
pnl = round((exitPrice - entryPrice) × matchQty, 2)
```

Unpaired trades with direct P&L columns are kept as-is.

### 13.4 Session Classification

| Hour | Session |
|------|---------|
| < 11:00 | morning |
| 11:00-13:59 | midday |
| ≥ 14:00 | afternoon |

---

## 14. State Management

### 14.1 Analysis Store (Zustand)

Source: `lib/analysisStore.ts` (170 lines)

Persisted to sessionStorage under key `tradesaath-analysis`. Stores: trades, analysis, metadata, kpis, sessionId.

### 14.2 Plan Store (Zustand)

Source: `lib/planStore.ts` (110 lines)

| Method | Returns |
|--------|---------|
| `isPaid()` | true if plan !== 'free' |
| `isPro()` | true if plan is pro_monthly or pro_yearly |
| `tradeLimit()` | 3 (free), 99 (all paid plans) |

### 14.3 Dashboard Cache

Source: `lib/dashboardCache.ts` (8 lines)

In-memory Map with 60-second TTL. Key format: `stats:{userId}`. Busted on new analysis via `bustDashboardCache(userId)`.

---

## 15. Payment Flow

### 15.1 Order Creation

```
POST /api/payments/create-order
  → Validates plan against PLANS config
  → Creates Razorpay order (amount in paise)
  → Saves pending payment to Supabase payments table
  → Returns orderId, amount, keyId, testMode
```

### 15.2 Verification

```
POST /api/payments/verify
  → Receives razorpay_order_id, payment_id, signature
  → Verifies HMAC-SHA256 signature with RAZORPAY_KEY_SECRET
  → Updates payments table (status: completed)
  → Upserts user_plans with expiration:
      single: no expiration
      pro_monthly: +30 days
      pro_yearly: +365 days
  → Updates users table with plan
```

### 15.3 Test Mode Detection

Key ID starting with `rzp_test_` = test mode. Logged but not blocked.

---

## 16. Authentication & Middleware

Source: `middleware.ts` (44 lines)

### 16.1 Public Routes (no auth required)

`/`, `/upload`, `/results`, `/pricing`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/parse`, `/api/analyse`, `/api/extract`, `/api/health`, `/api/sessions`, `/api/user/plan`, `/api/payments/(.*)`

### 16.2 Protected Routes

All other routes require Clerk authentication. Authenticated users on `/` or auth pages are redirected to `/dashboard`.

### 16.3 Webhook Authentication

Clerk webhooks use Svix signature verification (not Clerk auth). Event `user.created` upserts into `users` table with plan=free.

---

## 17. Demo Data

Source: `lib/demoData.ts` (75 lines)

10 sample NSE options trades (NIFTY CE/PE, BANKNIFTY) with pre-built analysis including all vicious cycle stages, per-trade tags, and coaching text. Net P&L: -₹5,978.

**Import status:** NOT imported by any production code path (app/ or components/). Safe — exists only for development/testing reference.

---

## 18. Constants Reference

### 18.1 Pattern Detection Constants

| Constant | Value | Location |
|----------|-------|----------|
| Market open time | 9:15 AM (555 min) | patternDetector.ts |
| Revenge time window | 5 minutes | patternDetector.ts |
| FOMO early window | First 3 min after open | patternDetector.ts |
| Panic hold threshold | 2 minutes (1 min extra) | patternDetector.ts |
| Overtrading multiplier | 1.5× / 2× daily avg | patternDetector.ts |
| Oversize multiplier | 1.5× / 2× typical qty | patternDetector.ts |
| Late exit multiplier | 1.5× / 2× avg hold time | patternDetector.ts |
| Cost cap (per-session) | 85% of gross loss | patternDetector.ts |
| Tag rate cap | 20% of trades | patternDetector.ts |
| Cost cap (global) | 85% of abs(allTimePnl) | stats/route.ts |

### 18.2 System Constants

| Constant | Value | Location |
|----------|-------|----------|
| CURRENT_ANALYSIS_VERSION | 4 | 4 files (see §12) |
| Batch CONCURRENCY | 3 | analysisQueue.ts |
| Batch max sessions | 200 | batch/route.ts |
| Dashboard cache TTL | 60 seconds | dashboardCache.ts |
| Best time min trades | 5 | stats/route.ts |
| Heatmap min trades | 5 | PerformanceHeatmap.tsx |
| Batch poll interval | 1500ms | BatchAnalysisRunner.tsx |
| AI coaching timeout | 15000ms | sessionSummarizer.ts |
| AI coaching max tokens | 120 | sessionSummarizer.ts |
| Profit factor cap | 999 | kpiCalculator.ts |

### 18.3 UI Color Thresholds

| Context | Green | Gold/Yellow | Red |
|---------|-------|-------------|-----|
| DQS / Discipline | ≥ 60 | ≥ 40 | < 40 |
| DQS Grade color | ≥ 80 | ≥ 65 | < 45 |
| Win Rate (KPI card) | ≥ 50% | — | < 50% |
| Heatmap cell | > 60% WR | 40-60% WR | < 40% WR |
| Risk:Reward | ≥ 1.0 | — | < 1.0 |

---

*End of document. All values extracted from source code as of commit `4cba6bc` on 2026-04-17.*
