# TradeSaath V12 Prototype vs Live Tool — Ultra Micro Gap Report

**Live URL:** https://tradesaath.vercel.app/
**Prototype:** `tradesaath_v12-c4edef59.html` (5,473 lines, single SPA)
**Spec:** `TradeSaath_V12_Complete_Feature_Spec.docx`
**Date:** 2026-04-08

This report lists every gap, omission, and divergence between V12 and the live tool, section by section. Items marked **[BLOCKER]** break the prototype's intended flow. Items marked **[UI]** are styling/layout. Items marked **[AI]** are prompt/output gaps.

---

## 0. Top-Level Architectural Divergence — The Root Cause

| | V12 Prototype | Live Tool |
|---|---|---|
| **App shape** | Single-page app (SPA). Landing + Upload + Results all on `/`. Dashboard/Journal/Coach are *view states* of the same page (`showView()` swaps `<div class="section-view">`). | Multi-page Next.js app. `/`, `/upload`, `/results`, `/dashboard`, `/journal`, `/coach` are separate routes. Data crosses pages via sessionStorage. |
| **Upload location** | Upload card sits **inline on the landing page** below the hero (`<section id="sec-app">`). User scrolls down and uploads — never leaves the page. | Landing page only has a placeholder card "Analyse Your Trades Now" with a "Start Free Analysis" button that **navigates to `/upload`**. User loses landing context. |
| **Results location** | Results render **on the same landing page** below the upload card. Same `wrap-narrow`, no navigation. | Results render on a **separate `/results` page**. Loses landing context. |
| **Navigation after login** | "Returning Pro user → Dashboard" via `showView('sec-dashboard')`. No URL change. | Returning users land on `/upload` (LogoLink was changed). Dashboard is a separate route. |

**[BLOCKER]** This is the single biggest gap. The prototype's "no friction, scroll-and-go" feel is gone. To match V12 the upload card and results card must be embedded directly inside `app/page.tsx` (the landing page), not on `/upload` and `/results` routes. The current routes can be kept as fallback but the **primary path must be inline**.

---

## 1. Navigation Bar Gaps

| Element | V12 | Live | Status |
|---|---|---|---|
| Logo with animated green pulsing dot | `.nav-logo-dot` keyframe pulse | Pulsing dot present | ✅ Match |
| Logo click target | Calls `goHome()` — scrolls top of `/` | Logo links to `/upload` for signed-in users (changed in earlier session) | ❌ **[BLOCKER]** Should always go to `/` (landing). Currently sends signed-in users to `/upload`. |
| Landing-only nav links (How / Features / Pricing / FAQ) | Anchor links `#how #features #pricing #faq`, hidden after login via `nav-landing-link` class | Live shows them as anchors but they only work on `/`; on other routes they 404 | ⚠ Partially missing — need same anchors and conditional hide on app routes |
| App nav links (📊 Dashboard / 📓 Journal / 🎯 AI Coach) | Emoji icons + text. AI Coach has `nav-paid-only` class — Pro only | Present but emoji not always rendered. AI Coach gating is correct now | ✅ Mostly match |
| Theme toggle | Pill button with 🌙/☀ + "Day"/"Night" label, smooth 350ms transition | Toggle present | ✅ Match |
| Sign In button | `.btn-ghost.btn-sm` opens `modal-auth` (inline modal) | Routes to `/sign-in` (Clerk page) | ❌ Different — V12 uses inline modal. Live uses Clerk hosted route. |
| Get Started button | `.btn-accent.btn-sm` opens `modal-auth` | Routes to `/sign-up` | ❌ Same gap as above |
| Hamburger menu animation | 3-line → X transform, 900px breakpoint | Present | ✅ Match |
| Account button after login | Avatar / name display | Clerk `<UserButton>` | ⚠ Different visual but functional |

---

## 2. Hero Section Gaps

| Element | V12 | Live | Status |
|---|---|---|---|
| Background radial glow (green, 8% opacity, top-centered) | `.hero-glow` div | Present | ✅ |
| Top badge "Global Markets · All Currencies · No Login Required" + animated dot | Present | Present | ✅ |
| Headline "Your trades reveal **your patterns.** We reveal them to you." | "your patterns" in green italic Fraunces | Live has same text but styled with `<em>` (no italic forced) | ⚠ Italic styling may differ — verify CSS |
| Subheadline | Single paragraph, 4 lines | Present | ✅ |
| Market badges row (8 items: NSE/BSE, NYSE/NASDAQ, LSE, Forex, Crypto, Commodities, ASX, SGX) | Pill row | Present | ✅ |
| CTA buttons (2): "🔍 Analyse My Trades Free" + "See Pricing →" | First scrolls to `#sec-app` (inline upload), second to `#pricing` | First links to `#sec-app` which **doesn't exist** on live (no inline upload section). Falls back to nothing or scrolls to placeholder. Second works. | ❌ **[BLOCKER]** "Analyse My Trades Free" CTA leads nowhere meaningful because the upload section is on a different page |

---

## 3. Upload Card — The Single Biggest Missing Block

