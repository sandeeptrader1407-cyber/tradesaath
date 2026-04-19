# Aditya — Data Accuracy Audit

**Status:** Complete (diagnostic only, no fixes applied)
**User:** Aditya Varma — `varma.inovap@gmail.com` — `user_3CaUY8cQgxXavWnCdbj9q6BOzXq`
**Signed up:** 2026-04-19 18:27 IST
**Current plan:** `pro_monthly` in `user_plans` (expires 2026-07-18), but `users.plan = 'free'` — see §7.

---

## 1. Headline finding

**The stored database numbers are internally consistent — but the trade counts are inflated ~30–40% because Zerodha-split order fills are kept as separate "trades" in our system.**

- Net P&L, gross P&L: **correct** (they sum the fills, which is mathematically the real net).
- Trade count, win count, loss count: **inflated** — one logical order that Zerodha fills in 4 lots becomes 4 trades in our dashboard.
- No data was corrupted by the merge/dedup path. No session was rewritten. No migration failure.

So when Aditya says "data was right, now wrong" — he's likely reacting to **trade counts and win/loss tallies being higher than he expects**, not wrong P&L totals.

---

## 2. Data inventory

| Item | Value |
|---|---|
| users row | 1 (id `b4f99a5d-8a9a-4254-970b-924e0a7a44a0`) |
| raw_files rows | **0** |
| trade_sessions rows | 8 (dates 2026-03-20 → 2026-04-07) |
| payments rows | 0 |
| user_plans row | 1 (plan=`pro_monthly`, expires 2026-07-18) |
| `raw_file_id` on sessions | NULL on all 8 (Module 1 raw-first flow was bypassed) |
| `was_rewritten_after_insert` | **false on all 8** — nothing got merged/recomputed |

All 8 sessions were created within ~10 seconds of each other on 2026-04-19 at 18:32 IST. This looks like a single multi-day upload that produced 8 session rows — not multiple re-uploads merging into the same row.

---

## 3. Integrity: stored aggregates vs JSONB re-sum

For every session, `trade_count`, `net_pnl`, `win_count`, `loss_count` (stored) match a re-sum from the `trades` JSONB **exactly**.

| Date | trades | stored net_pnl | jsonb net_pnl | count_ok | pnl_ok | wins_ok | losses_ok | was_rewritten |
|---|---:|---:|---:|:-:|:-:|:-:|:-:|:-:|
| 2026-04-07 | 2 | -1,716 | -1,716 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-04-02 | 7 | -11,539 | -11,539 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-04-01 | 2 | 4,457 | 4,457 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-03-30 | 113 | -38,734.50 | -38,734.50 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-03-27 | 13 | -49,048 | -49,048 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-03-25 | 35 | 55,812 | 55,812 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-03-23 | 61 | 57,690.50 | 57,690.50 | ✅ | ✅ | ✅ | ✅ | — |
| 2026-03-20 | 34 | 40,885 | 40,885 | ✅ | ✅ | ✅ | ✅ | — |

**No corruption, no drift, no rewrite.** The numbers on screen == what we computed at insert time.

---

## 4. The "duplicates" — what's really going on

The audit flagged duplicate trade rows (same symbol/qty/entry/exit/time/pnl) in 5 of 8 sessions. Digging into the raw JSONB:

### 4.1 Example: 2026-03-23 — NIFTY2632422700CE, 4× "duplicate" trade

```
[9]  trade_id=1763905  sourceRows=[56, 62]  entry 09:53 exit 12:26  qty 65  entry 187.25 → 130.05  pnl -3718
[10] trade_id=1763906  sourceRows=[57, 63]  entry 09:53 exit 12:26  qty 65  entry 187.25 → 130.05  pnl -3718
[11] trade_id=1763907  sourceRows=[58, 63]  entry 09:53 exit 12:26  qty 65  entry 187.25 → 130.05  pnl -3718
[12] trade_id=1763908  sourceRows=[59, 63]  entry 09:53 exit 12:26  qty 65  entry 187.25 → 130.05  pnl -3718
```

These rows share every visible field **except** `trade_id` and `sourceRows`. Zerodha assigned 4 distinct trade_ids (1763905–1763908) and 4 distinct raw source rows. Reality:

- Aditya placed one BUY market order for ~260 qty of `NIFTY2632422700CE` at 09:53.
- Zerodha filled it in 4 child executions of 65 qty each (rows 56/57/58/59).
- He later sold 260 qty, filled in 2 child executions at rows 62/63.
- FIFO pairer at `lib/intake/tradePairer.ts` pairs each BUY fill to a SELL fill → 4 output rows.

