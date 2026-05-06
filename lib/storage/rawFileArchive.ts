/**
 * Raw-file archive helper for the trade-files bucket.
 *
 * PR 2d (audit Finding E follow-up — 2026-05-04). Owns the Supabase
 * Storage upload that previously lived in `lib/supabase/saveFile.ts`,
 * with two additions:
 *
 *   - Compresses CSV/TSV/TXT bodies via gzip before upload.
 *     Skip-list: xlsx/xls/pdf/png/jpg/jpeg are already container-
 *     compressed; gzipping them adds CPU for ~0% size win.
 *   - Hash-addressed paths under `raw_uploads/`. The file_hash dedup
 *     guarantees `same hash → same path → upsert:false short-circuits`,
 *     so a second upload of an identical file is a no-op (the existing
 *     storage object stays).
 *
 * Caller contract:
 *   - Always returns. Storage failures log a structured warning prefixed
 *     `[STORAGE_ARCHIVE_FAILED]` and return null. Callers MUST treat
 *     null as best-effort failure and continue persisting the trade
 *     session — the user must never see "upload failed" because the
 *     archive bucket misbehaved.
 *   - Treats Supabase's "Duplicate" / 409 as success: the file is already
 *     archived under the same hash-addressed path; no work to do.
 */

import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { getSupabaseAdmin } from '@/lib/supabase'

const gzipAsync = promisify(gzip)

const BUCKET = 'trade-files'
const PATH_PREFIX = 'raw_uploads'

/** Extensions whose body is plain text and benefits from gzip. */
const COMPRESSIBLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'csv', 'tsv', 'txt',
])

/** Extensions whose body is already compressed; gzipping would waste CPU. */
const ALREADY_COMPRESSED_EXTENSIONS: ReadonlySet<string> = new Set([
  'xlsx', 'xls', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip', 'gz',
])

export interface ArchiveResult {
  /** Path inside the trade-files bucket (e.g. `raw_uploads/users/abc/<hash>.csv.gz`). */
  storagePath: string
  /** Bytes actually uploaded (post-gzip when compressed). */
  compressedSize: number
  /** True if gzip was applied; false if uploaded as-is. */
  wasCompressed: boolean
}

interface ArchiveOpts {
  buffer: Buffer
  filename: string
  fileHash: string
  userId?: string | null
  anonId?: string | null
}

/**
 * Archive a raw upload to the trade-files bucket. Best-effort: returns
 * `null` on any failure (logged as `[STORAGE_ARCHIVE_FAILED]`). Caller
 * is expected to continue persisting the row with `storage_path: null`.
 *
 * Dedup behaviour: the storage path is `<prefix>/<userId|anonId>/<hash>.<ext>`,
 * so re-uploading an identical file (same SHA-256) targets the same path.
 * `upsert: false` makes Supabase return a duplicate-error which we
 * intercept and treat as a successful archive (the file is already there).
 */
