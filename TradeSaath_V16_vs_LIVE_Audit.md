# TradeSaath — Ultra-Detailed Feature Audit
## v16 Prototype vs Live App (tradesaath.vercel.app)
### Date: 11 April 2026

---

## 1. LANDING PAGE (Before Login)

### 1.1 Navigation Bar

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Logo text | "TradeSaath" (plain text link to `/`) | "TradeSaath" with animated green dot (`.nav-logo-dot` 8px pulsing circle, `box-shadow: 0 0 12px rgba(62,232,196,.4)`) + Fraunces serif font | **GAP** — Live missing animated dot next to logo. Add pulsing `.nav-logo-dot` element |
| Logo font | System/Outfit sans-serif | `font-family: 'Fraunces', serif; font-size: 20px; font-weight: 700; letter-spacing: -.3px` | **GAP** — Logo should use Fraunces serif, not Outfit |
| Nav links (unauthenticated) | "How It Works", "Features", "Pricing", "FAQ" | "How It Works", "Features", "Pricing", "FAQ" — identical | ✅ MATCH |
| Nav links (authenticated) | "Dashboard", "Journal" (🔒 if \!paid), "AI Coach" (🔒 if \!pro) | "📊 Dashboard", "🗺 Journey", "📓 Journal", "🤝 Saathi", "👥 Partners" (last two: `.nav-paid-only`) | **GAP** — Live missing Journey, Saathi, Partners nav items. Live has "AI Coach" vs proto "Saathi". Live nav items lack emoji prefixes |
| Auth buttons (unauthenticated) | "Sign In" (ghost), "Get Started" (accent) | "Sign In" (ghost), "Get Started" (accent) — identical style | ✅ MATCH |
| Theme toggle button | "☀️ Night" / "🌙 Day" | "🌙 Day" / "☀️ Night" — pill style with `font-family: 'JetBrains Mono'`, 12px, border on hover turns accent | **MINOR GAP** — Live toggle works but may not use JetBrains Mono font or exact pill style |
| Nav background | Likely `backdrop-filter: blur()` with dark bg | `background: rgba(10,14,23,.8); backdrop-filter: blur(24px) saturate(1.4); border-bottom: 1px solid rgba(30,38,64,.5)` | Verify exact CSS matches |
| Nav height | TBD from CSS | `60px` (var `--nav-h`) | Verify |
| Hamburger menu (mobile) | 3-line hamburger with `open` animation | 3-span hamburger, `.open` rotates to X (line 1: `rotate(45deg)`, line 3: `rotate(-45deg)`, line 2: `opacity:0`) | Verify animation matches |
| Mobile menu items (authenticated) | Dashboard, Journal, AI Coach | 📊 Dashboard, 🗺 Journey, 📓 Journal, 🤝 Saathi, 👥 Partners + Sign In link | **GAP** — Mobile menu missing Journey, Saathi, Partners |

### 1.2 Hero Section

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Hero badge text | "Global Markets · All Currencies · No Login Required" | "Global Markets · All Currencies · No Login Required" — identical | ✅ MATCH |
| Badge style | Inline-flex with dot + mono font | Pulsing green dot (`.hero-badge-dot` 6px, `animation: pulse 2.5s infinite`) + `font-family: 'JetBrains Mono'; font-size: 11px; background: var(--accent2)` | Verify badge dot animation |
| Headline h1 | "Your trades reveal your patterns. We reveal them to you." | "Your trades reveal **your patterns.** We reveal them to you." — with `<em>` on "your patterns." styled `color: var(--accent); font-style: italic` + line breaks (`<br>`) | **GAP** — Verify "your patterns." is italicized and accent-colored in live. Proto has explicit `<br>` breaks for 3-line layout |
| Headline font | TBD | `font-family: 'Fraunces', serif; font-size: clamp(36px,6vw,68px); line-height: 1.08; letter-spacing: -2px; font-weight: 700` | Verify Fraunces font and responsive size |
| Sub-headline text | "Upload any trade file — NSE, NYSE, Forex, Crypto, any broker, any format. Get AI-powered P&L analysis, per-trade psychology coaching, live session monitoring, predictive warnings, and a personalised roadmap. Compare your discipline against 800+ traders." | Identical text | ✅ MATCH |
| Sub-headline style | TBD | `font-size: clamp(15px,2vw,17px); color: var(--muted2); max-width: 540px; line-height: 1.7` | Verify |
| Market tags | 🇮🇳 NSE/BSE, 🇺🇸 NYSE/NASDAQ, 🇬🇧 LSE, 🌍 Forex, ₿ Crypto, 🥇 Commodities, 🇦🇺 ASX, 🇸🇬 SGX | Identical 8 tags — `padding: 4px 12px; border-radius: 20px; font-size: 11px; JetBrains Mono; background: var(--s2)` | ✅ MATCH (verify styling) |
| CTA button 1 | "🔍 Analyse My Trades Free" (btn-accent btn-lg) | "🔍 Analyse My Trades Free" (btn-accent btn-lg) — scrolls to `#sec-app` | ✅ MATCH |
| CTA button 2 | "See Pricing →" (btn-ghost btn-lg) | "See Pricing →" (btn-ghost btn-lg) — scrolls to `#pricing` | ✅ MATCH |
| Hero glow effect | TBD | `radial-gradient(ellipse at 50% 30%, rgba(62,232,196,.08) 0%, transparent 70%)` — 800px×500px positioned above hero | Verify glow exists in live |
| Hero padding | TBD | `padding: calc(var(--nav-h) + 80px) 0 60px; text-align: center` | Verify |

