# TradeSaath - Complete Codebase Audit

**Date**: April 12, 2026
**Version**: 0.1.0
**Total Files**: ~55 TypeScript/TSX files
**Total Lines of Code**: ~13,263

---

## Section 1 - Project Structure

```
tradesaath/
  app/
    layout.tsx                          # Root layout (ClerkProvider, Navbar, Footer, AiChat, Onboarding)
    page.tsx                            # Landing page (Hero, HomeUpload, HowItWorks, Features, Pricing, FAQ)
    globals.css                         # Global styles + CSS variables (dark theme)
    coach/page.tsx                      # AI coaching plans ("Saathi") - Pro only
    dashboard/page.tsx                  # Authenticated user dashboard with KPIs
    journal/page.tsx                    # Trading journal with session history
    journey/page.tsx                    # Trading psychology profile questionnaire
    pricing/page.tsx                    # Pricing plans page
    results/page.tsx                    # Legacy redirect to /upload
    upload/page.tsx                     # Main upload + results page (free tier)
    upload-v2/page.tsx                  # Experimental upload variant
    sign-in/[[...sign-in]]/page.tsx     # Clerk sign-in
    sign-up/[[...sign-up]]/page.tsx     # Clerk sign-up
    api/
      analyse/route.ts                 # Two-call Claude AI analysis (extract + coach)
      auth/sync/route.ts               # Clerk-to-Supabase user sync
      chat/route.ts                    # AI chatbot ("Saathi") - Pro only
      coach/route.ts                   # AI coaching plan generator
      dashboard/stats/route.ts         # Dashboard KPIs, equity curve, heatmap
      extract/route.ts                 # Claude-powered file extraction (legacy)
      health/route.ts                  # API health check (Claude + Gemini)
      journal/sessions/route.ts        # Journal session list with AI enrichment
      parse/route.ts                   # Local file parsing (no AI)
      payments/
        create-order/route.ts          # Razorpay order creation
        verify/route.ts                # Razorpay payment verification + plan upgrade
      sessions/route.ts                # Legacy session CRUD
      storage/setup/route.ts           # Supabase Storage bucket creation
      user/
        journey/route.ts               # Trading journey profile CRUD
        plan/route.ts                  # User plan status
      webhooks/clerk/route.ts          # Clerk webhook receiver (user.created)

  components/
    AiChat.tsx                         # Floating chat FAB + panel (267 lines)
    AuthSync.tsx                       # Clerk-to-backend user sync wrapper
    BrokerGuide.tsx                    # Broker file format guide
    ClerkAuth.tsx                      # Conditional Clerk wrapper
    ClerkErrorBoundary.tsx             # Error boundary for Clerk components
    ClerkWrapper.tsx                   # Clerk provider with key check
    ComparisonTable.tsx                # Feature comparison table
    FAQ.tsx                            # Accordion FAQ section
    Features.tsx                       # Feature showcase grid
    Footer.tsx                         # Simple footer
    Hero.tsx                           # Landing page hero section
    HomeUpload.tsx                     # Landing page upload CTA
    HowItWorks.tsx                     # How-it-works section
    Navbar.tsx                         # Responsive nav with theme toggle (212 lines)
    Onboarding.tsx                     # 3-step onboarding modal
    PlanGate.tsx                       # Plan-gated feature wrapper
    Pricing.tsx                        # 3-tier pricing with Razorpay
    TradePreview.tsx                   # Trade data preview

    chat/
      ChatFAB.tsx                      # Floating action button for chat
      ChatPanel.tsx                    # Sliding chat panel (264 lines)
      ChatWrapper.tsx                  # Chat panel mount wrapper

    dashboard/
      BehavioralInsights.tsx           # Behavioral pattern cards
      DashboardEquityCurve.tsx         # Equity curve chart
      DecisionQualityScore.tsx         # DQS radar visualization
      GoalTracking.tsx                 # Trading goal progress
      MistakeCostCalculator.tsx        # Mistake cost breakdown
      PerformanceHeatmap.tsx           # Time-of-day performance heatmap (171 lines)
      PerformanceKPIs.tsx              # Monthly KPI cards
      PreMarketCheckin.tsx             # Pre-market preparation checklist
      RecentActivity.tsx               # Recent trades & sessions
      SummaryCards.tsx                  # Today/week/month summary
      TradeSaathScore.tsx              # Overall discipline score

    journal/
      CalendarCard.tsx                 # Session calendar
      JournalStats.tsx                 # Journal-level stats
      SessionDetail.tsx                # Session detail view (206 lines)
      SessionList.tsx                  # Session list sidebar
      TradingJourney.tsx               # Journey questionnaire component (185 lines)

    results/
      AnalyseWithAIButton.tsx          # Retry AI analysis button
      EquityCurve.tsx                  # Results equity curve
      KPIStrip.tsx                     # KPI strip (wins, losses, P&L)
      MomentumIndicators.tsx           # 4-factor momentum gauges
      PaywallGate.tsx                  # Paywall for >3 trades
      SessionSummary.tsx               # AI session narrative
      TechnicalInsights.tsx            # 4-factor technical scores
      TradeDetail.tsx                  # Per-trade analysis card (323 lines)
      TradeSidebar.tsx                 # Trade list sidebar (166 lines)
      ViciousCycle.tsx                 # 10-stage cycle visualization

    ui/
      ErrorBoundary.tsx                # Reusable error boundary with retry
      Toast.tsx                        # Global toast notification system

    upload/
      AnalyseButton.tsx                # Analysis trigger with progress bar (255 lines)
      AutoDetectBar.tsx                # Market/broker auto-detection display
      Dropzone.tsx                     # File upload dropzone with validation
      FileChips.tsx                    # Uploaded file chips with remove
      TradingContext.tsx               # Pre-analysis context form (195 lines)

  hooks/
    useRazorpay.ts                     # Razorpay payment hook
    useSyncUser.ts                     # Clerk user sync hook
    useUserPlan.ts                     # User plan fetcher hook

  lib/
    analysisStore.ts                   # Zustand store: trade analysis state
    anonId.ts                          # Anonymous user ID cookie management
    demoData.ts                        # Demo trade dataset (10 NSE trades)
    planStore.ts                       # Zustand store: subscription plan
    supabase.ts                        # Supabase client (browser + admin)
    trade-parser.ts                    # Local trade file parser (980 lines - LARGEST)
    uploadStore.ts                     # Zustand store: upload state + broker detection

    hooks/
      usePlan.ts                       # Client-side plan hook with store

    parsers/
      universalParser.ts               # Universal broker parser (422 lines)

    supabase/
      getUserPlan.ts                   # Plan fetch with expiry check
      migrateAnonData.ts               # Anonymous-to-user data migration
      saveFile.ts                      # File metadata + storage upload
      saveTradeAnalysis.ts             # Per-trade analysis save
      saveTrades.ts                    # Trade session save

  middleware.ts                        # Clerk auth + route protection
```

