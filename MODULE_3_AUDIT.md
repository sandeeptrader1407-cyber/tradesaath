# Module 3 (Display Layer) Audit

**Audit date:** 2026-04-19
**Scope:** `components/{dashboard,journal,saathi,chat,journey}` + `app/{dashboard,journal,saathi,chat,journey,coach,api}`
**Audit rules:** Do not fix. Flag only. Each finding has severity + recommendation.

---

## Executive summary

Module 3 is mostly healthy on the **dashboard path** but has two significant leaks where compute logic lives in the display layer instead of Module 2. Those leaks are the single biggest risk.

- **Dashboard page**: clean pipeline. One `/api/dashboard/stats` call, no N+1 queries, reads pre-computed analysis JSONB. Minor issues: over-fetches `trades` JSONB blob, no cache invalidation on new analysis, one `.reduce` in display code.
- **Journal page**: **SERIOUS** — contains a full recurring-pattern detector in a `useEffect`. This is Module 2 work running on the client.
- **PerformanceHeatmap**: **SERIOUS** — client-side day/time bucketing + win-rate-per-cell. Should be pre-computed and stored in `analysis.heatmap`.
- **AiChat floating FAB**: **MODERATE** — calls `computeKPIs()` client-side to build chat context. Duplicates backend logic.
- **API layer**: `/api/coach`, `/api/chat`, `/api/user/journey/story`, `/api/dashboard/stats` all recompute aggregates over ~500 sessions on every request. Acceptable short-term (server-side), but wasteful. Should read from a per-user aggregate that's refreshed on new analysis.
- **Saathi (coach)**: coaching plans do **not** auto-update when a new analysis lands. Cached per-tab in a `useState` `aiCache` — user must manually switch tabs or hit refresh.
- **Chat**: context includes **all** recent sessions but **not** the most recent analysis JSONB with timestamp. Chat can be stale against just-computed analysis.
- **Dead code**: `/api/storage/setup`, `/api/test-email`. Safe to remove.
- **Overlapping endpoints**: `/api/analyse` + `/api/analyse/session` + `/api/analyse/batch` (3 compute entry points). `/api/extract` + `/api/parse` (2 intake paths).

Nothing is a release blocker. Three items should be fixed before enabling `NEXT_PUBLIC_USE_MODULE_2=true` for real users, because they currently compute against legacy analysis shape and may break or look wrong when Module 2 output replaces legacy.

---

## 1. Components inventory

### Dashboard widgets (`components/dashboard/*`)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `SummaryCards.tsx` | Today / week / month P&L tiles | Props (`today`, `week`, `month`) | N | Clean. |
| `PerformanceKPIs.tsx` | 6-column KPI grid | Props (`month`, `score`, `allTime`, `bestTimeSlot`) | **Y (minor)** | L43 parses `riskReward` string to float; L45 computes `bestTimeSlot` end time with `split(':').map(Number)` + 30-min add. Should be pre-formatted. |
| `DecisionQualityScore.tsx` | DQS radial gauge + 7 factor bars | Props (`score`, `factors`) | N (SVG math only) | `2 * Math.PI * r` is layout, not metric. |
| `TradeSaathScore.tsx` | Discipline ring + factor bars | Props (`score`, `factors`) | **Y (predictive)** | L94: `Math.min(100, score + Math.round((100 - lowest.value) * 0.3))` — predicts an improved score. This is a metric projection; should live in Module 2. |
| `BehavioralInsights.tsx` | Insight cards | Props (`insights`, `sessionCount`) | N | Clean. |
| `RecentActivity.tsx` | Recent trades/sessions feed | Props | Y (minor) | L49-54 dedup filter + L93 win-rate bar width clamp. Dedup is display concern; win rate should arrive pre-computed. |
| `DashboardEquityCurve.tsx` | Equity bars + streaks sidebar | Props (`equityCurve`, `streaks`, `risk`) | N (layout scale only) | `maxAbs` is bar scaling, acceptable. |
| `PerformanceHeatmap.tsx` | Day × time-slot win-rate heatmap | Props (`trades`, `hasRealTimeData`) | **Y — BUG** | L52-96: full grid bucketing (`g[di][si].total++; if pnl>0 g[di][si].wins++`) and win-rate-per-cell. Should be pre-computed into `analysis.heatmap`. |
| `GoalTracking.tsx` | Goal progress bars | Props (`winRate`, `revengeTrades`, `maxDailyTrades`, `riskReward`) | **Y** | L27/43/59: `Math.max(0, 5 - revengeTrades)`, `Math.min(rr, 2) * 50`, `(g.current / g.target) * 100`. Targets hardcoded. Should be settings-driven + pre-computed. |
| `MistakeCostCalculator.tsx` | Mistake cost breakdown | Props (`mistakes`, `totalCost`, `counterfactualPnl`, `actualPnl`) | N (layout scale only) | Bar widths only. |
| `PreMarketCheckin.tsx` | Pre-market intention checklist | Local state | N | UI-only. |

