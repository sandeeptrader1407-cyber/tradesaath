/**
 * Parser version constants — single source of truth for the
 * `raw_files.parser_version` column.
 *
 * Audit reference: docs/audits/2026-05-04-parsing.md, Finding E.
 *
 * The two paths are kept distinct so the future re-process pipeline
 * (PR 2f) can target only the rows produced by a specific path:
 *
 *   - LOCAL_PARSER_VERSION  → written by `saveRawData()` after the
 *     Module 1 raw-first intake pipeline succeeds.
 *   - CLAUDE_PARSER_VERSION → written by `saveClaudeFallbackRawData()`
 *     after Claude AI extraction (Module 1 returned 0 trades).
 *
 * Bump conventions:
 *   - LOCAL goes 1.0 → 1.1 → 1.2 ... when the local parser changes
 *     in a way that would re-process old rows differently.
 *   - CLAUDE goes 2.0 → 2.1 ... independently when the Claude prompt
 *     or post-processing changes.
 *
 * PR 2d (2026-05-04) bumped both to mark the introduction of:
 *   - the resolveCurrency chain (replaces `|| 'INR'` fallbacks)
 *   - the rawFileArchive integration (storage_path now populated on the
 *     same row as parser_version)
 *   - the consolidated single-row-per-upload model (saveRawFile is
 *     deprecated; saveRawData is the single owner)
 */

export const LOCAL_PARSER_VERSION = 'intake-1.1'
export const CLAUDE_PARSER_VERSION = 'claude-2.1'