---

## Section 2 - Tech Stack

| Technology | Version | Usage |
|------------|---------|-------|
| Next.js | 14.2.35 | App Router, API routes, SSR |
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety (strict mode, `skipLibCheck`) |
| Tailwind CSS | 3.4.1 | Utility-first styling |
| Clerk | 6.39.0 | Authentication (sign-in, sign-up, webhooks) |
| Supabase | 2.99.3 | PostgreSQL database + file storage |
| Razorpay | 2.9.6 | Payment processing (INR) |
| Anthropic Claude | SDK 0.80.0 | AI analysis (claude-sonnet-4-20250514) |
| Zustand | 5.0.12 | Client-side state management |
| PapaParse | 5.5.3 | CSV parsing |
| pdf-parse | 1.1.1 | PDF text extraction |
| unpdf | 1.4.0 | Modern PDF extraction |
| Tesseract.js | 7.0.0 | OCR for image-based statements |
| xlsx | 0.18.5 | Excel file reading |
| Svix | 1.88.0 | Clerk webhook signature verification |
| uuid | 13.0.0 | UUID generation |

**Build Configuration** (`next.config.mjs`):
- ESLint and TypeScript errors ignored during Vercel builds (`ignoreDuringBuilds: true`, `ignoreBuildErrors: true`)
- External packages: `unpdf`, `tesseract.js` (server components)
- Runtime: Node.js (not Edge)
- Max duration: 90s on `/api/analyse` route

**Claude API Usage**:
- Model: `claude-sonnet-4-20250514`
- Extract call: 4096 max tokens, 55s timeout
- Analysis call: 8192 max tokens, dynamic timeout (10-55s based on elapsed time)
- Chat: standard message API with 8-message history
- Coach: structured JSON generation for coaching plans

---

## Section 3 - Database Schema

### Table: `users`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, default gen_random_uuid() |
| email | TEXT | NOT NULL |
| name | TEXT | nullable |
| plan | TEXT | default 'free' |
| clerk_id | TEXT | UNIQUE, NOT NULL |
| created_at | TIMESTAMPTZ | default now() |

Index: `idx_users_clerk_id ON users(clerk_id)`
RLS: User-scoped SELECT/INSERT/UPDATE on own row.