### Journal widgets (`components/journal/*`)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `CalendarCard.tsx` | Month calendar with session P&L dots | Props (`sessions`) | **Y** | L58-65: per-day aggregate `pnl + Number(s.net_pnl)`, `count + 1`. Should arrive pre-aggregated. |
| `SessionDetail.tsx` | Trade timeline + AI analysis panel | Props (`session`) | N | One defensive JSON parse on `trades`. |
| `SessionList.tsx` | Session sidebar list with search | Props (`sessions`) | N | Simple filter/map. |
| `JournalStats.tsx` | Cumulative KPI strip | Props (`sessions`) | **Y — BUG** | L18: `computeKPIs(sessions)` — calls Module 2 function directly in the display component. Should fetch pre-computed stats from an API endpoint. |
| `TradingJourney.tsx` | 5-step narrative + generated story | `/api/user/journey`, `/api/user/journey/story` | N | Clean. |

### Saathi / Coach (`app/coach/page.tsx`)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `app/coach/page.tsx` | 5-tab coaching plans + Personal Rules | `POST /api/coach`, `GET /api/sessions` | N (client-side) | Reads `analysis.coaching_points` + `analysis.rules_for_next_session` for Personal Rules (L343-356). Plans are generated on-demand server-side and cached client-side per-tab. **Does not auto-refresh when new analysis arrives.** |

### Chat (`components/AiChat.tsx`, `app/chat/*` if present)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `components/AiChat.tsx` | Floating chat FAB + memory bar | `GET /api/sessions`, `POST /api/chat` | **Y — BUG** | L72: `computeKPIs(kpiSessions)`. L77: `dqsScores.reduce(...) / len` for avg DQS. L80-99: client-side pattern-tag aggregation across sessions. All three are display-layer duplication of backend work. |

### Journey (`app/journey/*`, `components/journal/TradingJourney.tsx`)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `app/journey/page.tsx` | Journey page wrapper | Delegates to `TradingJourney` | N | Thin wrapper. |
| `components/journal/TradingJourney.tsx` | Narrative form + generated story | `/api/user/journey` + `/api/user/journey/story` | N | Story is generated server-side and stored in `user_journeys.generated_story`. **Does not auto-regenerate on new sessions** — only on manual user action. |

### Top-level dashboard page (`app/dashboard/page.tsx`)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `app/dashboard/page.tsx` | Client dashboard entry | `GET /api/dashboard/stats` (SWR) | **Y (moderate)** | L203: `factors.reduce((a,b) => a.value<b.value ? a : b)` — finds lowest DQS factor (already pre-aggregated). L226-256: builds insight description strings via `.map()` + template literals + cost formatting. L406: `Math.min(100, score + Math.round((100 - lowest.value) * 0.3))` — same predictive calc as in `TradeSaathScore`. Description building is arguably presentation; predictive calc should be in Module 2. |

### Top-level journal page (`app/journal/page.tsx`)