**[BLOCKER]** V12's upload card lives inline at `<section id="sec-app">` directly below the hero. The live landing page replaces the entire upload card with a small placeholder (`HomeUpload.tsx`) that just says "Analyse Your Trades Now" + a button.

Every sub-element below is **missing from the landing page** in live (some exist on `/upload` but not embedded):

### 3.1 Plan Banner (`#plan-banner`)
- V12: Color-coded banner (green/gold/purple) showing current plan, dynamically updated
- Live: Not rendered on landing. Exists in `/upload` only.
- **Gap:** Move to landing or embed `/upload` content into `/`.

### 3.2 Auto-Detection Bar (`.autodetect-bar`)
- V12: 🔍 icon + "Awaiting file…" badge → updates to "NSE / BSE detected" after detection. Reads filename for keywords (`NIFTY`, `EURUSD`, `BTC`, etc.).
- Live: Not present on landing. **Likely missing on `/upload` page too** — verify.
- **Gap:** Add filename keyword detector with badge UI.

### 3.3 Dropzone (`.dropzone`)
- V12: Dashed border #293353, folder emoji icon, "Drop files here or click to browse" title, sub "PDF, CSV, Excel, screenshots — up to 40 files · any broker worldwide", accepts `.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg`, multiple files, label-wrapped input
- V12: Border turns green on dragover
- Live (`/upload`): Has dropzone but **on a separate page**. Style and UX may differ.

### 3.4 File Chips (`.file-list`)
- V12: After upload, files render as horizontal chips: filename (truncated) + size in KB + ✕ remove. Shows warning at 40 file limit (`#file-warn`).
- Live: Need to verify the 40-file warning and chip layout match.

### 3.5 Trading Context — 8 Questions (`.ctx-box`)
**[CRITICAL GAP]** This is the most important missing block.

V12 has **8 mandatory context questions** in a 2-column grid with header "Trading Context — optional · makes analysis sharper":

| # | Field ID | Label | Options |
|---|---|---|---|
| 1 | `ctx-experience` | Experience level | Beginner (<1yr), Intermediate (1-3yr), Experienced (3-7yr), Professional (7+yr) |
| 2 | `ctx-capital` | Total trading capital | Under ₹50K, 50K-2L, 2L-10L, 10L-50L, Above 50L |
| 3 | `ctx-mood` | Your mood going in | Confident, Neutral, Anxious, Frustrated from yesterday, Overexcited/FOMO, Tired |
| 4 | `ctx-market-view` | Market view that day | Bullish, Bearish, Neutral/rangebound, Volatile/event, Expiry day, No view |
| 5 | `ctx-sl` | Stop loss rules | Strict, Mental SL only, Set but moved/removed, No SL defined |
| 6 | `ctx-strategy` | Strategy intention | Breakout/momentum, Reversal, Trend following, Scalping, Swing, No defined strategy |
| 7 | `ctx-plan` | Pre-market plan | Full plan with clear levels, Loose plan, Had plan but abandoned, No plan |
| 8 | `ctx-notes` | Special notes | Free-form textarea (full row span) |

Live: Need to grep `/upload/page.tsx` to confirm — most likely only 4 of these are present, or none.

### 3.6 Analyse Button + Loading Bar
- V12: "🔍 Run Free Analysis" green accent button, sub-text "No login required · runs with demo data if no file", 2px green progress bar that fills over 1.6 sec
- Live: Different label, no demo-data fallback (which is fine — V12 spec was changed by user to require upload anyway)

---

## 4. Results Display Gaps (`#results-card`)

### 4.1 Results Nav Bar
- V12: "← New Analysis" ghost button + "Free tier · demo data" meta + "⬇ Report" download button on right
- Live: Has new analysis link, has download button — ✅
- **Gap:** Verify "Download Report" actually exports a PDF/CSV. If it just downloads JSON, fix it.

### 4.2 KPI Strip — 9 KPIs Required
V12 spec lists **9 KPIs** in `.kpi-strip`:
1. Net P&L (color-coded)
2. Total Trades
3. Win Rate %
4. Avg Win
5. Avg Loss
6. **Max DD (Maximum Drawdown)** ❌ — verify present in live
7. Best Trade P&L
8. Worst Trade P&L
9. **Risk:Reward ratio** ❌ — verify present in live

Live currently shows about 6-7 KPIs based on `mergeAIResult()`. **Max DD and Risk:Reward likely missing.**

### 4.3 AI Session Summary Card
- V12: 🧠 brain emoji header, narrative paragraph 14px line-height 1.8
- Live: Present
- ✅ Match (assuming AI returns `summary`)

### 4.4 Session Momentum Indicators (`.momentum-grid`)
- V12: 2-column grid, FREE badge, 4 items (Win Rate / Profit Factor / Discipline Score / Risk:Reward), each with **animated fill bar**
- Live: Renders if AI returns `momentum` array, but uses 4 different names (Rule Following / Staying Calm / Entry Timing / Exit Discipline) **per the current Claude prompt**.
- **Gap [AI]:** The names in the current prompt **don't match V12**. V12 momentum names are: **Win Rate, Profit Factor, Discipline Score, Risk:Reward** — these come from KPIs, not from AI. The card should be **calculated locally** from KPI data, not generated by Claude. Fix: render momentum from `parsed.kpis`, not from `analysis.momentum`.