### Table: `trade_sessions`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | TEXT | nullable (Clerk ID) |
| anon_id | TEXT | nullable (cookie-based) |
| session_key | TEXT | UNIQUE, NOT NULL |
| broker / broker_name | TEXT | NOT NULL |
| file_name | TEXT | nullable |
| trade_date | DATE | nullable |
| detected_market | TEXT | nullable |
| detected_currency | TEXT | default 'INR' |
| detected_broker | TEXT | nullable |
| trades | JSONB | NOT NULL (full trade array) |
| analysis | JSONB | nullable (Claude AI result) |
| context | JSONB | nullable (user context answers) |
| trade_count | INTEGER | default 0 |
| net_pnl | NUMERIC | default 0 |
| win_count / loss_count | INTEGER | default 0 |
| win_rate | NUMERIC | default 0 |
| profit_factor | NUMERIC | default 0 |
| best_trade / worst_trade | NUMERIC | default 0 |
| plan | TEXT | default 'free' |
| payment_id | TEXT | nullable |
| created_at / updated_at | TIMESTAMPTZ | default now() |

Indexes: `user_id`, `session_key`, `anon_id`, `created_at DESC`, `trade_date`
RLS: Anyone can INSERT. SELECT/UPDATE by session_key or user_id match. Service role has full access.

### Table: `trade_analysis`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| session_id | UUID | FK -> trade_sessions(id) ON DELETE CASCADE |
| trade_index | INTEGER | NOT NULL |
| anon_id | TEXT | nullable |
| symbol, side | TEXT | nullable |
| entry_price, exit_price, quantity, pnl | NUMERIC | nullable |
| entry_time, exit_time | TEXT | nullable |
| tag, tag_label | TEXT | nullable (win/fomo/rvg/avg/pnc/vs) |
| quick_summary | TEXT | nullable |
| psychology_coaching | TEXT | nullable |
| counterfactual | TEXT | nullable |
| technical_analysis | TEXT | nullable |
| cycle_stage | TEXT | nullable |
| notes | TEXT | nullable |
| created_at | TIMESTAMPTZ | default now() |

Index: `idx_trade_analysis_session ON trade_analysis(session_id)`

### Table: `raw_files`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | TEXT | nullable |
| anon_id | TEXT | nullable |
| session_id | UUID | FK -> trade_sessions(id) ON DELETE SET NULL |
| file_name | TEXT | NOT NULL |
| file_type | TEXT | NOT NULL |
| file_size_bytes | BIGINT | nullable |
| storage_path | TEXT | nullable |
| broker_detected | TEXT | nullable |
| trades_count | INTEGER | nullable |
| uploaded_at | TIMESTAMPTZ | default now() |
| analysed_at | TIMESTAMPTZ | nullable |

### Table: `user_plans`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | TEXT | UNIQUE, NOT NULL |
| plan | TEXT | default 'free' |
| razorpay_payment_id | TEXT | nullable |
| razorpay_subscription_id | TEXT | nullable |
| plan_started_at | TIMESTAMPTZ | default now() |
| plan_expires_at | TIMESTAMPTZ | nullable |
| created_at / updated_at | TIMESTAMPTZ | default now() |

### Table: `user_journeys`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | TEXT | UNIQUE, NOT NULL |
| experience, instruments, challenge, goal, perfect_day, one_change | TEXT | nullable |
| created_at / updated_at | TIMESTAMPTZ | default now() |

### Supabase Storage

Bucket: `trade-files` (private, 10MB limit)
Path structure: `{userId|anonId|unknown}/{timestamp}_{filename}`
MIME types: PDF, CSV, XLSX/XLS, PNG, JPEG

---

## Section 4 - API Routes

### `/api/analyse` (POST)
- **Auth**: No (public, works for anonymous users)
- **Input**: Multipart FormData (files) OR JSON (pre-parsed trades)
- **Logic**: Two-call Claude approach: (1) Extract trades from files, (2) Generate psychology analysis. Saves session, trades, and files to Supabase non-blocking.
- **Output**: `{ success, trades[], analysis{}, metadata{} }`
- **External**: Anthropic Claude API, Supabase
- **Max duration**: 90 seconds

### `/api/parse` (POST)
- **Auth**: No
- **Input**: FormData with single file
- **Logic**: Local parsing only (no AI). Uses `trade-parser.ts` for CSV/Excel/PDF extraction.
- **Output**: `{ broker, market, trades[], kpis{}, time_analysis{} }`
- **External**: None (pure local parsing)