### 1.3 How It Works Section

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Eyebrow | "How It Works" | "How It Works" | ✅ MATCH |
| Title | "From file to insight, *instantly.*" | "From file to insight, *instantly.*" (accent italic) | ✅ MATCH |
| Sub-text | "No account. No setup. Drop your file — market, exchange, and currency are auto-detected from the data itself." | Identical | ✅ MATCH |
| Layout | TBD (likely timeline) | Vertical timeline with numbered bubbles (44px circles) connected by gradient lines | Verify layout matches |
| Step 1 tag | "Upload" | "Upload" (default border style) | ✅ MATCH |
| Step 1 title | "Any file, any market — auto-detected" | "Any file, any market — auto-detected" | ✅ MATCH |
| Step 1 chips | PDF, CSV, Excel, Screenshot, Any Broker | PDF, CSV, Excel, Screenshot, Any Broker | ✅ MATCH |
| Step 2 tag | "Context" (gold) | "Context" (gold colored) | ✅ MATCH |
| Step 2 title | "Tell us how you felt going in" | "Tell us how you felt going in" | ✅ MATCH |
| Step 2 description | "4 quick dropdowns..." | "4 quick dropdowns — your mood, market conditions, session plan, and goal. Takes 10 seconds." | ✅ MATCH |
| Step 2 mood examples | 😤 Confident, 😰 Anxious, 😡 Revenge mode, 🤩 FOMO | Identical 4 pills | ✅ MATCH |
| Step 3 tag | "Analyse Free" (purple) | "Analyse Free" (purple) | ✅ MATCH |
| Step 3 title (LIVE) | "Instant P&L + Vicious Cycle + **1 deep trade**" | "Instant Gross P&L + Vicious Cycle + **3 deep trades**" | **GAP** — LIVE says 1 trade free, PROTO says 3 trades free. **Critical difference in free tier.** |
| Step 3 description | References "one complete trade analysis" | References "three complete trade analyses" + "P&L shown is gross — actual take-home after charges will differ" | **GAP** — Proto adds gross P&L disclaimer. Free tier = 3 trades not 1 |
| Step 3 preview items | ✓ Net P&L calculated, 🔁 Cycle stage detected, 📊 Price Action · Structure, 🧠 Mindset coaching | ✓ **Gross** P&L calculated, 🔁 Cycle stage detected, 📊 Price Action · Structure, 🧠 Mindset coaching | **GAP** — Proto says "Gross P&L" not "Net P&L" |
| Step 4 tag | "Unlock All" (cyan) | "Unlock All" (cyan) | ✅ MATCH |
| Step 4 title | "Full report for ₹99 · no subscription needed" | Identical | ✅ MATCH |
| Step 5 tag | "Pro only" (red) | "Pro only" (red) | ✅ MATCH |
| Step 5 title | "Journal · Journey · Pattern Intelligence" | Identical | ✅ MATCH |
| Proof bar below timeline | Not confirmed in live | Proof bar: "60 seconds", "10 trades", "1 session", "→ patterns for life" — with numbers styled in JetBrains Mono | **CHECK** — Proto has proof bar below timeline. Verify if live has it |

### 1.4 Features Section

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Feature count | 12 features | 13 features | **GAP** — Proto adds "Accountability Partners" feature card |
| Feature 1 | 🌍 All Global Markets | Identical | ✅ MATCH |
| Feature 2 (LIVE) | 🧠 Psychology Coaching — "**10-stage** Vicious Cycle detection" | 🧠 Psychology Coaching — "**8-stage** Vicious Cycle detection — FOMO, revenge trading, averaging down, panic exits. Named and coached." | **GAP** — Live says 10-stage, Proto says 8-stage. Harmonize |
| Feature 8 (LIVE) | 🗺 AI Coach [PRO] — "Daily, weekly, monthly & quarterly improvement plans" | 🤝 Saathi [PRO] — "Your personal AI coach — available on every page. Daily, weekly & monthly improvement plans. Knows your patterns, your history, your psychology. Only talks about your data." | **GAP** — Live: "AI Coach". Proto: "Saathi". Proto description richer. Proto omits "quarterly" |
| Feature 9 (LIVE) | 💬 AI Chat [PRO] — "Personal chatbot with full context..." | 💬 Saathi Chat [PRO] — "Ask Saathi anything about your trades — the floating button is always there..." | **GAP** — Naming: "AI Chat" vs "Saathi Chat" |
| Feature 12 (LIVE) | 🔗 Broker Integration [SOON badge] — "Coming in Phase 2" | 🔗 Broker Integration (no SOON badge) — "Auto-import trades from Zerodha, Angel One, Upstox, Dhan. No manual uploads. Habit loop..." | **GAP** — Proto removes SOON badge, implies feature is available |
| Feature 13 (PROTO only) | **MISSING** | 👥 Accountability Partners [PRO] — "Pair up with another trader. See each other's discipline scores. Weekly challenges." | **MISSING — NEEDS BUILD** in live |
| Feature grid layout | `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` | Same | Verify |
| Comparison Table header | "Free vs Premium" | "Free vs Premium" | ✅ MATCH |
| Free tier trade limit (table) | "1 trade" (Per-Trade Psychology row) | "3 trades" (Per-Trade Psychology row) | **GAP** — Free tier: 1 trade vs 3 trades |
| Comparison table rows | 15 rows | 17 rows — adds "Accountability Partners" and "Broker Auto-Import" rows | **GAP** — Proto adds 2 more comparison rows |
| AI Coach naming in table | "AI Coach (Daily/Weekly/Monthly Plans)" | "Saathi AI Coach (Daily/Weekly/Monthly Plans)" | **GAP** — Naming difference |
| Chatbot naming in table | "Personal AI Chatbot" | "Saathi Floating Chat (any page)" | **GAP** — Naming difference |
| Cross-User Insights row (LIVE) | "Cross-User Pattern Insights" → ✗ / ✗ / ✓ AI-powered | "Predictive Warnings" → ✗ / ✗ / ✓ AI-powered | **GAP** — Different feature name in this row |
| Vicious Cycle stages in FAQ | "10-stage framework: Disciplined Win → Overconfidence → Larger Position → Market Goes Against → Hope & Hold → Averaging Down → Panic Exit → Revenge Trade → Decision Fatigue → FOMO Re-entry" | "8-stage framework: Disciplined Win → FOMO Re-entry → Against Trend → Hope & Hold → Averaging Down → Panic Exit → Revenge Trade → Decision Fatigue" | **GAP** — 10-stage vs 8-stage. Different stage names |

