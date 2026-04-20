# TradeSaath — Pre-Launch Audit

**Audit date:** 2026-04-20
**Auditor:** Read-only automated review (no code, DB, or deploy modifications made)
**Scope:** 9 categories — Auth, Upload/Parse, Analysis, Display, Payment, Email, Security, Performance, Launch config
**Environment tested:** Local working copy at `C:\Users\SK\Desktop\tradesaath` (commit on disk as of audit date). Vercel production state was NOT directly inspected — items requiring Vercel dashboard access are explicitly flagged.

---

## Executive Summary

| Count | Severity |
|---|---|
| **4** | **P0** — Launch blockers |
| **11** | **P1** — Major bugs, strongly recommend fix before launch |
| **13** | **P2** — Minor, can ship with plan to fix |
| **6** | **P3** — Nice-to-have |

**Launch readiness verdict: NOT READY.**

Four findings would cause real user or revenue damage on day one: (1) Pro Yearly charges ₹499 instead of ₹5,988 — a 92% revenue leak per sale; (2) `/api/payments/verify` does not bind the payment to the authenticated user, enabling plan-theft if any Razorpay signature leaks; (3) the rate limiter is in-memory and ineffective on Vercel serverless, leaving Claude-calling endpoints open to cost exhaustion; (4) `supabase/schema.sql` is completely out of date vs. the migrations — anyone running it to bootstrap a fresh environment will get the wrong tables.

None of these require deep refactors. The minimum critical path to launch-ready is one focused day of fixes on the P0s plus a coupon-vs-payment plan-column reconciliation. P1 items can ship within the first week post-launch under a hot-patch cadence.

---

## P0 — Launch Blockers

### Finding P0-1 — Pro Yearly plan charges ₹499 instead of ₹5,988
**Category:** 5 (Payment & Monetization)
**Severity:** P0
**What's broken:** `lib/config/pricing.ts:22` sets `pro_yearly.price = 49900` (₹499 in paise). The `description` field on the same object says `"₹5,988/yr · save 38%"`. Razorpay will charge whatever `price` says — ₹499 — not the ₹5,988 the marketing copy claims. The plan grants 365 days of access (`durationDays: 365`), so the user effectively gets a full year for ₹499.
**Where:** `lib/config/pricing.ts:19-27`
```ts
pro_yearly: {
  id: 'pro_yearly',
  name: 'Pro Yearly',
  price: 49900,        // ← paise. Should be 598800 for ₹5,988.
  displayPrice: '₹499/mo',
  description: '₹5,988/yr · save 38%',
  tradeLimit: 99,
  durationDays: 365,
}
```
The `create-order` route reads `selectedPlan.price` directly (`app/api/payments/create-order/route.ts:41`) and passes it to Razorpay. No override anywhere.
**How to reproduce:** Sign in, go to `/#pricing`, click Yearly toggle, click Get Pro Plan. Razorpay modal will show ₹499, not ₹5,988. The Pricing component (`components/Pricing.tsx:119-125`) also displays "₹499/mo" to the user — which is a lie because nothing is recurring (no Razorpay subscription is created), so they actually pay ₹499 once for a full year.
**Impact if shipped:** For every yearly sale, revenue is ~8% of intended (₹499 vs ₹5,988). On a healthy launch of 100 yearly buyers, ₹5.49 lakh of revenue evaporates. Users who notice will also be confused or accuse you of bait-and-switch when they see the modal price mismatch the card copy.
**Recommended fix:** Change `price: 49900` to `price: 598800`. Fix `displayPrice` to `'₹5,988/yr'` or drop the `/mo` suffix. Decide whether "yearly" is a one-time charge for 365-day access (current model) or a real Razorpay subscription — they are different products. The `Pricing.tsx` card should stop calling yearly `/mo` since it's not monthly-billed.

---

