# TradeSaath Payment Flow Debug Report
**Date**: April 11, 2026  
**Tester**: Claude (automated browser testing)  
**URL**: https://tradesaath.vercel.app

---

## EXECUTIVE SUMMARY

The payment flow **WORKS correctly when the user is signed in**. The 401 error only occurs for **unauthenticated users** — this is **by design** in the API code (`create-order/route.ts` line 26-28). The real question is whether unauthenticated users should be able to pay, or if the UI should redirect them to sign in first.

---

## TEST RESULTS

### 1. Sign-In Flow ✅ WORKING
- Clerk sign-in page loads at `/sign-in`
- Google OAuth flow completes successfully
- **"Development mode"** banner visible at bottom of Clerk modal
- Redirects to `/dashboard` after sign-in
- **Clerk warnings in console**:
  - `Clerk has been loaded with development keys` — expected for dev
  - `The prop "afterSignInUrl" is deprecated` — should migrate to `fallbackRedirectUrl` or `forceRedirectUrl`

### 2. Authenticated Nav State ✅ WORKING
- Nav shows: avatar "S" (pink), Day/Night toggle, hamburger menu
- "Sign In" and "Get Started" buttons correctly hidden
- Hamburger menu reveals:
  - 📊 Dashboard
  - 📓 Journal
  - 🤝 **Saathi** 🔒 (lock icon — Pro-gated)
- **NOTE**: Live app now uses "Saathi" naming (matching prototype), NOT "AI Coach"

### 3. Dashboard ✅ WORKING
- Shows **"⭐ Single Report Plan"** banner — plan detection works
- Greeting: "Good evening, Trader"
- Stats: "April 2026 · 0 sessions · 0 trades analysed"
- Empty state with "Upload First Session →" CTA
- **API calls on dashboard load** (all 200 OK):
  - `POST /api/auth/sync` — syncs Clerk user to Supabase
  - `GET /api/user/plan` — called **4 times** (optimization needed!)
  - `GET /api/dashboard/stats` — returns dashboard data

### 4. Upload Page ✅ WORKING
- URL: `/upload`
- Shows "Analyse Your Trades" with **FREE** badge
- "Market, exchange & currency will be auto-detected from your file"
- Drop zone: PDF, CSV, XLSX, XLS, PNG, JPG, JPEG — up to 40 files

### 5. Payment Flow — Signed In ✅ WORKING
- Clicked "Buy Report →" button (Single Report ₹99)
- `POST /api/payments/create-order` returned **200 OK**
- Razorpay checkout modal **opened successfully**
- Modal shows: "TradeSaath" branding, "Payment Options", **"Test Mode"** red ribbon
- No console errors

### 6. Payment Flow — Not Signed In ⚠️ EXPECTED 401
- The API route at `app/api/payments/create-order/route.ts` lines 25-28:
  ```typescript
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  ```
- This is **intentional** — the API requires authentication to create orders
- **The bug is in the UI**, not the API: The `Pricing.tsx` component does NOT check if the user is signed in before calling `pay()`. An unauthenticated user clicking "Buy Report →" will:
  1. Call `POST /api/payments/create-order`
  2. Get a 401 response
  3. See an error message: "Authentication required"
- **FIX NEEDED**: Either redirect unauthenticated users to `/sign-in` when they click a paid plan button, OR show a toast/message saying "Please sign in first"

---

## BUGS AND ISSUES FOUND

### P0 — Critical
1. **Landing page rendering bug**: The entire landing page between hero and footer renders as a solid dark screen when scrolled. The DOM content exists (confirmed via JS inspection), but it's visually invisible. Likely caused by CSS animation/intersection observer fade-in that doesn't trigger properly. This means **pricing cards, features, how-it-works, FAQ are all invisible** when scrolling.

### P1 — High Priority
2. **Unauthenticated payment UX**: No guard on "Buy Report →" / "Get Pro Plan →" buttons for logged-out users. The `handleBuy()` function in `Pricing.tsx` calls `pay()` directly without checking auth state. Result: 401 error message shown to user with no guidance on what to do.

3. **`/api/user/plan` called 4 times**: On dashboard load, the plan API is called 4 times consecutively. This suggests multiple components are independently fetching the plan instead of sharing state.

### P2 — Medium Priority
4. **Clerk deprecated prop**: Using `afterSignInUrl` which is deprecated. Should migrate to `fallbackRedirectUrl` or `forceRedirectUrl`.

5. **Development keys on production URL**: `tradesaath.vercel.app` is using Clerk development keys and Razorpay test keys. Before launch, both need to be switched to production keys.

### P3 — Low Priority (Observations)
6. **Free tier now shows "3 trades full psychology"** in both `Pricing.tsx` and `ComparisonTable.tsx` — matches the prototype (previously was "1 trade"). The `planStore.ts` also confirms `free` returns limit of 3.

7. **Saathi naming adopted**: The live app nav now says "Saathi" instead of "AI Coach", matching the prototype. However, the route is still `/coach` (not `/saathi`).

---

## RECOMMENDED FIXES

### Fix 1: Unauthenticated Payment Guard (Pricing.tsx)
```typescript
import { useUser } from '@clerk/nextjs'

// Inside Pricing component:
const { isSignedIn } = useUser()

function handleBuy(plan: string) {
  if (!isSignedIn) {
    // Redirect to sign-in, then back to pricing
    window.location.href = '/sign-in?redirect_url=/#pricing'
    return
  }
  setPayError(null)
  pay({ plan, onSuccess: () => { window.location.href = '/upload' }, onError: (err) => setPayError(err) })
}
```

### Fix 2: Deduplicate `/api/user/plan` calls
Use the Zustand store to fetch once and share across components, or use SWR/React Query with deduplication.

### Fix 3: Landing page rendering
Investigate the intersection observer / scroll animation that controls section visibility. The sections have correct DOM content but appear completely dark when scrolled into view.

---

## SCREENSHOTS CAPTURED
1. Landing page hero (signed out) — hero visible, nav with "Sign In"
2. Clerk sign-in page — "Development mode" visible
3. Google OAuth account picker
4. Dashboard (signed in) — "Single Report Plan" banner, empty state
5. Hamburger menu — Dashboard, Journal, Saathi 🔒
6. Upload page — file drop zone
7. Razorpay checkout modal — "TradeSaath" branding, "Test Mode" ribbon