### 1.5 Pricing Section

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Eyebrow | "Pricing" | "Pricing" | ✅ MATCH |
| Title | "Start free. Upgrade when ready." | "Start free. Upgrade when ready." | ✅ MATCH |
| Billing toggle | Monthly/Yearly with "Save 38%" badge | Identical toggle: `toggle-track` 44px×24px, green when on | ✅ MATCH |
| **Free Plan** | | | |
| Plan name | "Free" | "Free" | ✅ MATCH |
| Price | "₹0" | "₹0" | ✅ MATCH |
| Billed | "Always free · no account needed" | "Always free · no account needed" | ✅ MATCH |
| CTA | "Start Free →" | "Start Free →" (btn-ghost) | ✅ MATCH |
| Feature: Psychology | "1 trade full psychology" | "3 trades full psychology" | **GAP** — 1 vs 3 free trades |
| Feature: TA | "Free technical insights" | "Free technical insights" | ✅ MATCH |
| **Single Report Plan** | | | |
| Price | "₹99" | "₹99" | ✅ MATCH |
| Billed | "One-time · full session analysis" | "One-time · full session analysis" | ✅ MATCH |
| CTA | "Buy Report →" | "Buy Report →" (btn-ghost) | ✅ MATCH |
| Razorpay integration | Yes (useRazorpay hook) | Simulated (openAuthFlow function) | Live has real payments, proto is demo |
| **Pro Plan** | | | |
| Monthly price | "₹799/mo" | "₹799/mo" | ✅ MATCH |
| Yearly price | "₹499/mo" / "Billed ₹5,988/year · save 38%" | "₹499/mo" / "Billed ₹5,988/year · save 38%" | ✅ MATCH |
| CTA | "Get Pro Plan →" | "Get Pro Plan →" (btn-accent) | ✅ MATCH |
| "Most Popular" ribbon | Not confirmed | `::before` content "Most Popular" rotated 45deg, accent bg | Verify ribbon exists in live |
| Pro feature: AI Coach | "🗺 AI Coach (daily/weekly/monthly plans)" | "🤝 Saathi — your personal AI coach" + "🤝 Saathi floating assistant (any page)" (2 separate items) | **GAP** — Proto splits into 2 lines, uses "Saathi" naming |
| Pro feature: Dashboard | "📊 Pro Dashboard" | "📊 Pro Dashboard" | ✅ MATCH |
| Pro feature: Chat | "💬 Personal AI Chatbot" | Covered by "Saathi floating assistant" line | **GAP** — Different labeling |
| Test mode badge | Shows "TEST MODE — no real charges" with test card hint | Not in prototype | EXISTS — VERIFY IF KEEP (dev-only) |

### 1.6 FAQ Section

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| FAQ count | 5 questions | 5 questions | ✅ MATCH |
| Q1 | "What file formats are supported?" | Identical | ✅ MATCH |
| Q2 | "What markets and currencies are supported?" | Identical | ✅ MATCH |
| Q3 | "Is my data private?" | Identical | ✅ MATCH |
| Q4 text | "What is the Vicious Cycle?" — describes **10-stage** framework | "What is the Vicious Cycle?" — describes **8-stage** framework | **GAP** — 10 vs 8 stages, different stage order |
| Q5 | "Can I cancel my subscription?" | Identical | ✅ MATCH |
| Accordion animation | Chevron rotation | Chevron rotation (`transform: rotate(180deg)`), `.faq-a` max-height transition | Verify animation matches |

### 1.7 Footer

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Main text | "**TradeSaath** — AI Trading Psychology Engine" | "**TradeSaath** — AI Trading Psychology Engine" | ✅ MATCH |
| Sub-text | "Built for traders who want to understand, not just see, their results." | "Built for traders who want to understand, not just see, their results." | ✅ MATCH |
| Layout | Centered, border-top | `border-top: 1px solid var(--border); padding: 40px 0; text-align: center` | ✅ MATCH |

---

## 2. AUTH FLOW

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Auth provider | Clerk (full integration) | Simulated custom modal (`modal-auth`) with email/name fields + plan selection | **EXPECTED DIFF** — Live uses real Clerk, proto simulates |
| Sign In route | `/sign-in` (Clerk `<SignIn />`) | Modal overlay with `openModal('modal-auth')` | Live has dedicated route; Proto uses modal |
| Sign Up route | `/sign-up` (Clerk `<SignUp />`) | Same modal as sign-in | Live has separate route |
| Auth modal style (PROTO) | N/A — uses Clerk | Modal: 480px max-width, 32px padding, 20px border-radius, backdrop blur(8px), step dots | **REFERENCE** — Proto modal design should inform Clerk theming |
| Modal steps (PROTO) | N/A | 4 step dots: Account → Plan → Context → Payment | Proto has guided flow; live is Clerk default |
| Post-login redirect | Redirects to `/dashboard` | Shows dashboard view inline (`showView('sec-dashboard')`) | Live uses route redirect; Proto uses SPA view switching |
| Onboarding (first signup) | 3-step onboarding modal: "You're Not Alone", "A Coach Not a Scorecard", "Small Wins Real Progress" | No separate onboarding — goes straight to dashboard/upload | **EXISTS — VERIFY IF KEEP** — Live has onboarding modal that proto doesn't show |
| User sync | `AuthSync.tsx` → `useSyncUser()` → syncs to Supabase | Simulated state variable `S.loggedIn` | Live has real backend sync |
| Clerk webhook | `/api/webhooks/clerk` handles user.created/updated | N/A | Live has webhook, expected |

---