export async function archiveRawFile(opts: ArchiveOpts): Promise<ArchiveResult | null> {
  const { buffer, filename, fileHash, userId, anonId } = opts

  console.log('[Archive-Debug] called with:', {
    bufferLength: buffer?.length ?? 'no-buffer',
    filename,
    fileHashPrefix: fileHash?.slice(0, 12) ?? 'no-hash',
    userId: userId ?? 'no-userId',
    anonId: anonId ?? 'no-anonId',
  })

  if (!buffer || buffer.length === 0) {
    console.warn('[STORAGE_ARCHIVE_FAILED]', {
      reason: 'empty_buffer',
      filename,
      fileHash: fileHash.slice(0, 12),
    })
    return null
  }
  if (!fileHash) {
    console.warn('[STORAGE_ARCHIVE_FAILED]', {
      reason: 'missing_file_hash',
      filename,
    })
    return null
  }
  if (!userId && !anonId) {
    console.warn('[STORAGE_ARCHIVE_FAILED]', {
      reason: 'no_owner',
      filename,
      fileHash: fileHash.slice(0, 12),
    })
    return null
  }

  const ext = sanitiseExtension(filename)
  const wasCompressed = COMPRESSIBLE_EXTENSIONS.has(ext)
  let bodyToUpload: Buffer
  let contentType: string
  let storagePath: string

  try {
    if (wasCompressed) {
      bodyToUpload = await gzipAsync(buffer)
      contentType = 'application/gzip'
      storagePath = buildStoragePath({ userId, anonId, fileHash, ext, gz: true })
    } else if (ALREADY_COMPRESSED_EXTENSIONS.has(ext) || ext === 'unknown') {
      bodyToUpload = buffer
      contentType = mimeTypeFor(ext)
      storagePath = buildStoragePath({ userId, anonId, fileHash, ext, gz: false })
    } else {
      // Unknown but text-shaped extension — be conservative; do not gzip.
      bodyToUpload = buffer
      contentType = 'application/octet-stream'
      storagePath = buildStoragePath({ userId, anonId, fileHash, ext, gz: false })
    }
  } catch (err) {
    console.warn('[STORAGE_ARCHIVE_FAILED]', {
      reason: 'gzip_failed',
      filename,
      fileHash: fileHash.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }

  const supabase = getSupabaseAdmin()
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bodyToUpload, {
        contentType,
        upsert: false,
      })

    if (error) {
      // Duplicate is success — the same hash-addressed object already
      // exists from a prior upload. We've achieved the desired state.
      if (isDuplicateError(error)) {
        return {
          storagePath,
          compressedSize: bodyToUpload.length,
          wasCompressed,
        }
      }
      console.warn('[STORAGE_ARCHIVE_FAILED]', {
        reason: 'upload_error',
        filename,
        fileHash: fileHash.slice(0, 12),
        storagePath,
        error: error.message,
      })
      return null
    }

    return {
      storagePath,
      compressedSize: bodyToUpload.length,
      wasCompressed,
    }
  } catch (err) {
    console.warn('[STORAGE_ARCHIVE_FAILED]', {
      reason: 'upload_exception',
      filename,
      fileHash: fileHash.slice(0, 12),
      storagePath,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/* ─── helpers ─── */

function sanitiseExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0 || dot === filename.length - 1) return 'unknown'
  const raw = filename.slice(dot + 1).toLowerCase()
  // Strip anything not [a-z0-9]; keeps things like "tar.gz" → "gz".
  const cleaned = raw.replace(/[^a-z0-9]/g, '')
  return cleaned.length === 0 ? 'unknown' : cleaned
}

interface PathOpts {
  userId?: string | null
  anonId?: string | null
  fileHash: string
  ext: string
  gz: boolean
}

function buildStoragePath(opts: PathOpts): string {
  const owner = opts.userId
    ? `users/${opts.userId}`
    : `anon/${opts.anonId ?? 'unknown'}`
  const suffix = opts.gz ? `.${opts.ext}.gz` : `.${opts.ext}`
  return `${PATH_PREFIX}/${owner}/${opts.fileHash}${suffix}`
}

function mimeTypeFor(ext: string): string {
  switch (ext) {
    case 'csv': return 'text/csv'
    case 'tsv': return 'text/tab-separated-values'
    case 'txt': return 'text/plain'
    case 'pdf': return 'application/pdf'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'xls': return 'application/vnd.ms-excel'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}

/**
 * Recognise Supabase Storage's "object already exists" / "Duplicate"
 * shape across SDK versions. The error doesn't surface as a typed
 * variant in @supabase/supabase-js v2, so we inspect the message.
 */
function isDuplicateError(err: { message?: string; statusCode?: string }): boolean {
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('duplicate') || msg.includes('already exists')) return true
  // statusCode is sometimes a string in the SDK's typed error.
  if (err.statusCode === '409') return true
  return false
}