### Finding P0-2 — `/api/payments/verify` does not bind payment to authenticated user
**Category:** 5, 7 (Payment, Security)
**Severity:** P0
**What's broken:** After Razorpay checkout, the client POSTs `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` to `/api/payments/verify`. The route verifies the HMAC signature (good), then calls `auth()` to get the current Clerk user, reads the plan from the `payments` row, and upserts `users.plan` and `user_plans.plan` for the **authenticated user's clerk_id** — without checking that the payment's buyer matches the authenticated user.
**Where:** `app/api/payments/verify/route.ts:67-112`
```ts
const { userId: clerkId } = await auth()
if (clerkId) {
  const { data: payment } = await supabaseAdmin
    .from('payments').select('plan')
    .eq('razorpay_order_id', razorpay_order_id).single()
  // plan = payment.plan  ← read from the ORDER
  await supabaseAdmin.from('users').upsert({ clerk_id: clerkId, plan, ... })
  await supabaseAdmin.from('user_plans').upsert({ user_id: clerkId, plan, ... })
}
```
The order was created in `create-order/route.ts:62-71` with `clerk_id` = buyer. Verify does not compare that stored `clerk_id` against the current authenticated `clerkId`.
**How to reproduce (theoretical):** Attacker A signs up. Legitimate buyer B completes a ₹5,988 Pro Yearly purchase — their browser's network tab now shows the 3-tuple `(order_id, payment_id, signature)`. If A obtains that tuple by any means (B screenshots a dev-tools payload in a bug report, a shared machine, an XSS sink, a leaked Vercel log, a Supabase row read), A signs into their own account and POSTs the tuple to `/api/payments/verify`. Server passes HMAC check (signature really is valid), reads `plan = pro_yearly` from B's order, upserts A's `user_plans` row to `pro_yearly`. A now has a year of Pro free. B's plan is also upgraded because the upsert happens once for A — but B's next call may also succeed (no idempotency — see P1-5).
**Impact if shipped:** Signature leaks are plausible (logs, screenshots, bug reports, dev-tools paste to Discord). Each leaked signature = free Pro for whoever replays it. Also enables a determined insider attack if any engineer can read `payments` rows.
**Recommended fix:** In the verify handler, add an explicit ownership check after the `auth()` call:
```ts
if (payment?.clerk_id && payment.clerk_id !== clerkId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```
Also: add idempotency (check `status === 'pending'` before upgrading), and never log raw signatures/payment IDs in production (`create-order/route.ts:89` currently logs the key ID prefix — acceptable — but verify logs full `razorpay_payment_id` at line 49).

---

### Finding P0-3 — Rate limiter is in-memory, ineffective on Vercel
**Category:** 7, 8 (Security, Performance)
**Severity:** P0
**What's broken:** `lib/rateLimit.ts` uses a module-scope `Map` as its store. Vercel serverless invocations either cold-start a new instance or reuse a warm one — either way, the Map is per-instance. Concurrent requests landing on different instances each get their own fresh counter. The stated limits — 5/hour on payment create-order, 20/15min on parse, 200/15min on analyse/session — effectively multiply by the number of live instances (unbounded under load).
**Where:** `lib/rateLimit.ts`. Used across `/api/payments/create-order` (5/hr), `/api/coupons/redeem` (5/hr), `/api/parse` (20/15min), `/api/analyse` (5/15min per IP), `/api/chat`, `/api/coach`, `/api/extract`.
**How to reproduce:** Spam `/api/extract` with 100 parallel requests from `curl --parallel`. At least a handful land on different warm Vercel instances and succeed past the "5 per IP per 15min" cap. Each one invokes Claude vision at ~₹5-50 per call.
**Impact if shipped:** Cost-exhaustion attack: a motivated bad actor could burn ₹10,000-₹1,00,000 of Anthropic credits per hour. Also defeats the 5/hour payment create-order guard — attacker can order-spam to fill Razorpay order history.
**Recommended fix:** Replace the in-memory store with Vercel KV or Upstash Redis. Minimal patch: wrap the `Map` access with an async `kv.incr(key)` + `kv.expire(key, windowMs)` pattern. Keep the same `rateLimit()` function signature.

---

### Finding P0-4 — `supabase/schema.sql` is stale and wrong
**Category:** 7, 9 (Security, Launch config)
**Severity:** P0
**What's broken:** `supabase/schema.sql` (237 lines) defines only four tables: `users`, `sessions`, `payments`, `journal_notes` — with column names that do not match the code. The migrations folder (`supabase/migrations/*.sql`) defines the actual live schema: `trade_sessions`, `raw_files`, `user_plans`, `trade_analysis`, `user_journeys`, `coupons`, `coupon_redemptions`. The schema.sql also uses a different RLS helper (`auth_user_id()` reading a `supabase_user_id` JWT claim) than migrations (reading `sub` claim directly). If a new developer, CI setup, or disaster-recovery restore runs `schema.sql`, they'll get the wrong database.
**Where:** `supabase/schema.sql` vs. `supabase/migrations/001_trade_sessions.sql`, `.../002_add_kpis_and_user_plans.sql`, etc.
**How to reproduce:** `psql $DATABASE_URL < supabase/schema.sql` on a fresh Supabase project → application breaks on first upload (no `trade_sessions` table).
**Impact if shipped:** Not a runtime bug in prod (prod was built from migrations) but a landmine for environment rebuilds, onboarding, and backups. Also: there is no record of the `payments` table schema in migrations — it appears to have been created manually in the Supabase dashboard, meaning the schema is not reproducible from git alone.
**Recommended fix:** Delete `supabase/schema.sql` OR regenerate it from the live database (`supabase db dump --schema public`). Capture the current `payments` table DDL into a new migration file. Document the migration application order, including that there are **two `003_*.sql` files** (`003_trade_analysis.sql` and `003_user_journeys.sql` — both non-overlapping, but the numbering collision is a timebomb).