### `/api/extract` (POST)
- **Auth**: No
- **Input**: FormData with single file
- **Logic**: Claude-powered extraction with vision (handles images, PDFs). Similar to analyse Call 1 but standalone.
- **Output**: `{ trades[], broker, market, tradeDate, currency }`
- **External**: Anthropic Claude API

### `/api/chat` (POST)
- **Auth**: Yes (Pro plan required)
- **Input**: `{ message, history[] }`
- **Logic**: Psychology coaching chatbot. Fetches user's recent sessions and journey as context. 8-message history.
- **Output**: `{ reply }`
- **External**: Anthropic Claude API, Supabase

### `/api/coach` (POST)
- **Auth**: Yes (authenticated)
- **Input**: `{ tab: 'tomorrow'|'thisweek'|'learning_path'|'patterns'|'monthly_goals' }`
- **Logic**: Generates structured coaching plans from trading history. Aggregates patterns, costs, cycle stages.
- **Output**: `{ plan: { title, subtitle, sections[] } }`
- **External**: Anthropic Claude API, Supabase

### `/api/dashboard/stats` (GET)
- **Auth**: Yes
- **Logic**: Aggregates all user sessions into monthly/weekly/daily KPIs, equity curve, streaks, risk metrics, heatmap data, mistake costs, DQS score.
- **Output**: Complete dashboard data object (~20 fields)
- **External**: Supabase

### `/api/auth/sync` (POST)
- **Auth**: No (receives Clerk data)
- **Input**: `{ clerkId, email, name? }`
- **Logic**: Upserts user to Supabase. Migrates anonymous data if anon cookie exists.
- **External**: Supabase

### `/api/payments/create-order` (POST)
- **Auth**: Yes
- **Input**: `{ plan: 'single'|'pro_monthly'|'pro_yearly' }`
- **Logic**: Creates Razorpay order. Maps plan to amount (99/799/499 INR).
- **Output**: `{ orderId, amount, currency, keyId }`
- **External**: Razorpay API, Supabase

### `/api/payments/verify` (POST)
- **Auth**: Conditional (HMAC verification)
- **Input**: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
- **Logic**: Verifies HMAC-SHA256 signature. Updates payment status, user plan, plan expiry.
- **External**: Supabase

### `/api/user/plan` (GET)
- **Auth**: No (returns 'free' for unauthenticated)
- **Logic**: Checks user_plans table with expiry. Falls back to users table.
- **Output**: `{ plan, authenticated, expired? }`

### `/api/user/journey` (GET/POST)
- **Auth**: Yes
- **Logic**: CRUD for trading psychology profile (experience, instruments, challenge, goal).

### `/api/journal/sessions` (GET)
- **Auth**: Yes
- **Logic**: Fetches last 50 sessions with per-trade AI analysis. Merges trade_analysis data.

### `/api/sessions` (GET/POST)
- **Auth**: Yes
- **Logic**: Legacy session CRUD. GET returns last 50 sessions. POST saves new session.

### `/api/webhooks/clerk` (POST)
- **Auth**: Svix signature verification
- **Logic**: Handles `user.created` events. Inserts user to Supabase. Handles duplicate key gracefully.

### `/api/health` (GET)
- **Auth**: No
- **Logic**: Tests Anthropic and Gemini API connectivity.

### `/api/storage/setup` (POST)
- **Auth**: No (one-time admin setup)
- **Logic**: Creates `trade-files` Supabase Storage bucket.

---

## Section 5 - Frontend Architecture

### Page: `/` (Landing)
- Auth: No
- Components: Hero, HomeUpload, HowItWorks, Features, Pricing, FAQ
- No API calls, pure static content

### Page: `/upload` (Main Upload + Results)
- Auth: No (free tier)
- Stores: uploadStore, analysisStore, planStore
- Components: Dropzone, FileChips, TradingContext, AnalyseButton, KPIStrip, SessionSummary, MomentumIndicators, ViciousCycle, TechnicalInsights, TradeSidebar, TradeDetail, PaywallGate, EquityCurve, Toaster, ErrorBoundary
- API calls: POST /api/parse (local), POST /api/analyse (AI)
- Two-phase rendering: upload form OR results view based on analysisState

### Page: `/dashboard`
- Auth: Yes (redirect to /sign-in if not authenticated)
- Store: usePlan hook
- Components: TradeSaathScore, PreMarketCheckin, PerformanceKPIs, DashboardEquityCurve, SummaryCards, BehavioralInsights, GoalTracking, RecentActivity, PerformanceHeatmap, MistakeCostCalculator, DecisionQualityScore, Toaster, ErrorBoundary (all wrapped)
- API calls: GET /api/dashboard/stats
- Plan-gated: shows upgrade banner for free users

