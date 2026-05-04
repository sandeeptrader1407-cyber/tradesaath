/**
 * XLSX structural diagnostic — Step 0 of PR 2b (audit Finding N5).
 *
 * Inspects the 3 XLSX fixtures using the raw `xlsx` package, then asks
 * `parseExcelBuffer` (the production extractor) what it sees. Writes a
 * single JSON report to reports/xlsx-diagnostic.json so we can decide
 * the fix shape before touching any parser code.
 *
 * GATED behind RUN_XLSX_DIAG=true so it doesn't fire in regular `npm test`.
 *
 * To execute (PowerShell):
 *   $env:RUN_XLSX_DIAG='true'; npx vitest run __tests__/audit/diagnose-xlsx.test.ts; Remove-Item Env:RUN_XLSX_DIAG
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx')
import { parseExcelBuffer, chooseTradeSheet } from '@/lib/parsers/excelParser'

interface SheetInfo {
  index: number
  name: string
  rowCount: number
  colCount: number
  firstThreeRows: (string | number | null)[][]
  /** True if header-like row was found within first 5 rows (cell text matches trade-data patterns). */
  looksLikeTrades: boolean
  /** Which row index inside this sheet had the most trade-pattern hits, and how many. */
  bestHeaderRowIdx: number
  bestHeaderRowMatches: number
  bestHeaderRowSample: string[]
}

interface FixtureDiag {
  fixture: string
  filePath: string
  sizeBytes: number
  totalSheets: number
  sheetNames: string[]
  sheets: SheetInfo[]
  parserOutput: {
    chosenSheet: string | null
    headersDetected: string[]
    rowCount: number
    firstThreeRows: Record<string, string | number | null | undefined>[]
    /** Did the parser merge rows from multiple sheets? Heuristic: row count > any single sheet's data row count. */
    looksLikeMultiSheetMerge: boolean
  }
}

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FIXTURES = [
  {
    name: 'ibkr-xlsx',
    file: path.join(
      REPO_ROOT,
      'fixtures',
      'broker-samples',
      'ibkr-xlsx',
      'ibkr-activity-statement.xlsx',
    ),
  },
  {
    name: 'mt5',
    file: path.join(
      REPO_ROOT,
      'fixtures',
      'broker-samples',
      'mt5',
      'mt5-account-history.xlsx',
    ),
  },
  {
    name: 'groww',
    file: path.join(
      REPO_ROOT,
      'fixtures',
      'broker-samples',
      'groww',
      'groww-tradebook.xlsx',
    ),
  },
]

const HDR_PATTERN =
  /symbol|instrument|scrip|contract|trade.?time|date.?&?.?time|buy.?sell|side|qty|quantity|price|traded.?price|trade.?type|action|trans.?code|t\.\s*price|asset.?category|date\/time/i

const SHOULD_RUN = process.env.RUN_XLSX_DIAG === 'true'
const runner = SHOULD_RUN ? describe : describe.skip

function inspectSheet(name: string, sheet: unknown, index: number): SheetInfo {
  const json = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][]
  const rowCount = json.length
  const colCount = json.reduce((max, r) => Math.max(max, (r || []).length), 0)
  const firstThreeRows = json.slice(0, 3).map((r) => (r || []).slice(0, 14))

  // Find the row in the first 10 with the most trade-pattern matches.
  let bestIdx = -1
  let bestMatches = 0
  let bestSample: string[] = []
  const scanLimit = Math.min(10, json.length)
  for (let i = 0; i < scanLimit; i++) {
    const row = (json[i] || []).map((c) => String(c ?? '').trim())
    const matches = row.filter((c) => c && HDR_PATTERN.test(c)).length
    if (matches > bestMatches) {
      bestMatches = matches
      bestIdx = i
      bestSample = row
    }
  }

  return {
    index,
    name,
    rowCount,
    colCount,
    firstThreeRows,
    looksLikeTrades: bestMatches >= 3,
    bestHeaderRowIdx: bestIdx,
    bestHeaderRowMatches: bestMatches,
    bestHeaderRowSample: bestSample,
  }
}

function diagnose(fixtureName: string, filePath: string): FixtureDiag {
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames: string[] = workbook.SheetNames
  const sheets: SheetInfo[] = sheetNames.map((n: string, i: number) =>
    inspectSheet(n, workbook.Sheets[n], i),
  )

  // Run the production parser
  const parsed = parseExcelBuffer(buffer)
  const chosenSheet = chooseTradeSheet(workbook)
  const headersDetected = parsed.rows.length > 0 ? Object.keys(parsed.rows[0]) : []
  const firstThreeRows = parsed.rows.slice(0, 3).map((r) => {
    // Normalise to a printable shape; cap value length for readability.
    const out: Record<string, string | number | null | undefined> = {}
    for (const k of Object.keys(r)) {
      const v = (r as Record<string, unknown>)[k]
      if (v == null) {
        out[k] = null
      } else if (typeof v === 'number') {
        out[k] = v
      } else {
        const s = String(v)
        out[k] = s.length > 80 ? s.slice(0, 80) + '…' : s
      }
    }
    return out
  })

  // Heuristic: if parser produced more rows than any single sheet's
  // (data-row) count, multi-sheet merge is happening.
  const maxSheetDataRows = sheets.reduce((m, s) => {
    const dataRows = Math.max(0, s.rowCount - (s.bestHeaderRowIdx + 1))
    return Math.max(m, dataRows)
  }, 0)
  const looksLikeMultiSheetMerge =
    parsed.rows.length > maxSheetDataRows && sheets.length > 1

  return {
    fixture: fixtureName,
    filePath: path.relative(REPO_ROOT, filePath),
    sizeBytes: buffer.length,
    totalSheets: sheetNames.length,
    sheetNames,
    sheets,
    parserOutput: {
      chosenSheet,
      headersDetected,
      rowCount: parsed.rows.length,
      firstThreeRows,
      looksLikeMultiSheetMerge,
    },
  }
}

runner('xlsx structural diagnostic', () => {
  it('reports structure of all 3 XLSX fixtures + current parser output', () => {
    const reportsDir = path.join(REPO_ROOT, 'reports')
    fs.mkdirSync(reportsDir, { recursive: true })

    const out = FIXTURES.map((f) => diagnose(f.name, f.file))
    const target = path.join(reportsDir, 'xlsx-diagnostic.json')
    fs.writeFileSync(target, JSON.stringify(out, null, 2))

    // eslint-disable-next-line no-console
    for (const d of out) {
      console.log(
        `[XLSX_DIAG] ${d.fixture.padEnd(12)} sheets=${d.totalSheets} ` +
          `names=[${d.sheetNames.join(', ')}] ` +
          `chosen="${d.parserOutput.chosenSheet ?? '(none)'}" ` +
          `parserRows=${d.parserOutput.rowCount} ` +
          `multiSheetMerge=${d.parserOutput.looksLikeMultiSheetMerge}`,
      )
      for (const s of d.sheets) {
        console.log(
          `[XLSX_DIAG]   sheet[${s.index}] "${s.name}" rows=${s.rowCount} cols=${s.colCount} ` +
            `looksLikeTrades=${s.looksLikeTrades} ` +
            `bestHeaderAt=${s.bestHeaderRowIdx} matches=${s.bestHeaderRowMatches}`,
        )
      }
    }
    expect(out.length).toBe(FIXTURES.length)
  })
})