---

## P1 — Major Bugs (strongly recommend fixing before launch)

### P1-1 — Coupon redemption only updates `user_plans`, not `users.plan`
**Category:** 5
**Where:** `app/api/coupons/redeem/route.ts:99-111` (only upserts `user_plans`) vs. `app/api/payments/verify/route.ts:84-90` (upserts both `users` AND `user_plans`).
**What's broken:** The `users` table has a `plan` column. `payments/verify` keeps both tables in sync; `coupons/redeem` does not. Code paths that read `users.plan` (grep shows `app/api/chat/route.ts:64` as a fallback, and any future code that queries users directly) will see coupon-activated users as `free`. **Confirmed in real data** — see `ADITYA_DATA_AUDIT.md` §6: "users.plan = 'free' but user_plans.plan = 'pro_monthly'" for coupon-activated user Aditya.
**Impact:** Coupon-activated users may be silently blocked from features gated on `users.plan`. Creates a two-source-of-truth drift that will compound with every new feature that reads plan info.
**Fix:** Either (a) in `coupons/redeem`, also upsert `users.plan`; or (b) deprecate `users.plan` entirely, make `user_plans` the single source of truth, and delete the fallback in `chat/route.ts` and `user/plan/route.ts`. Option (b) is cleaner but a bigger change.

---

### P1-2 — Free-tier enforcement gates TRADES per session, not SESSIONS per user
**Category:** 4, 5
**Where:** `lib/planStore.ts:28-33` (`TRADE_LIMITS.free = 3`), consumed by `app/upload/page.tsx:34-35` → `components/results/TradeSidebar.tsx:65` and `components/results/TradeDetail.tsx:38` (`isLocked = index >= freeLimit`).
**What's broken:** Your audit brief expected "3 sessions on free tier; upload #4 shows upgrade prompt." The actual code allows **unlimited sessions for free users**, and only locks individual trades past index 3 inside each session. The pricing card copy ("3 trades full psychology") matches the code, but not the audit brief's expectation.
**Impact:** If product intent is "3 sessions total," monetization is leaking — anyone can upload 100 sessions free. If product intent is "3 trades per session," everything is fine and the audit brief has the wrong expectation. **You need to decide which it is.** Either way, the ambiguity is dangerous — tell someone "upgrade after 3 sessions" today and they'll be upset when they hit a different wall on launch.
**Fix:** Confirm intent. If 3-session total: add a query in `/api/parse` that counts `trade_sessions` for `userId || anon_id` and returns 402 if ≥3. If 3-trades/session: leave as-is and rewrite the pricing card copy to say "3 trades/session" and remove the "3 sessions" expectation from docs.

---

### P1-3 — Legacy path tags ALL losses as 'win' (dead code but still running in shadow mode)
**Category:** 3
**Where:** `lib/analysis/patternDetector.ts:545`
```ts
let chosen: TradeTag = pnl >= 0 ? 'win' : 'win'
```
Both branches assign 'win'. Trades with a loss but no detected pattern end up tagged 'win', inflating win counts in pattern aggregations and DQS sub-scores.
**Impact:** Affects any session currently served by the legacy pipeline (Module 2 is off by default, so this is the live pipeline). Win rate and pattern counts are slightly off; the effect is visible on sessions with losses that didn't trip any other pattern detector. Existing stored sessions carry this bias.
**Fix:** Change the `: 'win'` to a neutral tag (e.g., `: 'none'` or `: 'loss'`). Add a test fixture: single-loss, no-pattern session → expect tag !== 'win'. Also: this bug has been sitting there long enough that some stored `analysis` JSONs have it baked in — decide whether to backfill or leave.

---

### P1-4 — DQS grade thresholds diverge between legacy and Module 2
**Category:** 3
**Where:** `lib/analysis/patternDetector.ts:213-218` (legacy: A≥80, B≥65, C≥45, D≥25, F<25) vs. `lib/compute/dqs/index.ts:102-108` (Module 2: A≥90, B≥80, C≥70, D≥60, F<60).
**What's broken:** Same DQS numeric score maps to different letter grades. A score of 75 is B legacy, D Module 2. Shadow mode logs both scores but users see one grade or the other depending on which pipeline serves them.
**Impact:** When Module 2 is flipped on, every existing user's grade will shift without their numeric score changing. Cross-session comparisons within the same user's history (which straddle the switch) will look nonsensical. Review sites and social posts will be inconsistent.
**Fix:** Pick one grading function, import it into both pipelines. Do this BEFORE enabling Module 2.