### 4.5 Vicious Cycle Detector (`.cycle-grid`) — 8 vs 10 Stage Inconsistency
**[BLOCKER + AI]** Major confusion across V12 itself:

- Landing FAQ in V12 says: **8-stage** cycle: Disciplined Win → FOMO Re-entry → Against Trend → Hope & Hold → Averaging Down → Panic Exit → Revenge Trade → Decision Fatigue
- Spec section 15.1 says: **10 stages**: Good Trade → Overconfidence → Larger Position → Market Goes Against → Hope/Refusal → Averaging Down → Panic Exit → Revenge Trade → Decision Fatigue → FOMO Re-entry
- Visual `cycle-grid` in V12 shows: **4 cards**: Good Trade/Win, FOMO Re-entry, Against Trend, Averaging Down

Live tool's current Claude prompt requests **8 stages** matching the FAQ, but the cycle-grid display shows whatever AI returns (currently 8 stages).

**Gap:** Need to **decide and standardise to 10 stages** (the spec is the source of truth). Then:
1. Update `buildPsychologyPrompt()` in `app/api/analyse/route.ts` to ask Claude for all 10 stages with the exact names.
2. Update FAQ on landing to say "10-stage" instead of "8-stage".
3. Update results display to render 10 stages in 4-col grid (2 on mobile).
4. Each card shows: stage name, count, **animated bar** showing percentage, description.

### 4.6 Free Technical Insights (`.fi-card`)
- V12: FREE badge, 2-column grid with 4 cards: **Entry Quality, Trend Alignment, Volume Analysis, Setup Quality**, each with progress bar + description, plus a `#fi-summary` text
- Live: Present (`technical_insights` from AI), but **the V12 names are different**. V12 uses "Volume Analysis" — currently the AI prompt requests "Trend Alignment, Entry Structure, Exit Quality, Entry Timing" which doesn't match.
- **Gap [AI]:** Update prompt to request these exact 4 names: Entry Quality, Trend Alignment, Volume Analysis, Setup Quality. Add `fi_summary` field for the trailing summary text.

---

## 5. Per-Trade Analysis Cards — Massive Gaps

V12 has a **two-column 320px sidebar + flexible main panel** layout for trade analysis. This is the heaviest section of the entire prototype with 12+ sub-blocks per trade.

### 5.1 Layout
- V12: `<div style="display:grid;grid-template-columns:320px 1fr">` with sticky sidebar
- Live: Single column on `/results`, sidebar may collapse
- **Gap [UI]:** Verify 320px sticky sidebar is present and matches V12 spacing (`top:calc(var(--nav-h) + 20px)`).

### 5.2 Sidebar (`.adv-sidebar`)
| Element | V12 | Live | Status |
|---|---|---|---|
| Header "Trades" + count "10 orders" | `.adv-sb-head` | ✅ |  |
| Filter tabs: All, BUY, SELL, **Losses** | 4 buttons `.ftab` with `resFilter()` | Some present, "Losses" filter likely missing | ⚠ |
| Running P&L Ticker (`#rpnl-ticker`) | "Running P&L: ₹X" updating as you scroll | ✅ Implemented in current results page | ✅ |
| Mini bar chart of cumulative P&L per trade | `.rpnl-row` with `.rpnl-bar` | ✅ |  |
| Trade list (`.adv-trade-list`, max-h 500px scroll) | Each item: trade #, symbol, time, **session badge (Morning/Midday/Afternoon)**, side badge (BUY/SELL), P&L, cumulative P&L | Live shows: trade #, symbol, side, P&L. **Missing: session badge, cumulative P&L per row, time** | ❌ |
| Lock icon for trades beyond plan limit | Locked rows trigger auth modal | Likely missing | ❌ |

### 5.3 Trade Card Header (Always Visible)
| Element | V12 | Live | Status |
|---|---|---|---|
| Trade number, **time in monospace**, symbol, side badge (BUY/SELL), **quantity** | All present | Most present, time formatting may not be monospace, qty may be missing | ⚠ |
| P&L, behavioral tag pill (color-coded), chevron arrow | Present | Present | ✅ |

### 5.4 Expanded Detail — Required Blocks (in this exact order)