## 3. DASHBOARD (Logged-In Home)

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Layout | Single column, full-width content area | Single column, `wrap` container (max-width 1120px) | Verify max-width matches |
| Plan banner | Shows plan status (Free/Single/Pro) + upgrade button | Pro plan banner: "⭐ Pro Plan Active" with upgrade button if not pro | ✅ SIMILAR |
| Greeting | "Good morning/afternoon, [name]" with month/session count | "Good morning, *Trader*" (italic accent) + "March 2026 · 5 sessions · 50 trades analysed" in JetBrains Mono | **MINOR GAP** — Proto uses "Trader" placeholder, live uses real name. Verify JetBrains Mono styling |
| New Analysis button | "New Analysis" → links to `/upload` | "📂 New Analysis" → `openModal('modal-upload')` | **GAP** — Live navigates to /upload page; proto opens modal |
| **Discipline Score (TradeSaathScore)** | Shows 45-point score with 5 factors: Entry Quality, Exit Timing, Position Sizing, Rule Following, Emotional Control | Shows 38-point score with SVG ring, "Developing" badge, 22nd percentile. Benchmark bars: Your=38, Avg Trader=41, Profitable=58, Top 10%=72. Score breakdown: Win Rate 25%, Risk Management 25%, Consistency 20%, Emotional Control 20%, Session Discipline 10% | **GAP** — Proto has richer benchmarking (vs 800+ traders), percentile rank, animated ring with stroke-dashoffset, expandable info tooltip. Live has 5 factors but proto has 5 different factors |
| **Cross-User Pattern Insight** | Not confirmed | Card: "Pattern Insight" FROM 847 TRADERS — "Traders with your FOMO pattern on Mondays (n=142)..." with actionable advice | **MISSING — NEEDS BUILD** if not in live |
| **Pre-Market Check-in** | `PreMarketCheckin.tsx` exists | Gradient card: "☀️ Before you trade today" with pill buttons: "No revenge trades", "Stop at 10:30 AM", "Max 8 trades", "Fixed 20 lots", "Stop loss every trade" + "I'm ready →" button | Verify live implementation matches proto richness |
| **Performance KPIs** | `PerformanceKPIs.tsx` — Monthly P&L, win rate, avg win/loss, risk metrics | 6 KPI cards: This Month P&L (-₹12,450), Win Rate (38%), Success Rate (32%), Avg Risk:Reward (0.6x), Discipline (42/100), Best Time (09:20–10:15) | **GAP** — Proto has "Best Time" KPI and "Success Rate" (profitable sessions ratio). Verify live has these |
| **Equity Curve** | `DashboardEquityCurve.tsx` with streaks & drawdown | "Last 20 Sessions" equity curve + Streak Tracking (current/best/worst) + Risk Management (Max Drawdown, Avg Loss/Win, Max Position) in 2-column grid | Verify live matches 2-column layout with streaks |
| **Summary Cards** | `SummaryCards.tsx` — Today/Week/Month | 3 cards with colored top borders: Today (blue), This Week (gold), This Month (accent) — each with P&L, session count, trades, WR | ✅ SIMILAR — verify border-top styling |
| **Behavioral Insights** | `BehavioralInsights.tsx` exists | 4 insight cards: "Revenge trading — #1 money drain", "You trade more when losing", "Your mornings are impressive", "Your size tells your emotional state". Demo data disclaimer banner | Verify live content matches depth |
| **Goal Tracking** | Not confirmed in live | 4 goal progress bars: Win Rate 38%→50%, Revenge Trades 8→0, Max Trades/Day 12.6→8, Risk:Reward 0.6x→1.5x | **MISSING — NEEDS BUILD** if not in live |
| **Decision Quality Score** | Not confirmed in live | Ring chart with score and breakdown factors | **MISSING — NEEDS BUILD** if not in live |
| **Mistake Cost Calculator** | Not confirmed in live | "What Your Lessons Cost This Month" — total -₹17,290 with per-mistake breakdown and "if you'd followed your rules" counterfactual | **MISSING — NEEDS BUILD** if not in live |
| **More Insights toggle** | Not confirmed | "📊 More Insights (5 more)" button revealing: Performance Heatmap, Trade Distribution, Emotion Impact on P&L, Strategy Performance Comparison, Growth Path, Confidence Builder | **MISSING — NEEDS BUILD** if not in live |
| **Performance Heatmap** | Not confirmed | Time × Day of week heatmap grid — green=profitable, red=losing | **MISSING — NEEDS BUILD** |
| **Trade Distribution** | Not confirmed | Visual distribution chart | **MISSING — NEEDS BUILD** |
| **Emotion Impact on P&L** | Not confirmed | Grid showing P&L per emotional state | **MISSING — NEEDS BUILD** |
| **Strategy Comparison** | Not confirmed | Table: Strategy, Trades, Win Rate, Avg P&L, Gross P&L, Grade | **MISSING — NEEDS BUILD** |
| **Growth Path** | Not confirmed | Mastery levels track with current progress | **MISSING — NEEDS BUILD** |
| **Confidence Builder** | Not confirmed | Milestone dot track with discipline history | **MISSING — NEEDS BUILD** |
| **Recent Trades** | Not confirmed | 3 recent trades with time, symbol, side badge, P&L, psychology tag | **CHECK** if live has this |
| **Recent Sessions** | Not confirmed | 4 session cards: date, market, trade count, WR, P&L, bar chart + "View All →" to journal | **CHECK** if live has this |
| **Personalized Suggestions** | Not confirmed | Gradient card with "If you could only change one thing this week..." deep personalized advice | **MISSING — NEEDS BUILD** if not in live |

---

