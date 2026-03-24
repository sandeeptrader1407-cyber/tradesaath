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
    return readImage(buffer)
  }

  return {
    headers: [],
    rows: [],
    unsupported: true,
    message: `Unsupported file type: .${ext}. Please upload CSV, Excel, PDF, or image files.`,
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

/* ─── OCR via tesseract.js ─── */
async function runOCR(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Tesseract = require('tesseract.js')
  console.log('[OCR] Starting recognition...')
  const result = await Tesseract.recognize(buffer, 'eng', {
    logger: (m: { status: string; progress?: number }) => {
      if (m.status === 'recognizing text') {
        console.log(`[OCR] ${m.status} ${Math.round((m.progress || 0) * 100)}%`)
      }
    },
  })
  const text = result.data.text || ''
  console.log(`[OCR] Complete, extracted ${text.length} characters`)
  return text
}

/* ─── Parse extracted text into tabular data ─── */
function parseExtractedText(text: string, ocrUsed: boolean): FileReadResult {
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)

  if (lines.length < 2) {
    if (ocrUsed) {
      return {
        headers: [], rows: [],
        ocrUsed: true,
        warning: "We couldn't extract clean trade data from this file. For best results, try uploading the original CSV or Excel file from your broker.",
        unsupported: true,
        message: "We couldn't extract clean trade data from this file. For best results, try uploading the original CSV or Excel file from your broker.",
      }
    }
    return { headers: [], rows: [], unsupported: true, message: 'Not enough tabular data found.' }
  }

  // Detect delimiter
  const firstLine = lines[0]
  let delimiter: string | undefined
  if (firstLine.split('\t').length >= 3) {
    delimiter = '\t'
  } else if (firstLine.split(',').length >= 3) {
    delimiter = ','
  }

  const joined = lines.join('\n')
  const result = Papa.parse<Record<string, string>>(joined, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (h: string) => normalizeHeader(h),
  })

  if (result.data.length > 0 && (result.meta.fields?.length || 0) >= 2) {
    return {
      headers: result.meta.fields || [],
      rows: result.data,
      ocrUsed,
      warning: ocrUsed ? 'OCR quality may vary — please verify the detected data below.' : undefined,
    }
  }

  // Fallback: treat each line as a single-column row so the user can still see what was extracted
  if (ocrUsed && lines.length > 0) {
    const headers = ['extracted_text']
    const rows = lines.map(l => ({ extracted_text: l }))
    return {
      headers,
      rows,
      ocrUsed: true,
      warning: "We couldn't detect table structure. The raw extracted text is shown below — try uploading the original CSV or Excel file for better results.",
    }
  }

  return {
    headers: [], rows: [],
    unsupported: true,
    message: 'Could not detect table structure in the file.',
  }
}

/* ─── PDF reader with OCR fallback ─── */
async function readPDF(buffer: Buffer): Promise<FileReadResult> {
  try {
    console.log(`[PDF] Starting parse, buffer size: ${buffer.length} bytes`)
    // Use unpdf — works reliably in Next.js server routes without worker/webpack issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { extractText } = require('unpdf')
    const result = await extractText(new Uint8Array(buffer))
    // unpdf returns { totalPages: number, text: string[] } — one string per page
    const text = (result.text as string[]).join('\n')
    console.log(`[PDF] Parse complete, pages: ${result.totalPages}, text length: ${text.length}`)
    console.log(`[PDF] First 2000 chars:\n${text.substring(0, 2000)}`)

    // If text extraction got enough content, parse it directly
    if (text.trim().length >= 50) {
      return parseExtractedText(text, false)
    }

    // Scanned/image PDF — fall back to OCR
    console.log('[PDF] Low text content, falling back to OCR...')
    const ocrText = await runOCR(buffer)
    if (!ocrText.trim()) {
      return {
        headers: [], rows: [],
        ocrUsed: true,
        unsupported: true,
        message: 'Could not extract any text from this PDF. The file may be corrupted or contain only graphics.',
      }
    }
    return parseExtractedText(ocrText, true)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('=== PDF ERROR DETAIL ===')
    console.error('Error name:', err instanceof Error ? err.name : 'unknown')
    console.error('Error message:', msg)
    console.error('Error stack:', err instanceof Error ? err.stack : '')
    console.error('=== END PDF ERROR ===')

    // Even if unpdf fails, try OCR as last resort
    try {
      console.log('[PDF] Text extraction failed, attempting OCR fallback...')
      const ocrText = await runOCR(buffer)
      if (ocrText.trim()) {
        return parseExtractedText(ocrText, true)
      }
    } catch (ocrErr: unknown) {
      console.error('[PDF] OCR fallback also failed:', ocrErr instanceof Error ? ocrErr.message : String(ocrErr))
    }

    return {
      headers: [], rows: [],
      unsupported: true,
      message: 'Failed to read this PDF. The file may be corrupted.',
    }
  }
}

/* ─── Image reader via OCR ─── */
async function readImage(buffer: Buffer): Promise<FileReadResult> {
  try {
    console.log(`[Image] Starting OCR, buffer size: ${buffer.length} bytes`)
    const ocrText = await runOCR(buffer)

    if (!ocrText.trim()) {
      return {
        headers: [], rows: [],
        ocrUsed: true,
        unsupported: true,
        message: 'Could not extract any text from this image. The image may be too blurry or contain only graphics.',
      }
    }

    return parseExtractedText(ocrText, true)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Image] OCR error:', msg, err instanceof Error ? err.stack : '')
    return {
      headers: [], rows: [],
      unsupported: true,
      message: 'Failed to read this image file.',
    }
  }
}