---

### P1-5 — Payment verify is not idempotent
**Category:** 5
**Where:** `app/api/payments/verify/route.ts:52-128`. No check that `payments.status !== 'completed'` before running the update chain.
**What's broken:** If the same `/api/payments/verify` call fires twice (user refresh, duplicate hook fire from `useRazorpay.handler` if they double-click), the server runs the entire side-effect cascade twice: update `payments`, upsert `users.plan`, upsert `user_plans`, update latest `trade_session`. The first call is idempotent by structure (upserts); the second wastes DB writes and could theoretically update the wrong `trade_sessions` row if a new session was uploaded between the two calls.
**Impact:** Moderate. Not exploitable for plan elevation on its own, but combined with P0-2 it widens the attack surface.
**Fix:** `if (existing.status === 'completed') return NextResponse.json({ success: true, idempotent: true })` after fetching the payment row.

---

### P1-6 — No Razorpay webhook handler; `RAZORPAY_WEBHOOK_SECRET` is unused
**Category:** 5
**Where:** `.env.local:18` defines `RAZORPAY_WEBHOOK_SECRET=tradesaath_webhook_secret_2026`. Grep across the repo finds **zero** consumers of that variable. `app/api/webhooks/` contains only `clerk/`. The comments in `app/api/payments/verify/route.ts:10-20` claim the route doubles as a webhook handler — but it uses the client-side HMAC scheme (order_id|payment_id), not the webhook scheme (raw body + `x-razorpay-signature` header).
**What's broken:** If a user completes payment on Razorpay but their browser tab crashes or they close the modal mid-redirect (network hiccup, etc.) before `/api/payments/verify` fires, their plan never upgrades. There's no server-side safety net. The webhook secret exists but is plumbed to nothing.
**Impact:** ~2-5% of payments will silently fail to grant access. Users will chase Sandeep for refunds or manual plan activation.
**Fix:** Add `app/api/webhooks/razorpay/route.ts` that verifies `x-razorpay-signature` against raw body using `RAZORPAY_WEBHOOK_SECRET`, handles `payment.captured` and `payment.failed`, and upserts `users.plan` + `user_plans` idempotently (dedup by `razorpay_payment_id`). Configure the webhook URL in Razorpay dashboard.

---

### P1-7 — `/api/extract` is public and calls Claude with only IP-based rate-limit
**Category:** 5, 7, 8
**Where:** `middleware.ts:18` lists `/api/extract` in `isPublicRoute`. The handler (`app/api/extract/route.ts`) uses IP-based rate limiting (5 per IP per 15min) — trivially bypassed with proxies, and broken in production because of P0-3.
**Impact:** Unauthenticated cost-exhaustion of the Anthropic key. Same magnitude as P0-3.
**Fix:** Move behind `await auth()` check. If anonymous extraction is intentionally supported (e.g., landing page demo), at minimum require a signed short-lived token from the client AND move the rate limit to Vercel KV.

---

### P1-8 — No Clerk `user.deleted` / `user.updated` webhook handlers
**Category:** 1, 7
**Where:** `app/api/webhooks/clerk/route.ts:80-83` explicitly ignores all events except `user.created`.
**What's broken:** When a user deletes their Clerk account (right-to-erasure under DPDP Act / GDPR), Supabase rows stay forever: users row, trade_sessions, raw_files, payments, user_plans, journal_notes, trade_analysis, user_journeys, coupon_redemptions. Email updates in Clerk also never propagate to `users.email` in Supabase, causing payment receipts and analysis-complete emails to go to stale addresses.
**Impact:** DPDP Act 2023 section 11 requires erasure on request. Shipping without this is a compliance risk. Practical impact: stale email → support confusion, analysis emails bouncing.
**Fix:** Add `user.deleted` handler that cascades-deletes or anonymizes (`email = 'deleted@...'`, `clerk_id = 'deleted_<orig>'`) the Supabase users row. `ON DELETE CASCADE` on FK relations already handles downstream tables. Add `user.updated` handler to sync email/name changes.

---