## 4. FILE UPLOAD FLOW

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Upload page route | `/upload` (dedicated page) | Inline on landing page (`#sec-app`), no route change | **ARCHITECTURAL DIFF** — Live uses separate page; proto keeps upload on homepage |
| Upload card header | "Upload Your Trades" | "📤 Analyse Your Trades" with `badge-free`: "Free · No login" | **GAP** — Different heading text. Proto has "Free · No login" badge |
| **Auto-detect bar** | `AutoDetectBar.tsx` — shows detected market/exchange | Bar: "Market, exchange & currency will be **auto-detected** from your file" + badge "Awaiting file…" → changes to "DETECTED" with accent color | Verify live matches proto's auto-detect UX |
| **Dropzone** | | | |
| Icon | 📂 | 📂 | ✅ MATCH |
| Title | "Drop files here or click to browse" | "Drop files here or click to browse" | ✅ MATCH |
| Subtitle | "PDF, CSV, Excel, screenshots — up to 40 files · any broker worldwide" | Identical | ✅ MATCH |
| File type tags | PDF, CSV, XLSX, XLS, PNG, JPG, JPEG | PDF, CSV, XLSX, XLS, PNG, JPG, JPEG | ✅ MATCH |
| Drag hover state | TBD | `border-color: var(--accent); background: var(--accent2)` class `.drag` | Verify |
| Dropzone style | TBD | `border: 2px dashed var(--border2); border-radius: 12px; padding: 32px; background: var(--s2)` | Verify |
| **File chips** | `FileChips.tsx` — removable chips | `.file-chip`: name (max 160px truncated), size in mono, red × remove button | Verify styling matches |
| Max file warning | TBD | "⚠ Max 40 files reached" in orange | Verify |
| **Trading Context** | | | |
| Header | "Trading Context" + "optional · makes analysis sharper" | Identical | ✅ MATCH |
| Layout | TBD | 2-column grid (`grid-template-columns: 1fr 1fr`), single column on mobile <600px | Verify |
| Dropdown count (LIVE) | 8 dropdowns + 1 textarea | 8 dropdowns + 1 textarea (identical fields) | ✅ MATCH |
| Experience options (LIVE) | 🌱 Beginner, 📊 Intermediate, 🎯 Experienced, 🏆 Professional | 🌱 Beginner, 📈 Intermediate, 💼 Experienced, 🏆 Professional | **MINOR GAP** — Different emojis (📊→📈, 🎯→💼) |
| Capital options (LIVE) | 💰 Under ₹50K, 💰 ₹50K–₹2L, 💼 ₹2L–₹10L, 🏦 ₹10L–₹50L, 🏛️ Above ₹50L | Under ₹50,000, ₹50K–₹2L, ₹2L–₹10L, ₹10L–₹50L, Above ₹50L (no emojis) | **MINOR GAP** — Live has emojis on capital options, proto doesn't |
| Mood options (LIVE) | 😎 Confident & focused | 😤 Confident & focused | **MINOR GAP** — Different emoji (😎 vs 😤) |
| Market view (LIVE) | 🟢 Bullish, 🔴 Bearish, 🟡 Neutral, ⚡ Volatile, 📅 Expiry, 🎲 No view | 📈 Bullish, 📉 Bearish, ↔️ Neutral, ⚡ Volatile, 🗓️ Expiry, ❓ No view | **MINOR GAP** — Different emojis |
| SL options (LIVE) | 🛡️ Strict, 🧠 Mental SL, ↕️ Moved/removed, ❌ No SL | ✅ Strict, 🧠 Mental SL, ⚠️ Moved/removed, ❌ No SL | **MINOR GAP** — Different emojis |
| Strategy options (LIVE) | 🚀 Breakout, 🔄 Reversal, 📈 Trend, ⚡ Scalping, 🕐 Swing, 🎯 No strategy | 🚀 Breakout, 🔄 Reversal, 🌊 Trend, ⚡ Scalping, 📆 Swing, 🎲 No strategy | **MINOR GAP** — Different emojis |
| Plan options (LIVE) | 📋 Full plan, 📝 Loose plan, 🚫 Abandoned plan, 🎲 No plan | 📋 Full plan, 🗒️ Loose plan, ⚠️ Abandoned plan, ❌ No plan | **MINOR GAP** — Different emojis |
| Default select text (LIVE) | "Select…" | "— select —" | **MINOR GAP** |
| **Analyse button** | | | |
| Button text | "Analyse" or similar | "🔍 Run Free Analysis" (btn-accent btn-lg) | **GAP** — Verify exact button text in live matches |
| Analyse note | TBD | "No login required · runs with demo data if no file" | Verify |
| Loading bar | TBD | 2px accent-colored bar that fills from 0→100% with 1.6s ease transition | Verify loading animation |

---

## 5. ANALYSIS RESULTS PAGE

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Results location | Inline on `/upload` page below upload card | Inline below upload card on same page (`#results-card`) | ✅ MATCH (conceptually) |
| Results nav | "New Analysis" button + trade count | "← New Analysis" (ghost) + meta text "Free tier · demo data" + "⬇ Report" download button | **GAP** — Proto has download report button |
| **KPI Strip** | `KPIStrip.tsx` — shown after parse | Grid of KPI cards: `grid-template-columns: repeat(auto-fit, minmax(110px, 1fr))`. Values: JetBrains Mono 18px bold. Labels: 9px uppercase mono | Verify grid layout and styling |
| KPI items shown | TBD | Gross P&L, Total Trades, Win Rate, Profit Factor, Avg Win, Avg Loss, Best Trade, Worst Trade | Verify exact KPIs match |
| **AI Session Summary** | `SessionSummary.tsx` (shown when AI done) | Card: "🧠 AI Session Summary" with `font-size: 14px; line-height: 1.8` body text | ✅ SIMILAR |
| **Momentum Indicators** | `MomentumIndicators.tsx` (shown when AI done) | "📊 Session Momentum Indicators" [FREE badge]. 2-column grid of momentum bars with name, percentage, track bar, description | Verify layout matches |
| **Vicious Cycle** | `ViciousCycle.tsx` (shown when AI done) | "🔄 Vicious Cycle Detector" [FREE badge]. 4-column grid: each stage card has name, count (22px mono), animated bar, description. `border-top: 2px solid [stage color]` | Verify 4-column grid layout |
| **Technical Insights** | `TechnicalInsights.tsx` (shown when AI done) | "📈 Free Technical Insights" [FREE badge]. 2-column `.fi-grid` with items: name, value, bar, description. + summary text | Verify exists and layout matches |
| **Per-Trade Layout** | Sidebar (`TradeSidebar.tsx`) + Detail (`TradeDetail.tsx`) | Sticky sidebar (320px) + detail area. `grid-template-columns: 320px 1fr` | Verify matches |
| Sidebar content | Trade list with filter tabs | Sidebar: title "Trades" + count badge + Filter tabs (All, BUY, SELL, ✅ Wins, ❌ Loss) + Running P&L ticker + scrollable trade list (max-height 500px) | **GAP** — Proto has "Running P&L Ticker" — verify if live has this |
| Trade card (collapsed) | TBD | Trade number, time (mono), symbol, side badge (BUY green / SELL red), quantity, P&L (16px mono bold), psychology tag pill, chevron | Verify all fields shown |
| Trade card (expanded) | `TradeDetail.tsx` with gating | 4-column detail grid: Entry, Exit, Qty, Holding Time. Then 3 colored sections: Technical (blue border-left), Psychology (purple border-left), Counterfactual (accent border-left). + Notes textarea | Verify 3-section colored layout |
| Free trade limit | 1 trade (based on code) | 3 trades (based on `PLAN_TRADE_LIMIT: { free: 3 }`) | **CRITICAL GAP** — Free tier: 1 vs 3 trades |
| **Paywall gate** | `PaywallGate.tsx` | "Unlock X More Trades" title + sub-text + price cards (selectable) + "Unlock Full Report →" button. Gradient background: `linear-gradient(135deg, rgba(157,122,247,.06), rgba(62,232,196,.04))` | Verify paywall design matches |

---