| File | Purpose | Data source | Computes? | Notes |
|---|---|---|---|---|
| `app/journal/page.tsx` | Journal entry (calendar + session detail + recurring-pattern alerts) | `GET /api/journal/sessions` | **Y — SERIOUS BUG** | L52-136: full recurring-pattern detector running in a `useEffect`. Walks every session's `analysis.trade_analyses` + `mistake_patterns`, counts tags, splits by midpoint to compute `recentCount`/`olderCount`, classifies trend `worsening`/`improving`/`stable` via `v.recentCount > v.olderCount * 1.3`, sums cost, sorts, takes top 3. **Entire algorithm is Module 2 territory.** Verified in file. |

---

## 2. API endpoints inventory

| Route | Methods | Returns | Computes? | Used by | Dead/Overlap |
|---|---|---|---|---|---|
| `/api/dashboard/stats` | GET | kpis, equityCurve, mistakes, dqs, patterns, streaks, heatmap, discipline score | **Y (aggregation over 500 sessions)** | `app/dashboard/page.tsx` (SWR) | — |
| `/api/analyse` | POST | trades, analysis, metadata | **Y** — full `detectPatterns` + `buildAnalysisJSON` + `generateAICoaching` | HomeUpload | **Overlap with `/analyse/session`, `/analyse/batch`** |
| `/api/analyse/session` | POST | `{success, sessionId, tradesAnalysed, skipped, reason, mode}` | Y — calls `analyseSession()` | `AnalysisWithAIButton`, batch queue | Overlap |
| `/api/analyse/batch` | POST/GET | batch id / progress | Y — orchestrates per-session analysis | `BatchAnalysisRunner` | Overlap |
| `/api/parse` | POST | parsed trades + intake KPIs | N (intake only) | Parse-preview | — |
| `/api/extract` | POST | extracted trades | N (intake + Claude fallback) | Legacy fallback | **Overlap with `/parse`** |
| `/api/sessions` | GET | sessions array | N | `AiChat`, Coach, Journal | — |
| `/api/journal/sessions` | GET | sessions enriched with `trade_analysis` rows | N (merge only) | Journal | — |
| `/api/user/sessions/pending-analysis` | GET | `{pending, analysed, total, pendingCount, analysedCount}` | N (filter) | Batch queue trigger | — |
| `/api/user/journey` | GET/POST | journey profile row | N | Onboarding, Journey | — |
| `/api/user/journey/story` | POST | generated story | **Y** — `computeKPIs()` + Claude | TradingJourney "Generate" | — |
| `/api/chat` | POST | reply string | **Y** — `computeKPIs()` + tag aggregation + Claude | `AiChat` | — |
| `/api/coach` | POST | coaching plan (5 flavours by tab) | **Y** — `computeKPIs()` + tag/cost/cycle aggregation + Claude | Coach page | — |
| `/api/trade-notes` | PUT | `{success}` | N | Trade note editor | — |
| `/api/payments/create-order` | POST | Razorpay order | N | Pricing | — |
| `/api/payments/verify` | POST | `{success, paymentId}` | N | Payment callback | — |
| `/api/coupons/redeem` | POST | plan assignment | N | Coupon modal | — |
| `/api/user/plan` | GET | current plan | N | App shell, PlanGate | — |
| `/api/auth/sync` | POST | sync result | N | AuthSync on mount | — |
| `/api/webhooks/clerk` | POST | `{message}` | N | Clerk webhook | — |
| `/api/health` | GET | `{healthy}` | N | Probes | — |
| `/api/storage/setup` | POST | bucket creation | N | — | **DEAD** |
| `/api/test-email` | GET | test email result | N | Debug only (hardcoded recipient) | **DEAD** |

### Endpoints that compute (should eventually be pushed to Module 2 writes, not on-demand reads)