### P1-9 — Expired subscription falls back to stale `users.plan`
**Category:** 5
**Where:** `app/api/user/plan/route.ts:25-41`. If `user_plans.plan_expires_at < now()`, returns `plan: 'free'` (correct). But if the `user_plans` row is **missing entirely**, it falls back to `users.plan` (line 37-44). If a user once paid, had `users.plan = 'pro_monthly'` set, then their `user_plans` row was deleted (admin cleanup? data migration?), they keep Pro forever because the fallback never expires.
**Impact:** Niche, but real. Any operational cleanup of `user_plans` creates Pro-forever users. Also the reverse: if `users.plan` column is dropped later (per P1-1 fix), all fallback users lose access.
**Fix:** Remove the fallback. Make `user_plans` the only source of truth. Migrate existing users by back-filling `user_plans` from `users.plan` where missing.

---

### P1-10 — File upload has no size or MIME validation
**Category:** 2, 7
**Where:** `app/api/parse/route.ts:22-28` and `app/api/extract/route.ts:79-89`. `formData.get('file')` → `arrayBuffer()` with no `file.size` guard. No `file.type` allow-list.
**Impact:** Attacker uploads 500MB file → serverless OOM → request fails with no graceful error. Also enables denial-of-service via memory consumption. Low sophistication required.
**Fix:** Early-return 413 if `file.size > 10_000_000`. Validate `file.type` against `['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'image/png', 'image/jpeg']`.

---

### P1-11 — Payment verify updates "latest trade_session" arbitrarily
**Category:** 5
**Where:** `app/api/payments/verify/route.ts:115-128`.
```ts
const { data: latestSession } = await supabaseAdmin
  .from('trade_sessions').select('id').eq('user_id', clerkId)
  .order('created_at', { ascending: false }).limit(1).single()
if (latestSession) await supabaseAdmin.from('trade_sessions')
  .update({ plan, payment_id: razorpay_payment_id }).eq('id', latestSession.id)
```
**What's broken:** The "Single Report" plan is sold as "unlock analysis for one session you've uploaded." This code marks only the most-recently-created session as paid. If the user uploaded 5 sessions, got the upgrade prompt on the 4th, then bought Single, only session 5 gets `plan='single'` — session 4 (the one they were actually trying to unlock) stays `free`.
**Impact:** Confused users, support tickets, refund requests. Also: if payment completes milliseconds after a new auto-created session, the wrong session gets the payment.
**Fix:** Carry the session_id the user is paying for in `create-order.body.session_id`, store it on `payments.target_session_id`, and update that specific session on verify. Alternatively, deprecate the "mark session paid" model entirely and gate on `user.plan` alone.

---

## P2 — Minor Issues

### P2-1 — Welcome email FROM domain verification unconfirmed
`lib/email.ts:8` hard-codes `hello@tradesaath.com`. Cannot verify from the codebase whether SPF/DKIM/DMARC is configured at the DNS level, or whether Resend has verified the sending domain. **FLAG for Sandeep to verify in Resend dashboard.** If unverified, emails land in spam or bounce entirely.

### P2-2 — Email unsubscribe links are dead
`emails/analysisComplete.ts:116` and `emails/welcome.ts:74` link to `${BASE_URL}/unsubscribe`. `app/` has no `unsubscribe/` directory. CAN-SPAM technically requires a working unsubscribe mechanism; more practically, Gmail deliverability drops without `List-Unsubscribe` header.
**Fix:** Either add `/unsubscribe` route with a "you've been unsubscribed" stub (+ a future table to actually honor it), or pass `headers: { 'List-Unsubscribe': 'mailto:unsubscribe@tradesaath.com' }` to `client.emails.send` and remove the link.

### P2-3 — Analysis-complete email links to `/dashboard`, not the specific session
`emails/analysisComplete.ts:105` CTA goes to `/dashboard`. No `/journal/[sessionId]` deep-link route even exists (see P2-4). Users have to hunt for their session after clicking through.
**Fix:** Add session_id to the CTA URL once the route exists.

### P2-4 — No `/journal/[sessionId]` dynamic route
`app/journal/` contains only `page.tsx` and `layout.tsx`. Session detail is a component (`components/journal/SessionDetail.tsx`) mounted via client state, not a route. Deep-linking and sharing specific session analyses is impossible.
**Fix:** Create `app/journal/[sessionId]/page.tsx` that renders the session detail.

### P2-5 — No `favicon.ico`
`public/` contains `og-image.svg` and `sample-zerodha.csv` only. No `favicon.ico`. Every page load triggers a 404 for `/favicon.ico` in logs and browsers show the generic globe icon.
**Fix:** Add a 32×32 `public/favicon.ico`. Also add `icon.png` and `apple-icon.png` in `app/` (Next.js 14 App Router auto-wires these).