### Page: `/journal`
- Auth: Yes
- Plan gate: Paid only (PlanGate component)
- Components: SessionList, SessionDetail, CalendarCard, JournalStats, ChatWrapper
- API calls: GET /api/journal/sessions
- Features: pattern detection (3+ occurrences across 2+ sessions)

### Page: `/coach`
- Auth: Yes
- Plan gate: Pro only (useUserPlan)
- API calls: GET /api/sessions, POST /api/coach
- Features: 5 coaching tabs, rule checklist (localStorage), discipline trends

### Page: `/journey`
- Auth: Yes
- Plan gate: Paid only
- Components: TradingJourney (6-step questionnaire)
- API calls: GET/POST /api/user/journey

### Page: `/pricing`
- Auth: No
- Components: Pricing (with Razorpay integration)

---

## Section 6 - State Management

### `uploadStore` (Zustand + sessionStorage)
```typescript
{
  files: File[]                     // Uploaded files (max 40)
  context: TradingContext           // Pre-analysis context (8 fields)
  detectedMarket: string | null     // Auto-detected market
  detectedBroker: string | null     // Auto-detected broker
  analysisState: AnalysisState      // idle|uploading|analysing|parsed|ai_running|complete|error

  addFiles(files) / removeFile(index) / setContext(key, value)
  setDetectedBroker(broker) / setAnalysisState(state) / reset()
}
```
Consumers: Dropzone, FileChips, AutoDetectBar, AnalyseButton, upload/page.tsx

### `analysisStore` (Zustand + sessionStorage)
```typescript
{
  trades: Trade[]                   // Parsed/extracted trades
  analysis: Analysis | null         // AI coaching analysis
  metadata: Metadata | null         // Session metadata
  kpis: KPIs | null                 // Computed KPIs
  isLoading: boolean
  error: string | null

  setAnalysis(data) / setLoading(loading) / setError(error) / reset()
}
```
Consumers: AnalyseButton, upload/page.tsx, all results/ components

### `planStore` (Zustand + sessionStorage)
```typescript
{
  plan: 'free' | 'single' | 'pro_monthly' | 'pro_yearly'
  setPlan(plan) / isPro() / isPaid() / tradeLimit()
}
```
Consumers: PaywallGate, PlanGate, Navbar, upload/page.tsx

---

## Section 7 - Component Inventory

### Upload Components (5 files, ~700 lines)

| Component | Lines | Props | Reads From |
|-----------|-------|-------|------------|
| Dropzone | 157 | none | uploadStore |
| FileChips | ~50 | none | uploadStore |
| AutoDetectBar | ~54 | none | uploadStore |
| AnalyseButton | 255 | none | uploadStore, analysisStore |
| TradingContext | 195 | none | uploadStore |

### Results Components (9 files, ~1,300 lines)

| Component | Lines | Props | Reads From |
|-----------|-------|-------|------------|
| KPIStrip | ~80 | none | analysisStore |
| SessionSummary | ~60 | none | analysisStore |
| MomentumIndicators | ~80 | none | analysisStore |
| ViciousCycle | ~100 | none | analysisStore |
| TechnicalInsights | ~80 | none | analysisStore |
| TradeDetail | 323 | activeTrade, freeLimit | analysisStore |
| TradeSidebar | 166 | activeTrade, onSelectTrade, freeLimit | analysisStore |
| EquityCurve | ~60 | none | analysisStore |
| PaywallGate | 74 | tradeCount | planStore, useRazorpay |

### Dashboard Components (11 files, ~1,200 lines)

| Component | Lines | Props | Reads From |
|-----------|-------|-------|------------|
| TradeSaathScore | ~80 | score, factors | props |
| PreMarketCheckin | ~100 | none | localStorage |
| PerformanceKPIs | ~80 | month, score | props |
| DashboardEquityCurve | ~80 | equityCurve, streaks, risk | props |
| SummaryCards | ~60 | today, week, month | props |
| BehavioralInsights | ~100 | sessionCount | API (/api/journal/sessions) |
| GoalTracking | ~80 | winRate, revengeTrades, etc. | props |
| RecentActivity | ~100 | recentTrades, recentSessions | props |
| PerformanceHeatmap | 171 | trades | props |
| MistakeCostCalculator | ~60 | totalCost, etc. | props |
| DecisionQualityScore | ~60 | score, factors | props |

### Journal Components (5 files, ~700 lines)