These are **real, distinct broker fills, not software duplicates**. Our pairer is doing what it was designed to do. But the UI presents them as "4 separate trades" when Aditya only made **one trading decision**.

### 4.2 Per-session impact

| Date | Stored trade_count | Unique (by symbol/qty/price/time/pnl) | Inflated by |
|---|---:|---:|---:|
| 2026-03-30 | 113 | 78 | **+35 rows (+45%)** |
| 2026-03-23 | 61 | 44 | +17 rows (+39%) |
| 2026-03-27 | 13 | 10 | +3 rows |
| 2026-03-20 | 34 | 31 | +3 rows |
| 2026-03-25 | 35 | 34 | +1 row |

P&L is unaffected — summing fill-level P&Ls gives the same net as summing order-level P&Ls. But `trade_count`, `win_count`, `loss_count`, and by extension `win_rate` are all inflated.

### 4.3 What Aditya probably sees on the dashboard

- Net P&L on 2026-03-30: `-₹38,734.50` — **correct**.
- Trade count on 2026-03-30: `113` — really `~78 decisions`.
- Win rate: the stored 55/(55+58) ≈ 48.7% is close to the real rate if fills balance, but not exact.
- If he compares our totals against Zerodha's own "Orders" tab (which shows one row per order), our counts look much higher → "data is wrong".

---

## 5. Secondary finding: `raw_files` is empty for Aditya

All 8 sessions have `raw_file_id = NULL`. `raw_files` table has zero rows for this user. This means the Module 1 raw-first intake path was not exercised for his upload — we only stored the parsed session, not the original file/raw_data JSONB.

Implications:
- Can't re-parse his file with a fixed parser without asking him to re-upload.
- No `file_hash` dedup possible across re-uploads.
- No ability to diff stored trades against the raw CSV/PDF in Supabase.

This is a **separate gap** from the count-inflation issue — flagging for later, not for the live launch.

---

## 6. Secondary finding: `users.plan` out of sync with `user_plans.plan`

- `users.plan = 'free'`
- `user_plans.plan = 'pro_monthly'` (active, expires 2026-07-18)
- `payments` rows = 0 (plan was granted, possibly via coupon or manual activation — no Razorpay payment recorded)

Dashboard plan-gating that reads `users.plan` would show Aditya as free; gating that reads `user_plans` would show him as pro. Worth confirming which column the paywall actually reads.

---

## 7. Root cause category

**B — but not a dedup bug. A pairer-design behavior: 1 output row per (buy_fill, sell_fill) pair.**

- Not A (merge rewrote aggregates) — `was_rewritten = false` on every session.
- Not C (parse regression) — only one parser_version was used, data is internally consistent.
- Not D (timezone drift) — `session.trade_date = first_trade.date` on all 8.
- Not E (field mapping) — sample trades have plausible values for every field.
- Not F (dashboard reading wrong column) — pre-computed totals match JSONB re-sum.
- Not G — explained.

The dedup function at `lib/intake/tradePairer.ts:16-42` prefers `trade_id` when available. Because each Zerodha child fill has its own `trade_id`, the dedup (correctly, for its contract) treats them as distinct. The question is not whether dedup is broken — it's whether the product should **collapse fills that belong to one parent order into one logical "trade"**.

---

## 8. Severity

- **Data integrity:** clean. No fixes required on existing rows.
- **Net P&L shown:** correct.
- **Trade count / win count / loss count / win rate:** misleading when Zerodha splits orders into multiple fills. Magnitude: up to +45% on heavy-fill days.
- **Blocks live launch?** No. Pre-existing behavior. Every multi-day trader whose broker splits fills has the same pattern.

---

## 9. Recommended next steps (ordered by effort)

No code changes made. Options for later:

1. **Add a "logical trade" rollup**: collapse fills sharing `(symbol, entry_time, exit_time, side)` into one aggregated row for display purposes only. Keep raw fills in the JSONB, derive aggregated view in the read path. Preserves data, fixes presentation.
2. **Backfill `raw_files` for Aditya**: ask him to re-upload his file so we have the raw CSV/PDF in Supabase. Otherwise we can't retroactively inspect what Zerodha sent.
3. **Reconcile `users.plan` vs `user_plans.plan`**: decide which is the source of truth and fix the other, or remove `users.plan` entirely.
4. **Product decision**: does "113 trades on 2026-03-30" or "78 trades on 2026-03-30" better match Aditya's mental model? If 78 is right, do (1). If 113 is right (every fill counts as a trade), document that explicitly in the dashboard so he understands.

None of these are live-launch blockers.