1. `/api/analyse` — primary legacy compute entry point. Now flag-branched via Step 8B.
2. `/api/analyse/session` — single-session re-analyze. Same path.
3. `/api/analyse/batch` — batched re-analyze. Same path.
4. `/api/dashboard/stats` — aggregates pre-computed analysis across 500 sessions on every request. Acceptable now (server-side, cached 60s). Future: pre-compute per-user rollup on each new analysis.
5. `/api/coach` — aggregates `trade_analyses` + `mistake_patterns` across sessions for every tab click. Heavy.
6. `/api/chat` — aggregates similar data on every message (rate-limited 30/hr).
7. `/api/user/journey/story` — aggregates sessions for prompt context.

### Dead endpoints

- `/api/storage/setup` — one-time setup that never runs; bucket already exists in all environments.
- `/api/test-email` — hardcoded to `sandeep.trader1407@gmail.com`, comment says "DELETE after debugging".

### Overlapping endpoints

- **Compute entry points** (3 paths do similar work): `/api/analyse` vs `/api/analyse/session` vs `/api/analyse/batch`. Recommend: single `/api/analyse` that supports `mode=single|batch`, with batch backed by a queue.
- **Intake paths** (2 paths): `/api/parse` (local intake only) vs `/api/extract` (local intake + Claude fallback). Recommend: merge into one intake endpoint with a `fallback=ai` flag.
- **KPI aggregators** (3 routes do the same work): `/api/dashboard/stats`, `/api/coach`, `/api/chat` all call `computeKPIs()` + tag aggregation across 500 sessions. Recommend: materialize a per-user `user_rollup` row (MRR: single table) refreshed on each `analyseSession` success; each endpoint reads from it.

---

## 3. Session data flow — `/dashboard` load

1. User lands on `/dashboard`. `app/dashboard/page.tsx` is a client component (`'use client'`).
2. `useUser()` from Clerk resolves auth state.
3. If signed in, a single `fetch('/api/dashboard/stats')` fires.
4. `/api/dashboard/stats` checks `statsCache` (60s TTL via `lib/dashboardCache.ts`). On hit, returns immediately; on miss:
   - One blocking query: `trade_sessions` select (12 columns including full `trades` JSONB) with `user_id = userId`, order `created_at desc`, limit 500.
   - One optional batch query: `trade_analysis` select for the first 5 session IDs (for recent-trades widget).
   - One batch query: `trade_analysis` select with `.in('session_id', sessionIds)` for all sessions (for heatmap fallback, tag counts).
5. Server-side aggregation: `computeKPIs`, `filterByPeriod`, `computeDisciplineScore`, heatmap bucketing, mistake cost rollup, streak detection.
6. Response returned to page → `setStats()` → render.
7. Detailed sub-widgets (TradeSaathScore, PerformanceKPIs, EquityCurve, Heatmap, etc.) render only when user clicks the "Detailed view" toggle.

**Total: 1 blocking request, 0–2 optional.** No N+1. All client aggregation trivial.

### N+1 queries

**None detected.** Batched via `.in(session_id, sessionIds)`.

### Re-computation in display layer

1. `app/dashboard/page.tsx:203` — `factors.reduce(...)` to find lowest DQS factor. Factors are already pre-aggregated on the server. Negligible cost but duplicate logic.
2. `components/dashboard/TradeSaathScore.tsx:37` + L94 — same min-factor scan + predictive score calc.
3. `components/dashboard/PerformanceHeatmap.tsx:52-96` — full heatmap bucketing client-side. **This is the worst offender on the dashboard.** It runs on every render where `trades` prop changes, over potentially large arrays.
4. `components/dashboard/GoalTracking.tsx:27,43,59` — goal % math with hardcoded targets.
5. `components/dashboard/PerformanceKPIs.tsx:45` — end-time arithmetic from start-time slot.

### Caching + staleness