| Component | Lines | Props | Reads From |
|-----------|-------|-------|------------|
| SessionList | ~80 | sessions, activeId, onSelect | props |
| SessionDetail | 206 | session | props |
| CalendarCard | ~60 | sessions, onSelect | props |
| JournalStats | ~60 | sessions | props |
| TradingJourney | 185 | none | API (/api/user/journey) |

---

## Section 8 - Data Flow Diagrams

### Flow 1: File Upload -> Parse -> Analyse -> Display

```
User drops files into Dropzone
  -> uploadStore.addFiles() validates + detects broker from filename
  -> FileChips shows file list with broker badge
  -> User clicks "Run Free Analysis" (AnalyseButton)
    -> Step 1: POST /api/parse for each file (local parsing)
      -> trade-parser.ts: CSV/Excel/PDF extraction
      -> universalParser.ts: broker detection (20 brokers, two-phase)
      -> Returns: trades[], broker, market, KPIs
    -> If local parse finds trades:
      -> analysisStore.setAnalysis(parsed data) immediately
      -> uploadStore.setAnalysisState('parsed')
      -> UI switches to results view (KPIs, equity curve visible)
      -> Step 2: Background POST /api/analyse (JSON path)
        -> callClaude(buildAnalysePrompt) with trade data
        -> Returns: psychology analysis, per-trade coaching
        -> analysisStore.setAnalysis(full data)
        -> Results components re-render with AI sections
    -> If local parse finds 0 trades:
      -> POST /api/analyse (FormData path)
        -> callClaude(buildExtractPrompt) extracts trades from files
        -> callClaude(buildAnalysePrompt) analyses extracted trades
        -> Saves to Supabase: trade_sessions, trade_analysis, raw_files
        -> Returns full analysis
```

### Flow 2: Sign Up -> Payment -> Plan Activation

```
User clicks "Sign Up"
  -> Clerk /sign-up page with forceRedirectUrl="/dashboard"
  -> Clerk creates user -> triggers webhook POST /api/webhooks/clerk
    -> Inserts user to Supabase 'users' table with plan='free'
  -> AuthSync component fires useSyncUser hook
    -> POST /api/auth/sync { clerkId, email, name }
    -> Upserts user, migrates anon data if cookie exists
  -> User lands on /dashboard (middleware redirect)

Payment:
  User clicks pricing plan
    -> useRazorpay.pay() loads Razorpay script
    -> POST /api/payments/create-order { plan }
      -> Creates Razorpay order (99/799/499 paise)
      -> Saves pending payment to Supabase
    -> Razorpay modal opens
    -> User completes payment
    -> handler callback: POST /api/payments/verify
      -> Verifies HMAC-SHA256 signature
      -> Updates payment: pending -> completed
      -> Upserts user_plans with expiry (30d/365d)
      -> Updates users.plan
    -> planStore.setPlan(plan)
    -> PaywallGate disappears, full trades unlocked
```

### Flow 3: Anonymous User -> Sign Up -> Data Migration

```
Anonymous user visits /upload
  -> First API call -> lib/anonId.ts creates cookie:
    -> Name: tradesaath_anon_id
    -> Value: UUID v4
    -> HttpOnly, Secure, SameSite=lax, 1-year expiry
  -> User uploads + analyses trades
    -> trade_sessions saved with anon_id (no user_id)
    -> trade_analysis saved with anon_id
    -> raw_files saved with anon_id
  -> User clicks "Sign Up"
    -> Clerk account created
    -> POST /api/auth/sync fires
      -> Reads anon cookie
      -> migrateAnonToUser(anonId, userId):
        -> UPDATE trade_sessions SET user_id=userId, anon_id=NULL WHERE anon_id=anonId
        -> UPDATE trade_analysis SET anon_id=NULL WHERE anon_id=anonId
        -> UPDATE raw_files SET user_id=userId, anon_id=NULL WHERE anon_id=anonId
      -> Clears anon cookie
  -> All previous anonymous data now linked to authenticated user
```

### Flow 4: Dashboard Data Loading

```
User navigates to /dashboard
  -> useEffect: if !isSignedIn, redirect to /sign-in
  -> useEffect: fetch("/api/dashboard/stats")
    -> Clerk auth() gets userId
    -> Supabase: SELECT * FROM trade_sessions WHERE user_id = userId ORDER BY created_at DESC
    -> Filter by month/week/today dates
    -> Compute: net_pnl, wins, losses, win_rate, profit_factor, streaks, equity curve
    -> Supabase: SELECT * FROM trade_analysis WHERE session_id IN (last 5 sessions)
    -> Build: mistake breakdown (by tag), heatmap (by time-of-day), DQS score
    -> Return: full DashStats object
  -> setStats(data)
  -> Components render with ErrorBoundary wrapping each section
```