## 6. PAYWALL / GATING LOGIC

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Free user: KPI Strip | ✅ Visible (all trades) | ✅ Visible (all trades) | ✅ MATCH |
| Free user: Vicious Cycle | ✅ Visible | ✅ Visible [FREE badge] | ✅ MATCH |
| Free user: Momentum | ✅ Visible | ✅ Visible [FREE badge] | ✅ MATCH |
| Free user: Technical Insights | ✅ Visible | ✅ Visible [FREE badge] | ✅ MATCH |
| Free user: Per-trade detail | 1 trade unlocked | 3 trades unlocked | **CRITICAL GAP** — 1 vs 3 free trades |
| Free user: Trade Notes | ✗ Locked | ✗ Locked | ✅ MATCH |
| Free user: Counterfactual | ✗ Locked | ✗ Locked | ✅ MATCH |
| Paywall trigger | After clicking locked trade (trade > free limit) | After trade 3, remaining trades show paywall gate | **GAP** — Different trigger point |
| Paywall UI | `PaywallGate.tsx` component | Inline gradient card with plan price cards + CTA | Verify design matches |
| Paywall plan cards | TBD | 2 selectable cards: "SINGLE REPORT ₹99" and "PRO ₹799/mo" with hover/selected states | Verify |
| Journal gating | `<PlanGate required="paid">` | Nav items hidden for free users (`.nav-paid-only` display:none) | ✅ SIMILAR — different mechanism |
| AI Coach/Saathi gating | Requires Pro plan | Nav items hidden + `.nav-paid-only` | ✅ SIMILAR |
| Dashboard gating | Requires auth (redirect to /sign-in) | Requires simulated login | ✅ SIMILAR |

---

## 7. JOURNAL PAGE

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Page title | "Trading Journal" | "Trading Journal" (Fraunces 28px) | ✅ MATCH |
| Subtitle | TBD | "5 sessions · March 2026 · Pattern intelligence active" (mono) | Verify |
| **View toggle** | Not confirmed | Calendar / Timeline toggle buttons. Calendar = 📅, Timeline = 📋. Active: accent bg | **CHECK** — Does live have calendar view? |
| **Calendar View** | `CalendarCard.tsx` exists | Full month grid (7-column): MON–SUN headers, day cells with P&L coloring (green/red), click to expand day detail | Verify calendar grid implementation |
| Month navigation | TBD | ‹ / › buttons flanking "March 2026" title (Fraunces serif) | Verify |
| Day detail panel | TBD | Timeline card: "⏱ [Date]" header + trade timeline with dots, lines, symbol, P&L | Verify |
| **Timeline View** | `SessionList.tsx` + `SessionDetail.tsx` | 2-column layout: 280px sidebar (sticky, max-height 500px) + main content area | Verify layout |
| Sidebar: search | TBD | Input: "Search…" with accent focus border | Verify |
| Sidebar: filter tabs | TBD | All, Wins, Losses, Week — `.ftab` styled tabs | Verify |
| Session list items | `SessionList.tsx` | Date (13px bold), meta row (trades, P&L in mono), active state: accent bg + left border | Verify |
| **Stats row** | `JournalStats.tsx` | Grid: Total P&L, Sessions, Trades, Win Rate, Avg Session — each card with label (9px mono), value (20px mono bold), sub-text | Verify |
| **Pattern Alert** | Not confirmed | Purple gradient card: "🔁 Pattern Intelligence: Recurring Behaviour Detected" — describes averaging-down loop across sessions with cost | **MISSING — NEEDS BUILD** if not in live |
| **Timeline card** | TBD | "⏱ Trade Timeline — [Date]" with vertical timeline: dot (color-coded by P&L), symbol, side, entry→exit prices, time, P&L | Verify |
| **Session Notes** | Not confirmed | Card: "📝 Session Notes" with textarea + "Save Note" button | **CHECK** if in live |
| **Trading Journey tab** | `TradingJourney.tsx` exists in journal | Proto has Trading Journey as separate nav item ("🗺 Journey") | **GAP** — Live: tab in journal. Proto: separate page |

---

## 8. AI COACH / SAATHI PAGE

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| Page name | "AI Coach" (route: `/coach`) | "🤝 Saathi" (section view: `#sec-saathi`) | **GAP** — Name: "AI Coach" vs "Saathi" |
| Subtitle | TBD | "Your personal AI trading coach · Only talks about your data" (JetBrains Mono) | Verify |
| **Memory indicator** | Not confirmed in live | Green dot + "Saathi has reviewed **5 sessions · 63 trades** — everything below is based on *your* actual data, not generic advice" | **MISSING — NEEDS BUILD** if not in live |
| Tabs (LIVE) | Daily, Weekly, Monthly, Quarterly | 🌅 Tomorrow's Plan, 📅 This Week, 📚 Learning Path, 🔍 My Patterns, 🎯 Monthly Goals | **GAP** — Different tab structure. Proto has "Learning Path" and "My Patterns" instead of "Quarterly". Proto has "Tomorrow's Plan" not "Daily" |
| **Tomorrow's Plan** | "Daily" tab content | 3 roadmap sections: Psychological Focus (STOP/DO/PRACTICE actions), Technical Focus (actions), Tomorrow's 3 Rules (printable card) + motivational quote | **GAP** — Proto much richer with STOP/DO/PRACTICE tags, checkbox actions, printable rules card |
| **This Week** | "Weekly" tab | Weekly Focus (4 actions) + Scenario Planning (Best/Likely/Worst case with estimated P&L ranges) | **GAP** — Proto has scenario planning with P&L estimates |
| **Learning Path** | Not in live tabs | Psychology Learning Path (4 stages: Awareness ✓, Break Rule →, Position Size 🔒, Scale Readiness 🔒) + Technical Learning Path (3 skills) + Reading List (4 curated books) + Detected Patterns | **MISSING — NEEDS BUILD** — Entire learning path system |
| **My Patterns** | Partially in "Learning Path" above | Covered in Learning Path tab's "Detected Patterns" section: CRITICAL (revenge), WATCH (averaging), IMPROVING (FOMO), STRENGTH (morning) | See above |
| **Monthly Goals** | "Monthly" tab | 5 goal items with checkboxes + 3-column zone cards (Red/Yellow/Green with criteria) | **GAP** — Proto has zone visualization |
| **Community data insight** | Not confirmed | Card: "What 316 traders with your pattern did" — anonymized stats, improvement data | **MISSING — NEEDS BUILD** |
| **Saathi Chat** | `AiChat.tsx` / `ChatFAB.tsx` — floating button on all pages | Proto mentions floating chat but doesn't show dedicated UI for it | Live has chat FAB, proto references it |

---

## 9. NAVIGATION & ROUTING