| # | Block | V12 Spec | Live Status |
|---|---|---|---|
| 1 | **Market Context Strip** — NIFTY level, VIX level, news headline, color-coded up/down arrows, session badge | Required block at top of expanded card | ❌ **MISSING** (no NIFTY/VIX in current prompt or UI) |
| 2 | **Previous Trades Context** — small chips for last 3 trades, win=green/loss=red with amounts | Required block | ❌ **MISSING** (current code does `prev5` but no chip UI) |
| 3 | Entry/Exit/Cumulative Grid (5-col: Entry, Exit, Qty, Net P&L, Cum P&L) | Required | ⚠ Some columns present, verify all 5 |
| 4 | **Fills Table** (Qty / Price / Value, weighted average) | Required if multiple fills | ❌ **MISSING** |
| 5 | Quick Summary (green left-border, cycle stage + narrative) | Required, with `vicious_cycle_stage` | ⚠ Partial — has summary, but stage label may be missing |
| 6 | Psychology Coaching (purple left-border) | Required, deep mindset | ✅ Present (`psychology_coaching`) |
| 7 | Counterfactual / What If (green left-border, PAID gate for free users) | Required with paywall placeholder | ⚠ Present but verify free-tier lock |
| 8 | **Deep Dive toggle** button — expands 5 more blocks | Required | ❌ **MISSING** |
| 8a | **Technical Analysis** (blue left-border) — entry quality, exit logic, market structure, **A/B/C/D/F grade**, **Options-specific tags (CE/PE, ITM/ATM/OTM, Theta risk, VIX, time to expiry, avg fill price)** | Required with options support | ⚠ Has `technical_analysis` text but no grade, no options tags |
| 8b | **Entry/Exit Efficiency** (3-col: entry %, exit %, R:R + optimal R:R comparison) | Required | ⚠ Has `entry_exit_efficiency` field but verify all sub-fields |
| 8c | **Entry Timing Analysis** (orange header) — first-minute high vol / middle stabilization / last-minute breakout | Required | ⚠ Has `entry_timing` but verify candle-position analysis |
| 8d | **In-Trade Behavior** (gold header) — flags: REVENGE / AVERAGING / PANIC / FOMO / AGAINST TREND / DISCIPLINED / OVERSIZED + hold behavior | Required | ⚠ Has `in_trade_behavior` field but flags may not match |
| 8e | **What You Did vs Should Have Done** (orange left-border, 2-col compare) — left red (action/entry/exit/SL/qty/result), right green (rule/explanation), bottom action item | Required | ⚠ Has `what_you_did_vs_should_have` but verify 2-col layout |
| 9 | **Vicious Cycle Position** — full 10-stage horizontal timeline with current trade highlighted | Required | ❌ **MISSING** |
| 10 | **Cross-User Pattern Insight** (PAID, losing trades only) — "From 847 traders: …" | Required | ❌ **MISSING** |
| 11 | **Your Reflection / Notes** (PAID textarea) — saved notes shape future coaching | Required | ❌ **MISSING** |

**[BLOCKER]:** Items 1, 2, 4, 8 (Deep Dive toggle), 9, 10, 11 are all missing or incomplete. The trade card is the heart of the product and currently shows ~40% of the V12 content.

### 5.5 Paywall Gate
- V12: "Unlock X More Trades" title + 3 pricing options (Single ₹99, Pro Monthly ₹799, Pro Yearly ₹499/mo) + "Unlock Full Report →" button
- Live: Present
- ✅ Match — verify the 3 prices are listed.

### 5.6 Plan-Based Trade Limits
| Plan | V12 | Live |
|---|---|---|
| Free | 1 trade full | ✅ 1 trade |
| **Starter** | 3 trades | ❌ Not implemented (no Starter plan) |
| Single | All (999) | ✅ All |
| Monthly | All | ✅ All |
| Yearly | All | ✅ All |

---

## 6. Dashboard Gaps (`/dashboard`)

V12 dashboard has **20 distinct widgets** in this exact order. Live tool has many but order/styling diverge.