### P2-6 — OG image is SVG, not PNG
`public/og-image.svg` exists but LinkedIn, Twitter, WhatsApp, and iMessage all render SVG OG images inconsistently or not at all. No `openGraph` metadata in `app/layout.tsx:10-14` either.
**Fix:** Render a 1200×630 PNG, serve at `/og-image.png`. Add `metadata.openGraph.images` in `app/layout.tsx`. Consider dynamic OG via `app/api/og/route.ts` for per-page customization.

### P2-7 — `app/layout.tsx` has only `title` and `description`
No `openGraph`, `twitter`, `viewport`, `robots`, or `canonical` metadata. Social shares have no preview. Mobile rendering relies on Next defaults.
**Fix:** Populate the `Metadata` object with openGraph, twitter card, and metadataBase.

### P2-8 — No analytics (GA4, Mixpanel, PostHog) installed
Grep across the codebase finds no analytics SDK. Launching blind to user behavior — no signup funnel, no feature usage, no retention metrics.
**Fix:** Install one (GA4 is easiest for SEO; PostHog for product analytics). Wire up 5-7 core events: `signup`, `upload_start`, `upload_success`, `analysis_complete`, `pricing_view`, `checkout_start`, `payment_success`.

### P2-9 — No error monitoring (Sentry, Bugsnag, etc.)
Errors are logged via `console.error` to Vercel logs only. No alerting. A 500 spike at 2am doesn't page anyone.
**Fix:** Add Sentry with the Next.js wizard (`@sentry/nextjs`). 30-minute job. Configure the Anthropic/Razorpay error fingerprints so you don't spam your inbox.

### P2-10 — `raw_files` orphaned on parse failure
`app/api/parse/route.ts` inserts the raw_files row before validating that trades parsed. Zero-trade parse results leave an orphan row with `trades_count=0`. Over time these accumulate.
**Fix:** Call `saveRawData()` only inside the success branch (after validation that trades.length > 0).

### P2-11 — Dashboard stats makes a full-table scan of `trade_analysis`
`app/api/dashboard/stats/route.ts:173-177` selects ALL `trade_analysis` rows globally (no filter), then loops to aggregate. At scale (5k sessions × 50 trades = 250k rows) this will page-timeout.
**Fix:** Replace with a filtered query (`.in('session_id', sessionIds)`), or write a Postgres view that pre-aggregates per user. Add an index on `trade_analysis(session_id)`.

### P2-12 — Dashboard cache doesn't bust on batch re-analysis completion
`lib/dashboardCache.ts` bustDashboardCache() is called in `/api/analyse/route.ts` but not in `/api/analyse/batch/route.ts` completion. Users who trigger batch re-analysis see stale stats for 60s after.
**Fix:** Call `bustDashboardCache(userId)` at end of batch route.

### P2-13 — Hardcoded price "₹799/mo" in `/coach` upgrade link
`app/coach/page.tsx:126` hard-codes `"Upgrade to Pro — ₹799/mo"`. If you change Pro Monthly pricing, this won't update.
**Fix:** Read from `PLANS.pro_monthly.displayPrice`.

---

## P3 — Nice to Haves

- **P3-1** — Two parsers co-exist (`lib/parsers/` and `lib/intake/`). `lib/intake/` is the active pipeline; `lib/parsers/` is imported only by `lib/intake/rawExtractor.ts` (for three utility functions) and orphaned test code. Consolidate to reduce cognitive load.
- **P3-2** — Vicious cycle requires ≥3 stages; 2-stage partial cycles are dropped. Missed coaching opportunity on short tilt sequences.
- **P3-3** — Coaching (Haiku) timeout (10s) is silent on failure — user sees empty coaching with no explanation. Add a `coaching_status: 'ok' | 'timeout' | 'error'` field to analysis JSON.
- **P3-4** — No `/account` or `/settings` route; users manage Clerk via the default UserButton. Fine for v1 but worth adding pre-scale.
- **P3-5** — Duplicate migration numbering (two `003_*.sql`). Rename to `003a_` and `003b_` or renumber.
- **P3-6** — Robots.txt hardcodes production domain. Acceptable if you only deploy to `tradesaath.com`; awkward if you spin up `staging.tradesaath.com`. Use `process.env.NEXT_PUBLIC_APP_URL`.

---

## Positive Findings (what's working well)