### Flow 5: Saathi Coaching Generation

```
User opens /coach page (Pro only)
  -> GET /api/sessions fetches recent sessions
  -> User selects tab (tomorrow/thisweek/patterns/etc.)
  -> POST /api/coach { tab }
    -> Supabase: fetch last 20 trade_sessions
    -> Aggregate: pattern tags, cycle stages, mistake costs, win rates
    -> Supabase: fetch trade_analysis for recent sessions
    -> Build prompt with template (5 templates for 5 tabs)
    -> callClaude with structured JSON output request
    -> Parse response into sections with STOP/DO/PRACTICE items
    -> Return: { plan: { title, subtitle, sections[] } }
  -> UI renders coaching plan with rule checklists
```

---

## Section 9 - Configuration

### Environment Variables Required

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic Claude AI
ANTHROPIC_API_KEY=sk-ant-...

# Razorpay Payments (INR)
RAZORPAY_KEY_ID=rzp_test_... or rzp_live_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...  # Client-side for checkout modal

# Optional
GEMINI_API_KEY=...  # For health check endpoint only
```

### Middleware Route Configuration

**Public routes** (no auth required):
`/`, `/upload`, `/results`, `/pricing`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/parse`, `/api/analyse`, `/api/extract`, `/api/health`, `/api/sessions`, `/api/user/plan`, `/api/payments/(.*)`

**Protected routes** (auth required):
`/dashboard`, `/journal`, `/journey`, `/coach`, `/api/chat`, `/api/coach`, `/api/dashboard/stats`, `/api/journal/sessions`, `/api/user/journey`

**Authenticated user redirects**:
Users with valid session on `/`, `/sign-in`, `/sign-up` are redirected to `/dashboard`.

---

## Section 10 - Known Issues and Technical Debt

### TypeScript Errors (48 errors across 12 files)

All errors are in the Linux mount due to file truncation during sync. The Windows source files compile clean. Affected files:

- `components/AiChat.tsx` - mount truncation
- `components/ComparisonTable.tsx` - mount truncation
- `components/Features.tsx` - mount truncation
- `components/HowItWorks.tsx` - mount truncation
- `components/PlanGate.tsx` - mount truncation
- `components/Pricing.tsx` - mount truncation
- `components/TradePreview.tsx` - mount truncation
- `components/dashboard/PerformanceKPIs.tsx` - mount truncation
- `components/results/KPIStrip.tsx` - mount truncation
- `components/results/SessionSummary.tsx` - mount truncation
- `components/results/TradeDetail.tsx` - mount truncation
- `components/results/TradeSidebar.tsx` - mount truncation