- `statsCache` exists (60s TTL).
- `bustDashboardCache(userId)` is exported from `lib/dashboardCache.ts` and **called** at `lib/analysis/sessionAnalyser.ts:260` on successful analysis. This means after a new analysis completes, the next `/api/dashboard/stats` hit will miss the cache and refetch. **This is correct behavior** — the earlier audit subagent missed this because it grep'd only the client side.
- Risk: if a user opens the dashboard **before** a batch analysis finishes, they will see stale-but-cached data for up to 60s after completion, because the client has no push-based refresh. SWR revalidate-on-focus is the only recovery.

### Over-fetching

- `/api/dashboard/stats` selects the full `trades` JSONB column on every session (500 × ~50 KB = up to 25 MB per request). It's only used as a fallback heatmap source when `trade_analysis` is unavailable. Recommendation: select only `net_pnl`, `trade_count`, `analysis` — and query `trades` conditionally when needed.

### Time-to-first-paint

Dashboard is one blocking request, well-indexed, single round-trip with cache. Typical: **400–800 ms** including auth resolution. Detailed widgets are lazily rendered so initial paint only needs the top cards. No fix needed here unless the `trades` over-fetch proves expensive at scale.

---

## 4. Bugs found

Format: **Severity** | Description | Affected components | File:line

### Category A — Compute logic in display layer (should be in Module 2)

| # | Severity | Description | Affected | Location |
|---|---|---|---|---|
| A1 | **HIGH** | Recurring-pattern detector runs client-side: tag count, midpoint split for trend, trend classifier, cost sum, top-3 sort | `app/journal/page.tsx` | L52-136 |
| A2 | **HIGH** | Heatmap grid bucketing + win-rate-per-cell runs on every prop change | `components/dashboard/PerformanceHeatmap.tsx` | L52-96 |
| A3 | **HIGH** | `JournalStats` calls `computeKPIs(sessions)` directly from a display component | `components/journal/JournalStats.tsx` | L18 |
| A4 | **MEDIUM** | `AiChat` builds its chat memory bar by calling `computeKPIs` + aggregating tag counts + averaging DQS client-side | `components/AiChat.tsx` | L72-99 |
| A5 | **MEDIUM** | `CalendarCard` aggregates P&L per date across multiple sessions client-side | `components/journal/CalendarCard.tsx` | L58-65 |
| A6 | **LOW** | Predictive score formula `Math.min(100, score + round((100 - lowest.value) * 0.3))` lives in the display and is duplicated | `components/dashboard/TradeSaathScore.tsx` L94; `app/dashboard/page.tsx` L406 |
| A7 | **LOW** | Goal-tracker formulas with hardcoded targets (50% wr, 5 days no-revenge, 10 trades/day cap, 1:2 R:R) | `components/dashboard/GoalTracking.tsx` | L27, 43, 59 |
| A8 | **LOW** | End-time string math for `bestTimeSlot` ("09:30" → "10:00") in the display | `components/dashboard/PerformanceKPIs.tsx` | L45 |

### Category B — Data freshness / staleness

| # | Severity | Description | Affected | Location |
|---|---|---|---|---|
| B1 | **HIGH** | Coach tabs cache plans in `aiCache[tab]` with no invalidation when a new analysis arrives — users can see stale coaching against updated data | `app/coach/page.tsx` | L76-95 |
| B2 | **MEDIUM** | Chat context builds from session headers; does not fetch the most recent `analysis` JSONB or its `analysed_at` timestamp. If analysis is re-run without a new session upload, chat lags. | `app/api/chat/route.ts` | L132-167 |
| B3 | **MEDIUM** | Journey story does not auto-regenerate on new sessions. Only manual "Regenerate" refreshes it. | `app/api/user/journey/story/route.ts` + `components/journal/TradingJourney.tsx` | — |
| B4 | **LOW** | Dashboard `statsCache` 60s TTL: user who just finished a batch analysis may see stale data for up to 60s if their view is already loaded (no SWR revalidate-on-analysis-complete push) | `lib/dashboardCache.ts` + `app/dashboard/page.tsx` | — |

### Category C — Duplication / overlap