| Feature Detail | LIVE App (Current) | PROTOTYPE (Target v16) | Gap / Action Needed |
|---|---|---|---|
| **Routes (Live)** | `/`, `/upload`, `/upload-v2`, `/results`, `/dashboard`, `/journal`, `/coach`, `/pricing`, `/sign-in`, `/sign-up` | Single-page app with view switching: `#page-home`, `#sec-dashboard`, `#sec-advanced`, `#sec-journey`, `#sec-journal`, `#sec-saathi`, `#sec-partners` | **ARCHITECTURAL DIFF** — Live: Next.js routes. Proto: SPA sections |
| **Pages in proto NOT in live** | — | `#sec-journey` (Trading Journey as full page), `#sec-saathi` (Saathi as named page), `#sec-partners` (Community/Partners page), `#sec-advanced` (Full Session Analysis view) | **MISSING PAGES**: Partners/Community page, Advanced view (pro trade detail view) |
| **Nav items: Free user** | Dashboard (+ locked Journal, locked AI Coach) | 📊 Dashboard only (Journey, Journal, Saathi, Partners hidden) | **GAP** — Live shows locked items, proto hides them entirely |
| **Nav items: Paid user** | Dashboard, Journal, AI Coach | 📊 Dashboard, 🗺 Journey, 📓 Journal, 🤝 Saathi, 👥 Partners | **GAP** — Live missing Journey and Partners nav items |
| Active nav styling | TBD | `.nav-active`: `color: var(--accent); background: var(--accent2)` | Verify |
| Mobile responsive | Hamburger → mobile menu | Hamburger → `.mobile-menu` with `.open` class | ✅ SIMILAR |
| Mobile breakpoint | TBD | `@media(max-width:768px)` for hamburger, `@media(max-width:600px)` for context grid | Verify breakpoints |

---

## 10. UI/UX DETAILS

### 10.1 Color Palette

| Token | PROTOTYPE (Dark Mode) | PROTOTYPE (Light Mode) | Action |
|---|---|---|---|
| `--bg` | `#0a0e17` | `#f7f8fc` | Verify live matches |
| `--s1` | `#10141f` | `#ffffff` | Verify |
| `--s2` | `#151a28` | `#f1f4f9` | Verify |
| `--s3` | `#1c2235` | `#e6ebf2` | Verify |
| `--border` | `#1e2640` | `#dfe4ed` | Verify |
| `--border2` | `#293353` | `#c9d1e0` | Verify |
| `--accent` | `#3ee8c4` | Same | Core brand color — verify |
| `--gold` | `#f0b429` | Same | Verify |
| `--blue` | `#5b8def` | Same | Verify |
| `--purple` | `#9d7af7` | Same | Verify |
| `--red` | `#f05d6c` | Same | Verify |
| `--green` | `#36d399` | Same | Verify |
| `--orange` | `#f29b4b` | Same | Verify |
| `--text` | `#e8ecf4` | `#111827` | Verify |
| `--text2` | `#b8c4d8` | `#4b5563` | Verify |
| `--muted` | `#546380` | `#6b7280` | Verify |

### 10.2 Typography

| Element | PROTOTYPE Spec | Action |
|---|---|---|
| Primary font | `'Outfit', system-ui, sans-serif` | Verify live uses Outfit |
| Heading font | `'Fraunces', serif` (hero h1, section titles, modal titles, plan prices) | Verify Fraunces loaded & used |
| Mono font | `'JetBrains Mono', monospace` (badges, KPIs, labels, prices, timestamps) | Verify JetBrains Mono loaded |
| Body line-height | `1.6` | Verify |
| Hero h1 size | `clamp(36px, 6vw, 68px)` | Verify responsive sizing |
| Section title size | `clamp(28px, 4vw, 46px)` | Verify |
| Body text | `13-15px` | Verify |
| Micro labels | `9-10px uppercase, letter-spacing: 1-2.5px` | Verify |

### 10.3 Buttons

| Style | PROTOTYPE Spec | Action |
|---|---|---|
| `.btn` base | `padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600` | Verify |
| `.btn-accent` | `background: var(--accent); color: #071a15` | Verify |
| `.btn-accent:hover` | `filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(62,232,196,.25)` | Verify hover lift effect |
| `.btn-ghost` | `background: transparent; border: 1px solid var(--border); color: var(--muted2)` | Verify |
| `.btn-ghost:hover` | `border-color: var(--accent); color: var(--accent); background: var(--accent2)` | Verify |
| `.btn-sm` | `padding: 6px 14px; font-size: 12px` | Verify |
| `.btn-lg` | `padding: 12px 24px; font-size: 14px; border-radius: 10px` | Verify |
| `.btn:disabled` | `opacity: .4; cursor: not-allowed` | Verify |

### 10.4 Cards & Shadows

| Element | PROTOTYPE Spec | Action |
|---|---|---|
| `.card` | `background: var(--s1); border: 1px solid var(--border); border-radius: 12px` | Verify |
| `.card:hover` | `border-color: var(--border2)` | Verify |
| `.card-head` | `padding: 14px 20px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600` | Verify |
| `.card-body` | `padding: 20px` | Verify |
| Shadow | `--shadow: 0 4px 24px rgba(0,0,0,.35)` (dark), `0 4px 24px rgba(0,0,0,.06)` (light) | Verify |
| Border radius | `--radius: 12px; --radius-sm: 8px; --radius-xs: 6px` | Verify |

### 10.5 Animations

| Animation | PROTOTYPE Spec | Action |
|---|---|---|
| Logo dot pulse | `@keyframes pulse { 0%,100%{opacity:1;scale(1)} 50%{opacity:.5;scale(.8)} }` 3s infinite | Verify |
| Hero badge dot | Same pulse, 2.5s infinite | Verify |
| Button hover lift | `transform: translateY(-1px)` | Verify |
| Feature card hover | `transform: translateY(-2px)` | Verify |
| Momentum bars | `width 0→target, transition: width .9s .2s` | Verify |
| Vicious cycle bars | `width 0→target, transition: width .8s .3s` | Verify |
| Theme transition | `transition: background .35s, color .35s` | Verify |
| Scrollbar | `5px width, var(--border2) thumb` | Verify |
| Grid texture bg | `radial-gradient dots 32px grid, rgba(62,232,196,.02)` | Verify |

### 10.6 Badges

| Badge | PROTOTYPE Spec | Action |
|---|---|---|
| `.badge-free` | `background: rgba(62,232,196,.08); color: var(--accent); border: 1px solid rgba(62,232,196,.2)` | Verify |
| `.badge-pro` | `background: rgba(240,180,41,.08); color: var(--gold); border: 1px solid rgba(240,180,41,.2)` | Verify |
| `.badge-lock` | `background: rgba(157,122,247,.08); color: var(--purple); border: 1px solid rgba(157,122,247,.2)` | Verify |
| Badge size | `padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; JetBrains Mono` | Verify |