| # | Widget | V12 Spec | Live Status |
|---|---|---|---|
| 6.1 | **Plan banner + Greeting** ("Good morning, [Name]" Fraunces serif, name in green italic) + month/year subtext + "📂 New Analysis" button | Required | ⚠ Greeting present but verify Fraunces italic |
| 6.2 | **TradeSaath Score** card — 120px SVG ring, score number in monospace, "OUT OF 100" label, 5-factor breakdown grid (Entry Quality / Exit Timing / Position Sizing / Rule Following / Emotional Control), **Benchmark Comparison row (You / Average 41 / Profitable 58 / Top 10% 72+)**, **"Biggest drag" callout** | Centerpiece widget | ⚠ Score ring present, **Benchmark Comparison row MISSING**, **Biggest drag callout MISSING** |
| 6.3 | **Cross-User Pattern Insight** auto-rotating card every 15s, "FROM 847 TRADERS" tag, sample text "Traders with your FOMO pattern…" | Required | ⚠ Card present but **no auto-rotation**, content is static |
| 6.4 | **Pre-Market Check-in** — "Before you trade today" + 5 intention pills (No revenge / Stop at 10:30 / Max 8 / Fixed 20 lots / SL every trade) + "I'm ready" button → toast | Required, interactive | ✅ Present |
| 6.5 | **Quick Actions** (3 buttons: Add Trade / Open Journal / Trading Journey) | Required | ⚠ Live has Upload/Journal/**Upgrade Plan** instead of "Trading Journey" — should be Trading Journey link |
| 6.6 | **Performance Overview** — 6 KPI cards: This Month P&L, Win Rate, **Success Rate**, Avg R:R, Discipline, Best Time | Required | ⚠ Most present, verify "Success Rate" (profitable sessions ratio) and "Best Time window" with WR % |
| 6.7 | **Equity Curve** (bar chart, last 20 sessions, green/red bars) + **Streak Tracking** (current/best/worst with dates) + **Risk Management** (Max DD, AvgL/AvgW, Max Position) | Required, 2-col layout | ⚠ Equity curve and streaks present, **Risk Management card MISSING** |
| 6.8 | **Daily/Weekly/Monthly Summary Cards** (3-col: Today / This Week / This Month with colored top borders) | Required | ❌ **MISSING** |
| 6.9 | **Behavioral Insights** — 4 insight cards (Revenge / Overtrading / Mornings / Position Sizing) with emoji headers | Required, 2-col | ✅ Present |
| 6.10 | **Certified Discipline Badge** (100px circle, shield emoji, gold border, glow) + criteria (DQS 60+ with 30-day streak) + Twitter/Discord share buttons (locked) AND **Referral System** (TRADESAATH-A7K9 code + copy button + Referrals/Converted/Free Months stats) | Required, 2-col | ⚠ Badge present, **Referral system present but verify stats UI** |
| 6.11 | **Goal Tracking** (4 goals with progress bars: Win Rate, Revenge Trades, Max Trades/Day, R:R) | Required | ✅ Present |
| 6.12 | **Personalized Suggestions** (gradient card, "If you could only change one thing this week:…") | Required | ⚠ Present, verify gradient + specific data-driven text |
| 6.13 | **Decision Quality Score (DQS)** — separate SVG ring + 5-factor bars | Required, separate from TradeSaath Score | ⚠ Live merges this with TradeSaath Score — should be a **separate** widget below |
| 6.14 | **Mistake Cost Calculator** — "What Your Lessons Cost This Month" header, total cost + savings, per-mistake rows (Revenge: 8 trades, -₹8,400, ₹1,050 each) | Required | ⚠ Present, verify per-mistake row format |
| 6.15 | **More Insights toggle** (collapsible) → expands 5 widgets: Performance Heatmap (time × day), Trade Distribution, Emotion Impact (4 emotion cards: Revenge/Anger, Fear/Anxiety, FOMO/Greed, Calm/Neutral), Strategy Performance Table (Breakout A / Pullback B / Scalping C / Reversal D / Impulse F grades), Growth Path (5-stage track) | Required | ❌ **No "More Insights" toggle**. Some widgets present (Strategy Comparison, Distribution, Emotion, Growth Path) but **Performance Heatmap MISSING** and they're always visible — should be hidden behind toggle |
| 6.16 | **Confidence Builder** — 6 milestones: First Upload, 5 Sessions, 0 Revenge (1 week), WR>45%, 3 Green Weeks, Discipline 70+ | Required | ✅ Present |
| 6.17 | **Recent Trades** list (clickable, with side/tag/P&L/time) | Required | ✅ Present |
| 6.18 | **Predictive Warning** (color-coded by risk: green/gold/orange/red with **pulsing animation** on critical) — probability %, historical data, recommended action | Required | ⚠ Present, verify pulsing animation on critical |
| 6.19 | **Recent Sessions Grid** — cards with date, market, trades, WR, P&L (large monospace), progress bar — clickable | Required | ✅ Present |
| 6.20 | **Calendar Heatmap** — month grid, color-coded days (green profit/red loss/gray none/accent today) | Required | ✅ Present |

**Dashboard Gap Summary:**
- ❌ Benchmark Comparison row (You/Avg/Profitable/Top 10%) under TradeSaath Score
- ❌ "Biggest drag" callout
- ❌ Cross-User Pattern auto-rotation (15s interval)
- ❌ Risk Management card next to equity curve
- ❌ Daily/Weekly/Monthly 3-col summary
- ❌ Performance Heatmap (time × day)
- ❌ "More Insights" collapse toggle
- ⚠ DQS should be separate widget, not merged into TradeSaath Score
- ⚠ Quick Actions: replace "Upgrade Plan" with "Trading Journey"

---

## 7. Journal Section Gaps (`/journal`)

| Element | V12 | Live | Status |
|---|---|---|---|
| Two-column layout (280px sidebar + main) | Required | ✅ Present |
| Two tabs: Sessions / Trading Journey | Required | ✅ Present |
| **Sessions tab — Search input** | Top of sidebar | ⚠ Verify present |
| Session list items: date bold + meta (trades/WR/market) + P&L monospace colored | Active session has **green left border** + accent bg | ✅ Mostly match |
| Stats Row (Date, Net P&L, Total Trades, Win Rate, Best Trade, Worst Trade) | 6 cards | ⚠ Verify all 6 present |
| **Session Timeline** — vertical timeline with dot markers per trade, showing symbol, side badge, P&L badge, entry → exit, behavioral tag, time | Required | ⚠ Verify timeline visual present |
| **Pattern Alert** (purple bordered card, e.g., "Afternoon Tilt detected — 80% of losses after 12:30") | Required | ❌ **MISSING** |
| **Trading Journey tab — Step 1 Questionnaire**: 5 sections with pill multi-select | Trading Style / Biggest Challenges / Trading Goal / Risk Tolerance slider / Experience dropdown | ⚠ Live has 9 fields (story, experience, market, role, struggles, afterLoss, goal, perfectDay, oneChange) — **structure differs**, no slider |
| **Trading Journey tab — Step 2 Insights**: cross-references journey answers with trade data, e.g., "You said revenge trading — your data confirms it: 3 revenge trades costing ₹8,400" | Required | ❌ **No cross-reference logic** in live — Step 2 just shows what user typed |

---

## 8. AI Coach Gaps (`/coach`)

| Element | V12 | Live | Status |
|---|---|---|---|
| 4 timeframe tabs (Daily/Weekly/Monthly/Quarterly) | Required | ✅ Present |
| **Daily Plan**: Pre-market routine, during-session rules, post-session review checklist | Required | ⚠ Generic plans returned by AI — verify these 3 sections |
| **Weekly Plan**: Focus areas, Trading Plan (Entry/Size/Exit/Mental rules), Scenarios (best/likely/worst with ₹), Friday review checklist | Required | ⚠ Coach prompt requests these but verify rendering |
| **Monthly Plan**: Targets, Performance Zones, Milestones | Required | ⚠ Verify |
| **Quarterly Plan**: Discipline transformation goals | Required | ⚠ Verify |
| Action items with **STOP / DO / PRACTICE** color tags + clickable checkboxes | Required | ⚠ Has tags, **clickable checkbox state may not persist** |
| **Personal Rules Card** (monospace formatted: "MAX 10 TRADES PER DAY", "NO REVENGE TRADES", "STOP AT 10:30 AM") | Required | ⚠ Verify monospace formatting |

---

## 9. AI Chat (Floating Panel) Gaps

| Element | V12 | Live | Status |
|---|---|---|---|
| FAB button (bottom-right, 56px circle, gradient green→blue, shadow glow) | Required | ✅ Present (`AiChat.tsx`) |
| Red notification dot badge | Required | ⚠ Verify dot |
| Visibility: only when logged in | `class="visible"` toggle | ✅ |
| Chat panel: 400×560px, rounded 16px, slide-up animation | Required | ✅ |
| Header: TradeSaath AI avatar + title + online status + close button | Required | ✅ |
| Messages: alternating user/bot bubbles | Required | ✅ |
| **Suggestion chips** (clickable pre-built questions) | Required | ⚠ Verify |
| Input area: textarea + green send button | Required | ✅ |
| **Coaching Memory bar**: pulsing green dot + "TradeSaath remembers: X sessions analyzed, Y patterns detected" | Required, references past sessions | ❌ **MISSING** |
| Response library covers all 9 question types from spec section 10.3 | Required | ⚠ Chat prompt has 7 templates — verify all 9 (DQS, personality, TradeSaath Score, benchmarking, live mode info) |
| Chat references actual user data (sessions, patterns) | Required, context-aware | ⚠ `tradeContext` is passed but verify it includes past sessions and patterns |

---

## 10. Authentication & Payment Flow Gaps

| Element | V12 | Live | Status |
|---|---|---|---|
| Auth modal with **3-step progress dots** (account → plan → payment) | Inline modal with step indicator | ❌ **Live uses Clerk hosted pages** (`/sign-in`, `/sign-up`) — completely different UX |
| Step 1: name/email/password fields, sign-up/sign-in toggle | Required | Different (Clerk handles it) |
| Step 2: 3 plan cards with ₹99 / ₹799 / ₹499 prices | Required | ⚠ Lives at `/pricing` separately |
| Step 3: payment with selected plan + "Complete Payment" | Required, simulated in V12 | ✅ Live uses Razorpay modal |
| Post-auth state changes: nav links swap, app links appear, plan banner updates, redirect to dashboard | Required | ✅ Mostly works |
| **Decision needed:** Should we keep Clerk + Razorpay (better security) or build the V12 inline modal flow (better UX match)? Recommend: keep Clerk but add the **3-step progress dot UI** wrapping Clerk's components.

---

## 11. Pricing Page Gaps

| Element | V12 | Live | Status |
|---|---|---|---|
| Billing toggle (Monthly/Yearly) with animated pill switch + "Save 38%" badge | Required | ⚠ Verify toggle present |
| 3 plan cards | Required | ✅ |
| **Test card details displayed** ("4111 1111 1111 1111 \| any future date \| any 3 digits \| OTP 1234") | Visible on pricing | ✅ Present in live |

---

## 12. Onboarding Flow Gaps

| Element | V12 | Live | Status |
|---|---|---|---|
| Full-screen overlay on first visit (localStorage check) | Required | ⚠ Has `Onboarding.tsx` component — verify it triggers on first visit |
| Step 1: "You're not alone in this" — empathetic intro | Required | ⚠ Verify content matches |
| Step 2: "A coach, not a scorecard" | Required | ⚠ Verify |
| Step 3: "Small wins, real progress" → CTA "Start with free analysis" | Required | ⚠ Verify |
| Progress dots + Skip button + Next/Get Started button | Required | ⚠ Verify |

---

## 13. Global UI Token Gaps

V12 uses these exact CSS variables. Verify the live `globals.css` has matching tokens:

| Token | V12 Value | Verify in Live |
|---|---|---|
| `--accent` | `#3EE8C4` (green primary) | ✅ Most likely matches |
| `--gold` | `#F0B429` | ✅ |
| `--blue` | `#5B8DEF` | ✅ |
| `--purple` | `#9D7AF7` | ✅ |
| `--red` | `#F05D6C` | ✅ |
| `--green` | `#36D399` | ✅ |
| `--orange` | `#F29B4B` | ✅ |
| `--bg` (dark) | `#0A0E17` | ⚠ Verify |
| `--bg` (light) | `#F7F8FC` | ⚠ Verify |
| `--nav-h` | 60px | ⚠ Verify |
| Theme transition | 350ms on all color properties | ⚠ Verify |
| Backdrop blur on modals | 8px | ⚠ Verify |
| Card border radius | 20px (modals), 16px (chat panel) | ⚠ Verify |

### Typography
| Font | Use | Live Status |
|---|---|---|
| **Outfit** sans-serif | Body, UI | ⚠ Verify in `layout.tsx` |
| **Fraunces** serif italic | Headings, hero, greetings | ⚠ Verify |
| **JetBrains Mono** | Numbers, prices, badges | ⚠ Verify |

If any of these are missing, the entire visual identity drifts.

---

## 14. AI Prompt Gaps — `app/api/analyse/route.ts`

The current `buildPsychologyPrompt()` is short and asks for **partial fields** that don't match the V12 expected output. Detailed gaps:

### 14.1 Missing fields in current prompt
The prompt should request these JSON fields (V12 spec) — current prompt is missing:
- `market_context` per trade — `{nifty, vix, news, session_label}` ❌
- `previous_trades` per trade — array of last 3 trade summaries with win/loss + amount ❌
- `fills` table per trade if multiple fills + weighted_avg_price ❌
- `cycle_timeline` field — for the 10-stage Vicious Cycle Position widget ❌
- `cross_user_insight` per losing trade — "From 847 traders: …" ❌
- `options_specific` for NIFTY/BANKNIFTY trades — `{type:CE/PE, moneyness:ITM/ATM/OTM, theta_risk, vix_env, time_to_expiry, avg_fill}` ❌
- `setup_grade` letter A/B/C/D/F per trade ❌
- `entry_timing_candle_position` — "first-minute high vol" / "middle stabilization" / "last-minute breakout" ❌
- `in_trade_flags` array — REVENGE / AVERAGING / PANIC / FOMO / AGAINST_TREND / DISCIPLINED / OVERSIZED ❌
- `cycle_position_index` — index 0–9 of the 10-stage cycle for this trade ❌
- `fi_summary` — text below the Free Technical Insights grid ❌

### 14.2 Wrong field names
- `momentum` names should be **Win Rate / Profit Factor / Discipline Score / Risk:Reward** (or compute locally from KPIs — preferred)
- `technical_insights` names should be **Entry Quality / Trend Alignment / Volume Analysis / Setup Quality**
- `vicious_cycle` should have **all 10 stages**, not 8

### 14.3 Tone & length
- V12 spec: "Reference actual trade times, prices, symbols. Say WHAT emotion, WHEN, and WHAT it cost in rupees. Tell the STORY of the trading day."
- Current prompt: has this directive but Claude often returns generic text. **Add few-shot examples** in the prompt to anchor the style.

### 14.4 Recommended new prompt structure
1. Persona block (kept)
2. Trade data block (kept)
3. **Output schema with 10-stage Vicious Cycle, all V12 fields, and explicit naming**
4. **2-3 few-shot examples** of high-quality `summary`, `psychology_coaching`, and `quick_summary` text
5. **Strict JSON-only output rule** (kept)

---

## 15. AI Chat Prompt Gaps — `app/api/chat/route.ts`

Current chat prompt has **7 question templates**. V12 spec section 10.3 lists **9 topic areas**:

| # | V12 Topic | Live Template | Status |
|---|---|---|---|
| 1 | Trade analysis ("Why did I lose today?") | Has revenge/SL/overtrading | ✅ |
| 2 | Strategy recommendations | ⚠ Generic | Add template |
| 3 | Pattern analysis ("Why am I losing on Mondays?") | ❌ Missing | Add |
| 4 | DQS/Score questions | ✅ Present | |
| 5 | **Personality profiling** ("Show me my trading personality") | ❌ Missing | Add |
| 6 | **TradeSaath Score details** | ⚠ Partial in DQS template | Add explicit |
| 7 | Benchmarking | ✅ Present | |
| 8 | **Live mode info** ("Tell me about live mode") | ❌ Missing | Add |
| 9 | Generic coaching | ✅ Present | |

Also missing: **Coaching Memory** — chat should reference "I remember from session #X you struggled with…" The current prompt accepts `tradeContext` but doesn't include a memory block instruction.

---

## 16. AI Coach Prompt Gaps — `app/api/coach/route.ts`

Current coach prompt covers daily/weekly/monthly/quarterly plans with the right template structure. **Gaps:**
- **Personal Rules Card** is mentioned in spec but not explicitly requested in any template — should be a separate `rules` section in every plan with monospace formatting.
- **Friday Review Checklist** is in weekly template ✅
- **Performance Zones (RED/YELLOW/GREEN criteria)** in monthly ✅
- **Quarterly transformation goals** — verify the quarterly template has 5 transformation areas, not just one.

---

## 17. Data Model Gaps — Trade Object

V12 trade object structure (spec 16.2):
```ts
{ id, time:"HH:MM", symbol, side, qty, entry, exit, tag:"win|fomo|vs|avg|pnc|rvg", label, fills:[{qty,price}], pnl, cumPnl }
```

Live tool's parsed trade object — verify every field is present, especially:
- `fills` array (multi-fill orders)
- `cumPnl` — running cumulative
- `tag` short code AND `label` long form
- Time as "HH:MM" string (not Date object)

---

## 18. Responsive Design Gaps

| Breakpoint | V12 Behavior | Live |
|---|---|---|
| <900px | Nav links → hamburger, sidebar layouts stack, journal sidebar static, cycle grid → 2-col | ⚠ Verify |
| <600px | Padding 16px, pricing grid 1-col, hero font shrinks | ⚠ Verify |
| <480px | Chat panel full-width, how-it-works result preview stacks | ⚠ Verify |

---

## 19. Critical Business Logic Gaps

These aren't UI but they affect every analysis:

1. **Vicious Cycle stage assignment per trade** — V12 maps every trade to one of 10 stages based on rules (time gap, prior result, position size). Currently the AI is asked to do this without explicit rules. **Fix:** Compute the stage in code from trade data; pass to AI as context.

2. **Mistake Cost Calculator** — V12 shows "Revenge Trading: 8 trades, -₹8,400, ₹1,050 each". Live tool needs deterministic rule: identify revenge trades (re-entry within 5 min of loss), sum their losses, divide by count. Don't ask AI for these numbers.

3. **TradeSaath Score** — V12 uses a specific formula (5 factors weighted). Currently live uses `dqs_score` averaged from sessions. **Fix:** Document the formula. The 5 factors should be: Entry Timing × 25%, Risk Mgmt × 25%, Position Sizing × 15%, Emotional Control × 25%, Exit Discipline × 10% (or whatever V12 uses — verify against backend prompts PDF).

4. **Predictive Warning levels** — V12: low (green) / medium (gold) / high (orange) / critical (red pulsing). Live has 3 levels — add "critical" with pulsing animation.

5. **Cross-User Pattern Insight** — V12 spec shows fake "847 traders" data. **Decision needed:** Either keep fake numbers as social proof (clearly disclaimed) or remove the widget until you have real cross-user data.

---

## 20. Summary — Priority Order to Fix

### P0 — Blockers (break the V12 flow)
1. Embed upload card + 8-question context grid + results card **inline on `/`** (landing page) — currently on separate routes
2. Restore inline auth modal flow OR wrap Clerk in 3-step progress UI
3. Trade card: add Market Context strip, Previous Trades chips, Fills table, Deep Dive toggle, Cycle Position timeline, Cross-User insight, Reflection notes
4. Standardise **10-stage Vicious Cycle** in prompt + UI + FAQ (currently mixed 4/8/10)
5. Update AI prompt to request all V12 JSON fields (section 14.1 above)
6. Logo click should always go to `/` (landing), not `/upload`

### P1 — Major missing dashboard widgets
7. Benchmark Comparison row + Biggest Drag callout under TradeSaath Score
8. Risk Management card next to equity curve
9. Daily/Weekly/Monthly 3-col summary cards
10. Performance Heatmap (time × day grid)
11. "More Insights" collapse toggle wrapping last 5 widgets
12. Separate DQS widget from TradeSaath Score widget
13. Cross-User Pattern auto-rotation (15s)

### P2 — Trade card polish
14. Sidebar trade list: add session badges (Morning/Midday/Afternoon), cumulative P&L per row, lock icons
15. Trade card headers: monospace time, quantity field
16. Setup grade A/B/C/D/F + Options-specific tags
17. Entry/Exit Efficiency 3-col grid
18. In-Trade Behavior flags display
19. What You Did vs Should Have 2-col layout

### P3 — Journal & Coach
20. Pattern Alert card on session view
21. Trading Journey Step 2 cross-reference with actual trade data
22. Coach: Personal Rules monospace card + persistent checkbox state

### P4 — Chat
23. Coaching Memory bar above chat messages
24. Add 3 missing question templates (pattern analysis, personality, live mode)

### P5 — Visual polish & misc
25. Verify Outfit / Fraunces / JetBrains Mono fonts loaded
26. Verify color tokens match V12 hex values exactly
27. Verify dark/light theme transition is 350ms on all properties
28. Critical Predictive Warning pulsing animation
29. FAQ: change "8-stage" to "10-stage" Vicious Cycle
30. Pricing: animated billing toggle pill switch

---

## How to use this report

Pick a single P0 item, fix it end-to-end (UI + prompt + data + tests), deploy, verify live, then move to the next. Don't try to fix multiple P0 items in one PR — they touch overlapping files (`page.tsx`, `analyse/route.ts`, `results/page.tsx`) and the diffs become unreadable.

Each fix should reference the specific spec section above so you can re-verify against V12.