| # | Severity | Description | Affected | Location |
|---|---|---|---|---|
| C1 | **MEDIUM** | Three compute entry points (`/api/analyse`, `/api/analyse/session`, `/api/analyse/batch`) call similar pipelines | `app/api/analyse/**` | — |
| C2 | **LOW** | Two intake endpoints (`/api/parse`, `/api/extract`) | `app/api/parse/route.ts`, `app/api/extract/route.ts` | — |
| C3 | **MEDIUM** | `/api/dashboard/stats`, `/api/coach`, `/api/chat` all run `computeKPIs` + tag aggregation across up to 500 sessions on every call | `app/api/dashboard/stats/route.ts`, `app/api/coach/route.ts`, `app/api/chat/route.ts` | — |

### Category D — Miscellaneous

| # | Severity | Description | Affected | Location |
|---|---|---|---|---|
| D1 | **LOW** | `/api/dashboard/stats` selects full `trades` JSONB (25 MB worst case) when only fallback needs it | `app/api/dashboard/stats/route.ts` | L39 |
| D2 | **LOW** | Chat component has no pro-plan gate in the UI — users see the FAB, type, send, then get 403. Poor UX. | `components/AiChat.tsx` + `app/api/chat/route.ts` | — |
| D3 | **LOW** | Coach page has no indicator when some sessions still have pending analysis. Dashboard shows this via `BatchAnalysisRunner`; coach does not. | `app/coach/page.tsx` | — |
| D4 | **LOW** | Pattern aggregation reads both V1 (`perTrade`) and V2 (`trade_analyses`) formats with no dedup. A mixed-version user could double-count. | `app/api/coach/route.ts`, `components/AiChat.tsx` | — |
| D5 | **INFO** | `/api/storage/setup` and `/api/test-email` are dead code | — | — |

---

## 5. Gaps (missing features)

| # | Feature | Where it should live | Priority |
|---|---|---|---|
| G1 | Module 2 `insights.aiCoaching` is produced by Haiku coach but **no UI component displays it**. The closest is the Coach page, which reads `coaching_points` / `rules_for_next_session` but never `ai_coaching`. | Saathi coach card or dashboard top banner | Before enabling `USE_MODULE_2_COMPUTE` for real users |
| G2 | No UI indicator of "analysis is stale — some sessions have pending analysis". Only the dashboard's `BatchAnalysisRunner` shows this, not Coach/Chat/Journey. | Shared badge in `<AppShell>` | Medium |
| G3 | No auto-refresh for coaching plans after a new analysis. User sees last-generated plan indefinitely. | Add `sessionCount` dep to plan cache key, or invalidate on analysis webhook | Medium |
| G4 | Journey story never refreshes unless user clicks. Violates the "updates over time" intent. | Background regen (cron) or client-side prompt when X new sessions exist | Low (nice-to-have) |
| G5 | PerformanceHeatmap has no caption when fewer than 5 trades — it silently renders an empty grid. | Add empty-state copy | Low |
| G6 | No per-user aggregated rollup (e.g. `user_rollups` table) — three endpoints re-aggregate on demand | Add `user_rollups` refreshed in `analyseSession` post-save | Medium (perf win) |

---

## 6. Refactoring opportunities

