export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from '@/lib/parsers/fileReaders'
import { detectAndPreview } from '@/lib/parsers/autoDetect'
import { applyMapping } from '@/lib/parsers/applyMapping'
import { pairTrades } from '@/lib/parsers/pairTrades'
import type { ColumnMapping } from '@/lib/parsers/types'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mode = (formData.get('mode') as string) || 'detect'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name || 'upload.csv'
    const ext = filename.toLowerCase().split('.').pop() || ''

    console.log(`[Parse] File: ${filename}, type: .${ext}, size: ${buffer.length} bytes`)

    // Read file into rows
    const fileResult = await readFile(buffer, filename)

    if (fileResult.unsupported) {
      return NextResponse.json(
        { error: fileResult.message, unsupported: true },
        { status: 400 }
      )
    }

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in file. Please check that the file is not empty.' },
        { status: 400 }
      )
    }

    if (mode === 'detect') {
      // Phase 1: Detect columns and return preview
      const result = detectAndPreview(fileResult.headers, fileResult.rows, ext)
      return NextResponse.json(result)
    }

    if (mode === 'analyse') {
      // Phase 2: Apply mapping and compute trades
      const mappingJson = formData.get('mapping') as string
      if (!mappingJson) {
        return NextResponse.json({ error: 'No column mapping provided' }, { status: 400 })
      }

      let mapping: ColumnMapping
      try {
        mapping = JSON.parse(mappingJson)
      } catch {
        return NextResponse.json({ error: 'Invalid column mapping' }, { status: 400 })
      }

      const rawFills = applyMapping(fileResult.rows, mapping)

      if (rawFills.length === 0) {
        return NextResponse.json(
          { error: 'No valid trades found after applying column mapping. Check that your file has buy/sell data with prices and quantities.' },
          { status: 400 }
        )
      }

      const trades = pairTrades(rawFills)
      const broker = (formData.get('broker') as string) || 'Detected'

      return NextResponse.json({
        broker,
        totalFills: rawFills.length,
        trades,
      })
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Parse failed'
    console.error('[Parse] Error:', message, err instanceof Error ? err.stack : '')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
