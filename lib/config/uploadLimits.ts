/**
 * Upload size limits — single source of truth.
 *
 * Replaces three hardcoded `10 * 1024 * 1024` literals previously
 * scattered across:
 *   - app/api/analyse/route.ts:457
 *   - app/api/parse/route.ts:27
 *   - app/api/extract/route.ts:97
 *
 * PR 2d (audit Finding E follow-up — 2026-05-04): also flips the
 * rejection status code from 400 → 413 ("Payload Too Large") at all
 * three callers for HTTP semantics correctness.
 *
 * To raise the limit (e.g. for paid tiers handling large IBKR statements),
 * either bump this constant globally OR add a per-plan override at the
 * call site that passes the larger limit explicitly. Don't sprinkle new
 * literals back into the routes.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

/** Friendly message returned in the 413 response body when a file exceeds MAX_UPLOAD_BYTES. */
export const UPLOAD_TOO_LARGE_MESSAGE = 'File too large: maximum 10MB per file.'
