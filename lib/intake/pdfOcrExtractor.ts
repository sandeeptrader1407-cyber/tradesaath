/**
 * TradeSaath PDF OCR Extractor
 * For scanned/image PDFs where text extraction returns nothing.
 * Uses pdftoppm (poppler) to render pages to images, then Tesseract.js for OCR.
 * Falls back gracefully when pdftoppm is not available (e.g., Vercel serverless).
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import type { PdfExtractionResult, PdfTableRow } from './pdfTableExtractor';

/** Check if pdftoppm (poppler-utils) is available */
function hasPdftoppm(): boolean {
  try {
    execSync('which pdftoppm', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Render PDF pages to PNG images using pdftoppm.
 * Returns array of PNG file paths.
 */
function renderPdfPages(
  pdfBuffer: Buffer,
  maxPages: number = 8,
  dpi: number = 300,
): string[] {
  const tmpDir = join('/tmp', 'tradesaath-ocr-' + Date.now());
  mkdirSync(tmpDir, { recursive: true });

  const pdfPath = join(tmpDir, 'input.pdf');
  writeFileSync(pdfPath, pdfBuffer);

  try {
    execSync(
      `pdftoppm -png -r ${dpi} -l ${maxPages} "${pdfPath}" "${join(tmpDir, 'page')}"`,
      { stdio: 'pipe', timeout: 30000 },
    );
  } catch (err) {
    console.error('[PdfOcr] pdftoppm failed:', err instanceof Error ? err.message : err);
    return [];
  }

  const files = readdirSync(tmpDir)
    .filter(f => f.startsWith('page') && f.endsWith('.png'))
    .sort()
    .map(f => join(tmpDir, f));

  return files;
}

/**
 * OCR a single image file using Tesseract.js.
 * Returns extracted text.
 */
async function ocrImage(imagePath: string): Promise<string> {
  // Dynamic import to avoid bundling tesseract.js when not needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tesseract = await import('tesseract.js') as any;
  const recognize = tesseract.recognize || tesseract.default?.recognize;

  if (!recognize) {
    throw new Error('tesseract.js recognize function not found');
  }

  const result = await recognize(imagePath, 'eng');
  return result.data.text;
}

/**
 * Clean up temporary OCR files.
 */
function cleanupOcrFiles(filePaths: string[]): void {
  for (const f of filePaths) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
  // Try to remove the parent directory
  if (filePaths.length > 0) {
    const dir = filePaths[0].substring(0, filePaths[0].lastIndexOf('/'));
    try {
      // Remove the input.pdf too
      const inputPdf = join(dir, 'input.pdf');
      if (existsSync(inputPdf)) unlinkSync(inputPdf);
      // rmdir only works on empty dirs
      execSync(`rmdir "${dir}" 2>/dev/null || true`, { stdio: 'pipe' });
    } catch { /* ignore */ }
  }
}

/**
 * Parse OCR text into table-like rows.
 * Groups lines and tries to split them into cells based on spacing patterns.
 */
function parseOcrTextToRows(ocrText: string, pageNum: number): PdfTableRow[] {
  const lines = ocrText.split('\n').filter(l => l.trim().length > 0);
  const rows: PdfTableRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Split on multiple spaces (2+) or pipes to get cells
    const cells = line
      .split(/\s{2,}|\|/)
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (cells.length >= 1) {
      rows.push({
        page: pageNum,
        y: lines.length - i, // Approximate Y (top-to-bottom ordering)
        cells,
        items: cells.map((text, idx) => ({
          text,
          x: idx * 100, // Approximate X position
          y: lines.length - i,
          width: text.length * 7,
          height: 10,
          page: pageNum,
        })),
      });
    }
  }

  return rows;
}

/**
 * Extract text and table rows from a scanned PDF using OCR.
 * This is the main entry point — called when text-based extraction finds 0 items.
 *
 * Returns null if OCR is not available (no pdftoppm), allowing
 * the caller to fall back to Claude AI.
 */
export async function extractPdfWithOcr(
  buffer: Buffer,
  maxPages: number = 8,
): Promise<PdfExtractionResult | null> {
  // Check if pdftoppm is available
  if (!hasPdftoppm()) {
    console.log('[PdfOcr] pdftoppm not available — OCR extraction skipped');
    return null;
  }

  console.log('[PdfOcr] Starting OCR extraction...');
  const startTime = Date.now();

  // Step 1: Render PDF pages to PNG images
  const imageFiles = renderPdfPages(buffer, maxPages);
  if (imageFiles.length === 0) {
    console.log('[PdfOcr] No pages rendered — skipping OCR');
    return null;
  }
  console.log('[PdfOcr] Rendered ' + imageFiles.length + ' pages to PNG');

  // Step 2: OCR each page
  const allRows: PdfTableRow[] = [];
  const rawTextParts: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const pageNum = i + 1;
    try {
      const pageText = await ocrImage(imageFiles[i]);
      rawTextParts.push(pageText);
      rawTextParts.push('--- PAGE BREAK ---');

      const pageRows = parseOcrTextToRows(pageText, pageNum);
      allRows.push(...pageRows);
      console.log('[PdfOcr] Page ' + pageNum + ': ' + pageRows.length + ' rows extracted');
    } catch (ocrErr) {
      console.error('[PdfOcr] OCR failed on page ' + pageNum + ':', ocrErr instanceof Error ? ocrErr.message : ocrErr);
      rawTextParts.push('[OCR FAILED FOR PAGE ' + pageNum + ']');
    }
  }

  // Step 3: Clean up temporary files
  cleanupOcrFiles(imageFiles);

  const elapsed = Date.now() - startTime;
  const tableRows = allRows.filter(r => r.cells.length >= 3);
  console.log('[PdfOcr] OCR complete in ' + elapsed + 'ms: ' + allRows.length + ' total rows, ' + tableRows.length + ' table rows');

  return {
    allItems: allRows.flatMap(r => r.items),
    tableRows,
    rawText: rawTextParts.join('\n'),
    pageCount: imageFiles.length,
  };
}

/**
 * Parse OCR text specifically for Indian broker contract notes.
 * Extracts trade rows from OCR text using pattern matching
 * optimized for common OCR artifacts.
 */
export function parseOcrTradeRows(ocrText: string): {
  headers: string[];
  dataRows: string[][];
  broker: string;
  tradeDate: string;
  warnings: string[];
} {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const warnings: string[] = [];

  // Detect broker
  let broker = 'Unknown';
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('fyers')) { broker = 'Fyers'; break; }
    if (lower.includes('zerodha')) { broker = 'Zerodha'; break; }
    if (lower.includes('upstox')) { broker = 'Upstox'; break; }
    if (lower.includes('angel') && lower.includes('broking')) { broker = 'Angel One'; break; }
    if (lower.includes('groww')) { broker = 'Groww'; break; }
    if (lower.includes('icici') && lower.includes('securities')) { broker = 'ICICI Direct'; break; }
    if (lower.includes('hdfc') && lower.includes('securities')) { broker = 'HDFC Securities'; break; }
    if (lower.includes('kotak') && lower.includes('securities')) { broker = 'Kotak Securities'; break; }
    if (lower.includes('sharekhan')) { broker = 'Sharekhan'; break; }
    if (lower.includes('motilal') && lower.includes('oswal')) { broker = 'Motilal Oswal'; break; }
    if (lower.includes('5paisa')) { broker = '5Paisa'; break; }
    if (lower.includes('dhan')) { broker = 'Dhan'; break; }
    if (lower.includes('paytm') && lower.includes('money')) { broker = 'Paytm Money'; break; }
    if (lower.includes('iifl') && lower.includes('securities')) { broker = 'IIFL'; break; }
  }

  // Detect trade date
  let tradeDate = '';
  for (const line of lines) {
    const dateMatch = line.match(/Trade\s*Date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (dateMatch) {
      tradeDate = dateMatch[1];
      break;
    }
  }

  // Extract trade rows — look for OPTIDX/OPTSTK/FUTIDX/FUTSTK/EQ patterns
  const tradePattern = /^(OPTIDX|OPTSTK|FUTIDX|FUTSTK|EQ)\s+/i;
  const headers = ['symbol', 'side', 'quantity', 'price', 'amount'];
  const dataRows: string[][] = [];

  for (const line of lines) {
    if (!tradePattern.test(line)) continue;

    // Parse the trade line
    // Example: OPTIDX NIFTY 24Mar2026 22450 CE-NSE ERE 227.9917 IR 227.9917 CC -88916.7500 B
    // The OCR output varies, but we can extract key fields

    // Extract symbol (everything before the first number that looks like qty/price)
    const symbolMatch = line.match(/^((?:OPTIDX|OPTSTK|FUTIDX|FUTSTK|EQ)\s+\S+\s+\S+\s+\d+\s+(?:CE|PE|FUT)\S*)/i);
    let symbol = '';
    if (symbolMatch) {
      symbol = symbolMatch[1]
        .replace(/-NSE|-BSE/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      // Fallback: grab first few words
      const parts = line.split(/\s+/);
      symbol = parts.slice(0, 5).join(' ');
    }

    // Determine side from the line
    // Look for B (Buy) or S (Sell) indicators, also negative qty = sell
    const hasNegativeQty = /-\d+/.test(line);
    const lastChar = line.trim().slice(-1).toUpperCase();
    let side = 'BUY';
    if (hasNegativeQty || lastChar === 'S') {
      side = 'SELL';
    }

    // Extract numbers from the line
    const numbers = line.match(/-?\d+\.?\d*/g) || [];
    const numericValues = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));

    // Try to find quantity and price
    let quantity = 0;
    let price = 0;
    let amount = 0;

    // For options: qty is usually a round number (50, 75, 100, etc.)
    // Price is usually a decimal number
    for (const val of numericValues) {
      const absVal = Math.abs(val);
      if (absVal > 10000 && amount === 0) {
        amount = val;
      } else if (absVal >= 1 && absVal <= 100000 && val % 1 !== 0 && price === 0) {
        price = absVal;
      } else if (absVal > 0 && absVal < 100000 && val % 1 === 0 && quantity === 0 && absVal !== 24) {
        // Skip numbers that look like dates (24)
        quantity = absVal;
      }
    }

    if (symbol && (quantity > 0 || price > 0)) {
      dataRows.push([
        symbol,
        side,
        String(quantity),
        String(price),
        String(amount),
      ]);
    }
  }

  if (dataRows.length > 0) {
    console.log('[PdfOcr] Parsed ' + dataRows.length + ' trade rows from OCR text (broker: ' + broker + ')');
  } else {
    warnings.push('OCR text did not contain recognizable trade patterns');
  }

  return { headers, dataRows, broker, tradeDate, warnings };
}