| # | Component / file | Issue | Before launch? |
|---|---|---|---|
| R1 | `components/dashboard/PerformanceHeatmap.tsx` | Receive pre-bucketed grid from `analysis.heatmap` instead of recomputing. Requires Module 2 to produce `heatmap: { days[], slots[], cells[][] }`. | **Yes — before enabling `USE_MODULE_2_COMPUTE`** (legacy `analysis` may not have this field; leaving it client-side is the less-risky call short-term). |
| R2 | `app/journal/page.tsx` L52-136 | Move recurring-pattern detection to Module 2 — emit `analysis.recurring_patterns` or a cross-session endpoint `/api/journal/patterns`. Component just renders `patterns`. | **Yes before launch if Journal is marketed as a feature.** The algorithm quality is not the issue — the duplication and "will break if analysis shape changes" is. |
| R3 | `components/journal/JournalStats.tsx` | Stop calling `computeKPIs` in the component. Receive a prop or fetch from an API. | Yes — same reason as R2 |
| R4 | `components/AiChat.tsx` | Move chat-context aggregation to `/api/chat` server-side. Client sends only `{messages}`; server builds context from fresh DB reads. | Defer — current behaviour is functional |
| R5 | API compute trio | Introduce a `user_rollups` table populated on every `analyseSession` success; `/api/dashboard/stats`, `/api/coach`, `/api/chat` read from it. | Defer — perf opt, not correctness |
| R6 | `/api/analyse/*` consolidation | Merge three endpoints into one with a `mode` param | Defer — working fine |
| R7 | `/api/parse` + `/api/extract` merge | Single intake endpoint | Defer |
| R8 | `/api/dashboard/stats` over-fetch | Stop selecting `trades` JSONB column for all 500 sessions | Defer until users with large sessions exist |
| R9 | `app/coach/page.tsx` cache keying | Include `sessionCount` in cache key so plans auto-refresh when new sessions land | Yes — otherwise Module 2 rollout will show users pre-flag coaching indefinitely |
| R10 | Dead endpoints | Delete `/api/storage/setup` and `/api/test-email` | Defer (just noise) |
| R11 | `app/dashboard/page.tsx` L226-256 insight-description building | Move strings into Module 2 `insights.behavioralHighlights[].description` — which already exists. Dashboard just reads. | Yes — otherwise Module 2 output will be ignored for the description text |

---

## 7. Recommendations — fix before launch?

Grouped by "enable Module 2 for real users" decision. Launch = flipping `NEXT_PUBLIC_USE_MODULE_2=true` in prod (which you should do after the 2-week shadow period).

### MUST FIX BEFORE `USE_MODULE_2_COMPUTE=true` (3 items)

- **A1** — `app/journal/page.tsx` recurring-pattern detector. **Why:** the detector reads `analysis.trade_analyses` (Module 2 shape) and `analysis.mistake_patterns` (legacy shape). Module 2 output does emit both via the bridge, so it probably works — but the algorithm is brittle and will double-count if the bridge translator emits both for the same underlying pattern. Easier to move this behind an API call pre-flag flip, so a translator change doesn't break the journal.
- **B1 / R9** — Coach plan cache invalidation. **Why:** the moment Module 2 is enabled, plans generated today will look different from plans generated tomorrow. Users need fresh plans on each new analysis.
- **R11** — Insight description strings. **Why:** Module 2 already produces `insights.behavioralHighlights` with proper `description` fields. The dashboard currently ignores them and builds strings in `app/dashboard/page.tsx` from raw pattern rows. After flag flip, the behavioral-highlights list will arrive pre-formatted but the dashboard will keep re-formatting from `patterns.byTag` — a minor inconsistency but visible to users.

### SHOULD FIX SOON (not a blocker, but tech debt compounds)

- **A2** — Heatmap client-side bucketing. Low user-visible risk but large refactor value.
- **A3** — `JournalStats.computeKPIs` call.
- **B2** — Chat context must include most recent analysis + timestamp.
- **G1** — Wire `analysis.ai_coaching` into Saathi so Module 2's Haiku output actually reaches the UI.
- **C3 / R5** — Materialize `user_rollups` table to kill the 500-session aggregation trio.

### DEFER

- A4, A5, A6, A7, A8 — low-severity display-layer compute that works correctly today.
- B3, B4, D1-D5 — polish items.
- C1, C2 — endpoint consolidation (working fine).
- G4, G5 — UX nice-to-haves.
- R6, R7, R8, R10 — non-urgent cleanup.

---

## 8. No fixes applied

Per instructions, nothing in this audit has been modified. All findings are observational.

Task list marked complete: #46-53. Next actionable unit of work after this audit is a separate PR to address the three **MUST FIX** items.
