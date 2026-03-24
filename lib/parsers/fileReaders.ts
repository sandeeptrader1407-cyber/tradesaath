import Papa from 'papaparse'
import type { FileReadResult } from './types'

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export async function readFile(buffer: Buffer, filename: string): Promise<FileReadResult> {
  const ext = filename.toLowerCase().split('.').pop() || ''

  if (ext === 'csv' || ext === 'tsv') {
    return readCSV(buffer, ext === 'tsv' ? '\t' : undefined)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return readExcel(buffer)
  }

  if (ext === 'pdf') {
    return readPDF(buffer)
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return {
      headers: [],
      rows: [],
      unsupported: true,
      message: 'Image parsing is coming soon. For now, please export your trades as CSV or Excel from your broker.',
    }
  }

  return {
    headers: [],
    rows: [],
    unsupported: true,
    message: `Unsupported file type: .${ext}. Please upload CSV, Excel, or PDF files.`,
  }
}

function readCSV(buffer: Buffer, delimiter?: string): FileReadResult {
  const text = buffer.toString('utf-8')

  // Auto-detect delimiter if not specified
  if (!delimiter) {
    const firstLine = text.split('\n')[0] || ''
    if (firstLine.split('\t').length > firstLine.split(',').length) {
      delimiter = '\t'
    }
  }

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (h: string) => normalizeHeader(h),
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    return { headers: [], rows: [], unsupported: true, message: 'Failed to parse CSV file' }
  }

  return {
    headers: result.meta.fields || [],
    rows: result.data,
  }
}

function readExcel(buffer: Buffer): FileReadResult {
  // Dynamic import to avoid bundling issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { headers: [], rows: [], unsupported: true, message: 'Excel file has no sheets' }
  }

  const sheet = workbook.Sheets[sheetName]
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' })

  if (rawRows.length === 0) {
    return { headers: [], rows: [], unsupported: true, message: 'Excel sheet is empty' }
  }

  // Normalize headers
  const originalHeaders = Object.keys(rawRows[0])
  const headerMap: Record<string, string> = {}
  for (const h of originalHeaders) {
    headerMap[h] = normalizeHeader(h)
  }

  const normalizedRows = rawRows.map((row) => {
    const out: Record<string, string> = {}
    for (const [orig, norm] of Object.entries(headerMap)) {
      out[norm] = String(row[orig] ?? '')
    }
    return out
  })

  return {
    headers: Object.values(headerMap),
    rows: normalizedRows,
  }
}

async function readPDF(buffer: Buffer): Promise<FileReadResult> {
  try {
    console.log(`[PDF] Starting parse, buffer size: ${buffer.length} bytes`)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    console.log(`[PDF] Parse complete, pages: ${data.numpages}, text length: ${(data.text || '').length}`)
    const text: string = data.text || ''

    if (!text.trim()) {
      return { headers: [], rows: [], unsupported: true, message: 'This PDF appears to be a scanned image. Please export your trades as CSV or Excel instead.' }
    }

    // Try to parse as tabular data
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

    if (lines.length < 2) {
      return { headers: [], rows: [], unsupported: true, message: 'PDF does not contain enough tabular data. Try exporting as CSV.' }
    }

    // Detect delimiter (tab, comma, or multiple spaces)
    const firstLine = lines[0]
    let delimiter: string | undefined
    if (firstLine.split('\t').length >= 3) {
      delimiter = '\t'
    } else if (firstLine.split(',').length >= 3) {
      delimiter = ','
    }

    // If no clear delimiter, try space-separated
    if (!delimiter) {
      // Try to parse the whole text as CSV with auto-detection
      const joined = lines.join('\n')
      const result = Papa.parse<Record<string, string>>(joined, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => normalizeHeader(h),
      })

      if (result.data.length > 0 && (result.meta.fields?.length || 0) >= 3) {
        return { headers: result.meta.fields || [], rows: result.data }
      }

      return {
        headers: [],
        rows: [],
        unsupported: true,
        message: 'Could not detect table structure in PDF. Please export your trades as CSV or Excel from your broker.',
      }
    }

    const joined = lines.join('\n')
    const result = Papa.parse<Record<string, string>>(joined, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      transformHeader: (h: string) => normalizeHeader(h),
    })

    if (result.data.length === 0) {
      return { headers: [], rows: [], unsupported: true, message: 'No tabular data found in PDF.' }
    }

    return { headers: result.meta.fields || [], rows: result.data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PDF] Parse error:', msg, err instanceof Error ? err.stack : '')
    return {
      headers: [],
      rows: [],
      unsupported: true,
      message: 'Failed to read PDF. Please try exporting your trades as CSV or Excel.',
    }
  }
}