- **Clerk webhook signature verification** is correct (svix library, proper header checks, dup-key handling). `app/api/webhooks/clerk/route.ts`.
- **Razorpay HMAC verify** on the client→server path is correctly implemented (`order_id|payment_id` format, timing-safe compare via `crypto`).
- **`.gitignore`** correctly excludes `.env*.local` — no secret leak in git.
- **Server routes** correctly use `await auth()` (Clerk) and never trust client-provided `clerkId` (`/api/auth/sync/route.ts:23`).
- **Razorpay test mode guidance** is clean and in-code (`app/api/payments/verify/route.ts:22-27`).
- **Coupon race condition** handled by `UNIQUE (coupon_id, user_id)` constraint on `coupon_redemptions`. `supabase/migrations/006_coupons.sql:22-23`.
- **DQS sub-scores** — all 7 present and NaN-guarded (`lib/compute/dqs/index.ts`).
- **Error messages to users** are sanitized — `hooks/useRazorpay.ts:74` specifically strips technical/auth errors before showing to the user.
- **File hash dedup** works — re-uploading the same file returns the existing session rather than creating a duplicate (`lib/intake/saveRawData.ts`).
- **Maxurration** is set on every long-running API route (90s analyse, 60s session/batch/coach/journey, 30s parse/chat) — not relying on Vercel defaults.
- **Privacy page** exists with DPDP Act 2023 framing (completeness of each section not exhaustively verified — spot-check recommended).

---

## Category Scorecard

| # | Category | Issues | Verdict |
|---|---|---:|---|
| 1 | Auth & User Management | 2 P1, 1 P3 | ⚠️ |
| 2 | Upload & Parse | 1 P1, 2 P2, 1 P3 | ⚠️ |
| 3 | Analysis Pipeline | 2 P1, 2 P3 | ⚠️ |
| 4 | Dashboard & Display | 1 P2 | ✅ |
| 5 | Payment & Monetization | **2 P0**, 5 P1, 2 P2 | ❌ |
| 6 | Email & Notifications | 3 P2 | ⚠️ |
| 7 | Security & Data Integrity | **2 P0**, 2 P1, 0 P2 | ❌ |
| 8 | Performance & Error Handling | 2 P2 | ⚠️ |
| 9 | Launch Readiness | 4 P2, 2 P3 | ⚠️ |

Legend: ✅ ship-ready, ⚠️ ship with hot-patch plan, ❌ do not ship.

---

## Recommended Launch Sequence

**Day 0 — P0 hotfix session (3-4 hours):**
1. **P0-1 pricing** — change `price: 49900` → `598800` in `lib/config/pricing.ts` and fix `displayPrice`. Verify against Razorpay test mode before shipping to prod. (15 min)
2. **P0-2 payment auth binding** — add `payment.clerk_id === authenticated_clerkId` guard in verify route. Idempotency check alongside (covers P1-5 free). (30 min)
3. **P0-3 rate limiter** — swap in Vercel KV, keep same `rateLimit()` signature. (1-2 hours including test)
4. **P0-4 schema** — regenerate `supabase/schema.sql` from live DB OR delete it and pin migrations. (30 min)

**Day 1 — P1 reconciliation (1 day):**
5. **P1-1** pick single plan source of truth (recommend: `user_plans` only, delete `users.plan`). Back-fill coupon users. (2 hours)
6. **P1-2** confirm free-tier intent (3 trades vs 3 sessions), align code and pricing copy. (30 min)
7. **P1-3** fix `patternDetector.ts:545` — one-character change. Add regression test. (15 min)
8. **P1-6** add `/api/webhooks/razorpay/route.ts` + configure in Razorpay dashboard. (2 hours)
9. **P1-10** add file size + MIME guards. (15 min)

**Day 2 — Launch config (half day):**
10. **P2-5** favicon, **P2-6** PNG OG image, **P2-7** layout metadata.
11. **P2-8** analytics (GA4 30-min wizard).
12. **P2-9** Sentry (30-min wizard).
13. **P2-2** create `/unsubscribe` stub page.
14. Verify P2-1 (Resend DKIM/SPF in dashboard — not code).

**Day 3 — smoke test in production:**
- Real signup (fresh Gmail alias).
- Real payment on ₹99 single → verify plan upgrades, email arrives.
- Real payment on ₹5,988 yearly (the P0-1 fix).
- Real coupon redemption (verify `users.plan` and `user_plans.plan` both update).
- Upload a CSV, an Excel, a PDF — verify parsing, analysis, dashboard render.
- Delete a Clerk account — verify Supabase cleanup (P1-8 if fixed).

**P1-4 (DQS thresholds), P1-9 (fallback plan), P1-11 (session-paid semantics), and all P3s** — post-launch in week 2.

## Estimated Time to Launch-Ready