### 10.7 Modal Styles

| Element | PROTOTYPE Spec | Action |
|---|---|---|
| Overlay | `background: rgba(0,0,0,.65); backdrop-filter: blur(8px)` | Verify |
| Modal | `max-width: 480px; padding: 32px; border-radius: 20px; background: var(--s1)` | Verify |
| Close button | Absolute top-right, `background: var(--s2); border-radius: 6px; padding: 6px 10px` | Verify |
| Title | Fraunces 24px | Verify |
| Step dots | `flex row, 2px height, accent when done` | Verify |

### 10.8 Toast Notifications

| Element | PROTOTYPE Spec | Action |
|---|---|---|
| Position | `fixed; bottom: 24px; right: 24px; z-index: 300` | Verify |
| Style | `padding: 12px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; background: var(--s1); border: 1px solid var(--border2)` | Verify |

---

## PAGES THAT EXIST IN PROTOTYPE BUT NOT IN LIVE

| Proto Page | Description | Status |
|---|---|---|
| `#sec-partners` (Community) | Full community features: My Partners (with partner cards, scores), Weekly Challenges (leaderboard), Community Feed (posts, reactions, replies), Study Rooms (live/scheduled), My Badges (earned/locked achievements), Find Partners (matching algorithm). This is a massive feature set with 6 sub-tabs. | **MISSING — NEEDS BUILD** (Major feature) |
| `#sec-journey` (Trading Journey as separate page) | 5-step emotional story input: The Beginning, The Dark Days, The Shift, Today, Your Truth. Each step: textarea + period/trades/P&L inputs + emotion pills. Generates beautiful story output with share/edit options | **PARTIALLY EXISTS** — Live has `TradingJourney.tsx` in journal tab. Proto makes it a full separate page with richer UX |
| `#sec-advanced` (Full Session Analysis) | Dedicated advanced view with KPI row, 2-column layout (280px sidebar + detail panel), filter tabs, detailed per-trade view | **PARTIALLY EXISTS** — Live has per-trade analysis inline on /upload. Proto has dedicated advanced view |

## FEATURES THAT EXIST IN LIVE BUT NOT IN PROTOTYPE

| Live Feature | Description | Status |
|---|---|---|
| Onboarding Modal | 3-step welcome carousel: "You're Not Alone", "A Coach Not a Scorecard", "Small Wins Real Progress" | **EXISTS — VERIFY IF KEEP** — Good UX, proto doesn't show it |
| AI Chat FAB | Floating chat button with quick prompts, session memory, full chat interface (`AiChat.tsx`, `ChatFAB.tsx`, `ChatPanel.tsx`) | **EXISTS — KEEP** — Proto references "Saathi floating chat" |
| Quarterly Coach Tab | `/coach` has quarterly tab in addition to daily/weekly/monthly | **EXISTS — VERIFY IF KEEP** — Proto only has daily/weekly/monthly patterns |
| Real Razorpay Integration | Full payment flow with order creation + verification | **EXISTS — KEEP** — Proto simulates payments |
| Clerk Full Integration | Sign-in/sign-up routes, UserButton, webhook sync | **EXISTS — KEEP** — Proto simulates auth |
| Test Mode Banner | Shows test card details for development | **EXISTS — DEV ONLY** — Remove in production |
| `/upload-v2` route | Alternative upload page | **EXISTS — VERIFY IF KEEP** — May be legacy |
| `/results` redirect | Redirects to `/upload` | **EXISTS — VERIFY IF KEEP** — Legacy redirect |

---

## CRITICAL GAPS SUMMARY (Priority Order)

### P0 — Must Fix (Inconsistencies)
1. **Free tier trade limit**: Live = 1 trade, Proto = 3 trades. **Decision needed: which is correct?**
2. **Vicious Cycle stages**: Live = 10-stage, Proto = 8-stage. **Harmonize across all copy**
3. **AI Coach naming**: Live = "AI Coach", Proto = "Saathi". **Decision needed: rename to Saathi?**
4. **P&L labeling**: Proto explicitly says "Gross P&L" with disclaimer about charges. Live may say "Net P&L". **Harmonize**

### P1 — Missing Features (Big builds)
5. **Community/Partners page** (`#sec-partners`) — 6 sub-tabs: Partners, Challenges, Feed, Rooms, Badges, Find. **Major new feature**
6. **Dashboard: Decision Quality Score** — Ring chart + factor breakdown
7. **Dashboard: Mistake Cost Calculator** — Learning cost + counterfactual
8. **Dashboard: Goal Tracking** — 4 progress bars with targets
9. **Dashboard: Performance Heatmap** — Time × Day grid
10. **Dashboard: More Insights** — Trade distribution, emotion impact, strategy comparison, growth path, confidence builder
11. **Dashboard: Cross-User Pattern Insight** — "From 847 traders" card
12. **Dashboard: Personalized Suggestions** — Deep advice card
13. **Saathi: Learning Path** — Psychology + Technical staged progression
14. **Saathi: Scenario Planning** — Best/Likely/Worst case with P&L estimates
15. **Journal: Calendar View** — Full month grid with day selection
16. **Journal: Pattern Intelligence Alert** — Recurring behaviour detection card

### P2 — UI/Style Gaps
17. **Logo: Add pulsing green dot** next to "TradeSaath"
18. **Logo: Switch to Fraunces serif** font
19. **Nav items: Add emoji prefixes** (📊, 🗺, 📓, 🤝, 👥)
20. **Upload card header**: "📤 Analyse Your Trades" with "Free · No login" badge
21. **Results: Running P&L Ticker** in trade sidebar
22. **Results: Download Report button**
23. **Dropdown emoji alignment** — Minor emoji differences across context dropdowns
24. **Dashboard: Recent Trades row** — Time + symbol + side + P&L + tag
25. **Dashboard: Recent Sessions grid** — 4 session cards with bar charts

### P3 — Architectural Decisions
26. **Journey: Separate page vs journal tab** — Proto wants separate nav item
27. **Advanced view: Dedicated route** — Proto has `#sec-advanced` with richer layout
28. **Upload location**: Live = separate `/upload` route, Proto = inline on landing page. **Keep live approach (route-based)**