**Note**: Build succeeds on Vercel because `next.config.mjs` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`.

### ESLint Suppressions

29 `eslint-disable` comments across 10 files, primarily `@typescript-eslint/no-explicit-any` in API routes where dynamic JSON handling requires flexible typing.

### Architectural Issues

1. **Duplicate session storage**: Both `trade_sessions` and `sessions` tables exist. The `sessions` table is a legacy table used only by `/api/sessions` route and the coach page. `trade_sessions` is the primary table used by the analyse flow. These should be consolidated.

2. **Duplicate plan hooks**: Three separate plan-related hooks exist: `hooks/useUserPlan.ts`, `lib/hooks/usePlan.ts`, and `lib/planStore.ts`. They overlap significantly and should be unified.

3. **Duplicate chat components**: Both `components/AiChat.tsx` (267 lines, FAB-style) and `components/chat/ChatPanel.tsx` (264 lines, sliding panel) exist with similar logic. The ChatWrapper mounts ChatPanel, while AiChat is mounted in layout.tsx. These could be consolidated.

4. **Large file concern**: `lib/trade-parser.ts` at 980 lines is the largest file. It handles CSV parsing, Excel parsing, PDF extraction, broker detection, and trade normalization. Should be split into separate parser modules.

5. **`universalParser.ts` vs `trade-parser.ts`**: Two separate parser files with overlapping broker detection logic. `universalParser.ts` (client-side, 422 lines) handles file-level detection. `trade-parser.ts` (server-side, 980 lines) handles content-level detection. The broker lists are maintained separately.

6. **Hardcoded pricing**: Plan prices (99/799/499 INR) are hardcoded in both `app/api/payments/create-order/route.ts` and `components/Pricing.tsx`. Should be in a shared config.

7. **No rate limiting**: API routes (`/api/analyse`, `/api/parse`, `/api/extract`) have no rate limiting. A single user could hammer the Claude API.

8. **Anthropic SDK imported but not used**: `@anthropic-ai/sdk` is in package.json but all Claude calls use raw `fetch()` to the API. The SDK is unused.

9. **`upload-v2/page.tsx` exists**: An experimental upload variant exists but isn't linked from navigation. Should be removed or promoted.

10. **No database migrations runner**: SQL migrations exist in `/supabase/migrations/` but there's no automated migration runner. Migrations are applied manually.

### Security Concerns

1. **API key logging**: `create-order/route.ts` logs partial Razorpay key IDs and secret existence to console. While not full keys, this is unnecessary in production.

2. **Service role key usage**: All server-side Supabase operations use the service role key (bypasses RLS). This is standard for Next.js API routes but means RLS policies are only enforced for direct client access.

3. **No CORS configuration**: API routes don't set CORS headers. Relies on Next.js default same-origin behavior.

4. **Webhook secret in error message**: The Clerk webhook route logs when `CLERK_WEBHOOK_SECRET` is missing but doesn't expose it.

### Performance Concerns

1. **No caching**: Dashboard stats endpoint queries all user sessions on every load. No Redis/in-memory cache.

2. **Sequential file parsing**: AnalyseButton parses files sequentially (`for...of` loop). Parallel parsing would be faster for multiple files.

3. **No pagination**: Journal sessions endpoint fetches last 50 sessions with full JSONB columns. Large analysis objects could be expensive.

4. **No image optimization**: No `next/image` usage detected. All images are raw emoji or inline SVG.

---

## Section 11 - File Size Analysis (Top 15)

| Rank | File | Lines | Should Split? |
|------|------|-------|---------------|
| 1 | lib/trade-parser.ts | 980 | Yes - split into CSV, Excel, PDF, broker-detection modules |
| 2 | app/api/analyse/route.ts | 509 | No - two-call architecture is cohesive |
| 3 | lib/parsers/universalParser.ts | 422 | No - but broker lists should be shared with trade-parser.ts |
| 4 | app/coach/page.tsx | 417 | Yes - extract tab content into sub-components |
| 5 | app/api/dashboard/stats/route.ts | 389 | Maybe - extract aggregation helpers |
| 6 | components/results/TradeDetail.tsx | 323 | Maybe - extract tag styling, note editor |
| 7 | app/api/coach/route.ts | 292 | No - prompt templates are necessarily long |
| 8 | components/AiChat.tsx | 267 | Yes - consolidate with ChatPanel.tsx |
| 9 | components/chat/ChatPanel.tsx | 264 | Yes - merge with AiChat.tsx |
| 10 | components/upload/AnalyseButton.tsx | 255 | No - error handling makes it large |
| 11 | app/journal/page.tsx | 241 | Maybe - extract pattern detection |
| 12 | components/Navbar.tsx | 212 | No - responsive nav is naturally complex |
| 13 | components/journal/SessionDetail.tsx | 206 | No - single component responsibility |
| 14 | app/api/extract/route.ts | 205 | No - but could share code with analyse |
| 15 | app/dashboard/page.tsx | 197 | No - composition of dashboard components |

---

## Section 12 - Deployment

### Vercel Configuration

- **Framework**: Next.js (auto-detected)
- **Build command**: `next build`
- **Output directory**: `.next`
- **Node.js runtime**: Serverless functions (not Edge)
- **Max duration**: 90s for `/api/analyse` (set via `export const maxDuration = 90`)
- **Other routes**: Default 10s timeout

### Build Optimizations

- TypeScript errors ignored during build (`ignoreBuildErrors: true`)
- ESLint ignored during build (`ignoreDuringBuilds: true`)
- This is intentional to prevent OOM on Vercel's build servers
- Types and lint are verified locally before deploy

### External Packages (Server Components)

- `unpdf` and `tesseract.js` are configured as external packages in `serverComponentsExternalPackages` to prevent bundling issues.

### Deployment Flow

```
Local development:
  next dev (port 3000)

Deploy:
  git add -A
  git commit -m "message"
  git push origin main
  -> Vercel auto-deploys from main branch
  -> Build: next build (TS errors ignored)
  -> Deploy: serverless functions + static assets
```

### Environment Variables on Vercel

All 9 environment variables from Section 9 must be set in Vercel dashboard under Settings > Environment Variables. The `NEXT_PUBLIC_*` prefixed variables are exposed to the client bundle.

---

*End of audit. Total codebase: ~13,263 lines of TypeScript/TSX across ~55 files. 16 API routes, 8 pages, 3 Zustand stores, 6 Supabase tables, 1 storage bucket.*