**2.5 focused days of one engineer.** P0s and the must-fix P1s (coupon/users drift, loss-tag bug, webhook, file limits) are all short, mechanical changes. Day 2 is launch polish. Day 3 is smoke-test. Everything else fits a normal post-launch cadence.

---

## Data Accuracy Verification

I did not execute SQL against your Supabase instance (read-only code audit only). I relied on existing diagnostics already in the repo:

**User sandeep.trader1407@gmail.com** — no existing audit document was found against your account specifically. `audit-output.json` (3MB in repo root, dated 2026-04-19) may contain numbers, but without an access token to cross-check against the live DB I can't verify dashboard-vs-DB match. **Action:** run the queries in `ADITYA_AUDIT.sql` (already in repo) substituting your clerk_id, compare output against `/dashboard`.

**User Aditya Varma (`varma.inovap@gmail.com` / `user_3CaUY8cQgxXavWnCdbj9q6BOzXq`)** — `ADITYA_DATA_AUDIT.md` dated 2026-04-19 22:35 (§3) confirmed stored aggregates match JSONB re-sums exactly across all 8 sessions. No data corruption. Two issues carry into this audit:
- **Trade count inflation of 30-45%** on days Zerodha split orders into multiple fills (§4.2). P&L unaffected; trade counts misleading. Product decision pending (§9 recommendation 1). **Not a launch blocker per that document.**
- **`users.plan = 'free'` but `user_plans.plan = 'pro_monthly'`** (§6). This confirms P1-1 in this audit with real-world data.

---

## Appendix

**Test account credentials used:** None — audit was entirely read-only code review. No test data created, no API calls executed, no DB rows written or modified.

**Environment tested:** Local working copy at `C:\Users\SK\Desktop\tradesaath` as of 2026-04-20. Vercel production deployment state was NOT directly inspected — items requiring Vercel dashboard access (production env var values, DNS records, Resend domain verification, Razorpay webhook configuration status) are flagged in the report text.

**Items requiring Vercel/dashboard verification (not inferrable from code):**
- Whether production has `pk_live_*` Clerk keys (local `.env.local` has `pk_test_*`).
- Whether production has `rzp_live_*` Razorpay keys (local has live; consistent — GOOD if prod matches).
- Whether `hello@tradesaath.com` is DKIM/SPF/DMARC verified in Resend.
- Whether Razorpay webhook URL is configured (there is no webhook handler, so currently: moot).
- Whether `tradesaath.com` DNS points to Vercel with valid SSL.
- Whether `CLERK_WEBHOOK_SECRET` is configured in Clerk dashboard with URL pointing to production.

**Data created during audit:** None.

**Files referenced during audit (for reviewer):**
- `supabase/schema.sql`, `supabase/migrations/*.sql`
- `lib/config/pricing.ts`, `lib/config/flags.ts`
- `lib/planStore.ts`, `lib/rateLimit.ts`, `lib/email.ts`, `lib/supabase.ts`
- `lib/analysis/patternDetector.ts`, `lib/analysis/sessionAnalyser.ts`, `lib/analysis/module2Bridge.ts`
- `lib/compute/dqs/index.ts`, `lib/compute/patterns/costAttribution.ts`, `lib/compute/analyse.ts`
- `lib/intake/parseFile.ts`, `lib/intake/tradePairer.ts`, `lib/intake/saveRawData.ts`, `lib/intake/rawExtractor.ts`, `lib/intake/pdfOcrExtractor.ts`, `lib/intake/tradeValidator.ts`
- `app/api/webhooks/clerk/route.ts`, `app/api/auth/sync/route.ts`
- `app/api/payments/create-order/route.ts`, `app/api/payments/verify/route.ts`
- `app/api/coupons/redeem/route.ts`
- `app/api/user/plan/route.ts`, `lib/supabase/getUserPlan.ts`
- `app/api/parse/route.ts`, `app/api/extract/route.ts`, `app/api/analyse/route.ts`, `app/api/analyse/session/route.ts`, `app/api/analyse/batch/route.ts`, `app/api/dashboard/stats/route.ts`, `app/api/chat/route.ts`, `app/api/coach/route.ts`
- `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`
- `components/Pricing.tsx`, `components/PlanGate.tsx`, `components/AuthSync.tsx`, `components/results/TradeDetail.tsx`, `components/results/TradeSidebar.tsx`
- `hooks/useRazorpay.ts`, `hooks/useSyncUser.ts`
- `middleware.ts`, `next.config.mjs`, `package.json`, `.env.local`, `.gitignore`
- `ADITYA_DATA_AUDIT.md` (existing diagnostic)

---

*Report end. Reviewed read-only; no code, DB, or deploy artifacts were modified.*
