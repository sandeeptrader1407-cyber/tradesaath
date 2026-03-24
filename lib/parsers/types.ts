export interface Fill {
  qty: number
  price: number
}

export interface ParsedTrade {
  id: number
  time: string
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  entry: number
  exit: number
  pnl: number
  cumPnl: number
  fills: Fill[]
}

export interface RawFill {
  time: string
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
}

export type ColumnRole = 'date' | 'symbol' | 'side' | 'qty' | 'price' | 'pnl' | 'ignore'

export type ColumnMapping = Record<string, ColumnRole>

export interface DetectionResult {
  headers: string[]
  mapping: ColumnMapping
  confidence: number
  broker: string | null
  preview: Record<string, string>[]
  format: string
  missingFields?: string[]
  ocrUsed?: boolean
  warning?: string
}

export interface FileReadResult {
  headers: string[]
  rows: Record<string, string>[]
  unsupported?: boolean
  message?: string
  ocrUsed?: boolean
  warning?: string
}
