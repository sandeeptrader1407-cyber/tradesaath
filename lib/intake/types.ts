/**
 * TradeSaath Intake Module — Type Definitions
 * RAW-FIRST architecture: store everything raw, compute later.
 * If our parser has a bug, we re-parse from stored raw data without re-upload.
 */

// ── Raw Layer: exactly what the file contained ──

/** Every column value from a single row, before any interpretation */
export interface RawTradeRow {
  /** 0-based row index in the original file */
  rowIndex: number;
  /** Original column values keyed by header name (untouched) */
  raw: Record<string, string>;
  /** Best-effort mapping to standard fields (may have gaps) */
  mapped: {
    symbol?: string;
    side?: string;       // raw value before normalization
    qty?: string;
    price?: string;
    amount?: string;
    pnl?: string;
    date?: string;       // raw date string
    time?: string;       // raw time string
    exchange?: string;
    tradeId?: string;
    expiry?: string;
    strike?: string;
    optionType?: string;
    buyQty?: string;
    sellQty?: string;
    buyPrice?: string;
    sellPrice?: string;
  };
  /** Which raw column mapped to which standard field */
  columnMapping: Record<string, string>;
  /** Anything suspicious about this row */
  warnings: string[];
}

/** Complete snapshot of one uploaded file */
export interface RawFileData {
  /** Original filename */
  filename: string;
  /** File extension (csv, xlsx, pdf, etc.) */
  extension: string;
  /** File size in bytes */
  sizeBytes: number;
  /** SHA-256 hash for dedup */
  fileHash: string;
  /** Detected broker (or 'Unknown') */
  broker: string;
  /** Detected market (NSE, NYSE, etc.) */
  market: string;
  /** Detected currency (INR, USD, etc.) */
  currency: string;
  /** Best-effort trade date from file metadata/content */
  tradeDate: string;
  /** Raw column headers as they appear in the file */
  headers: string[];
  /** Header-to-standard-field mapping used */
  columnMapping: Record<string, string>;
  /** Every data row, raw + mapped */
  rows: RawTradeRow[];
  /** Full raw text (for CSV/TSV) or extracted text (for PDF) — capped at 500KB */
  rawText: string;
  /** Extraction warnings (missing columns, ambiguous dates, etc.) */
  warnings: string[];
  /** ISO timestamp of when this was extracted */
  extractedAt: string;
}

// ── Standard Layer: computed from raw ──

/** A paired (or unpaired) trade with references back to raw rows */
export interface StandardTrade {
  index: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  exitPrice: number;        // 0 if open/unpaired
  pnl: number;
  cumPnl: number;
  date: string;             // YYYY-MM-DD
  entryTime: string;        // HH:MM
  exitTime: string;         // HH:MM ('' if open)
  holdingMinutes: number;
  session: string;          // morning | midday | afternoon
  timeGapMinutes: number | null;
  tag: string;              // win | loss | open
  label: string;            // Winner | Loser | Open Position
  exchange: string;
  tradeId: string;
  /** Row indices from the raw file that produced this trade */
  sourceRows: number[];
  /** Is this a short trade? (opened with SELL) */
  isShort: boolean;
}

/** KPIs computed from StandardTrade[] */
export interface IntakeKPIs {
  netPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  bestTradePnl: number;
  worstTradePnl: number;
  grossProfit: number;
  grossLoss: number;
  avgWin: number;
  avgLoss: number;
  grossBuyValue: number;
  grossSellValue: number;
  /** Count of trades flagged as open positions */
  openPositions: number;
}

/** Time analysis from StandardTrade[] */
export interface IntakeTimeAnalysis {
  avgTimeGapMinutes: number;
  minTimeGapMinutes: number;
  maxTimeGapMinutes: number;
  tradingDurationMinutes: number;
}

/** Final result from the intake pipeline */
export interface IntakeResult {
  success: boolean;
  /** The raw file snapshot — always present even on failure */
  rawFile: RawFileData;
  /** Paired/computed trades (empty on failure) */
  trades: StandardTrade[];
  /** KPIs (zeroed on failure) */
  kpis: IntakeKPIs;
  /** Time analysis */
  timeAnalysis: IntakeTimeAnalysis;
  /** Validation issues found */
  validationWarnings: string[];
  /** Fatal error message if success=false */
  error?: string;
}

// ── Supabase storage shape ──

/** What gets inserted into the raw_files table */
export interface RawFileRecord {
  user_id: string;
  session_id?: string;
  filename: string;
  file_hash: string;
  file_size_bytes: number;
  broker: string;
  market: string;
  currency: string;
  trade_date: string;
  /** The complete RawFileData as JSONB */
  raw_data: RawFileData;
  row_count: number;
  extraction_warnings: string[];
  created_at?: string;
}
