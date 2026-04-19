/**
 * TradeSaath Intake Module -- Public API
 * Raw-first architecture: store everything raw, compute later.
 */

// Types
export type {
  RawTradeRow,
  RawFileData,
  StandardTrade,
  IntakeKPIs,
  IntakeTimeAnalysis,
  IntakeResult,
  RawFileRecord,
  ConfidenceLevel,
} from './types';

// Main pipeline
export { intakeFile } from './parseFile';
export type { IntakeOptions } from './parseFile';

// Individual components (for testing or direct use)
export { extractRawFile, extractRawRows, matchColumns, normalizeDate, normalizeTime, cleanNumeric, computeConfidence, detectHeaderRow } from './rawExtractor';
export { pairRawTrades } from './tradePairer';
export { validateTrades } from './tradeValidator';
export { calculateIntakeKPIs, calculateIntakeTimeAnalysis } from './kpiCalculator';
export { saveRawData, saveClaudeFallbackRawData, computeFileHash } from './saveRawData';
export { toLegacyTrade, toLegacyKPIs, toLegacyTimeAnalysis } from './legacyAdapter';

// PDF layout-aware extraction
export { extractPdfWithCoordinates } from './pdfTableExtractor';
export type { PdfTableRow, PdfExtractionResult } from './pdfTableExtractor';
export { parseContractNote, detectBrokerFromPdf, extractContractNoteDate } from './contractNoteDetector';
export type { ContractNoteResult, BrokerDetection } from './contractNoteDetector';

// OCR extraction for scanned PDFs
export { extractPdfWithOcr, parseOcrTradeRows } from './pdfOcrExtractor';
