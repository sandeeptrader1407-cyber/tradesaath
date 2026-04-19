/**
 * TradeSaath PDF OCR Extractor — Vercel-safe
 *
 * Handles PDFs that have no text operators (e.g., Fyers' "Microsoft Print To PDF"
 * exports where every character is drawn as vector paths).
 *
 * Renders each page to a PNG using pdfjs-dist + @napi-rs/canvas (both work
 * on Vercel's default serverless Node 20 runtime — no native binaries needed).
 * OCR via tesseract.js (WASM).
 */

import type { PdfExtractionResult, PdfTableRow } from './pdfTableExtractor';

const RENDER_SCALE = 2.0;
const MAX_OCR_PAGES = 12;
const PER_PAGE_TIMEOUT_MS = 20_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeNodeCanvasFactory(createCanvas: any) {
  return class NodeCanvasFactory {
    create(width: number, height: number) {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      const context = canvas.getContext('2d');
      return { canvas, context };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = Math.ceil(width);
      canvasAndContext.canvas.height = Math.ceil(height);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  };
}

async function renderPdfToPngs(
  buffer: Buffer,
  maxPages: number,
): Promise<Array<{ pageNum: number; png: Buffer }>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require('@napi-rs/canvas');

  // pdfjs-dist 4.x is an ESM-only package that ships its main entry as
  // pdf.mjs. Webpack/Next.js refuses CJS `require()` of .mjs files, so we
  // must use dynamic `await import()`. Webpack keeps dynamic imports as
  // runtime-only when the package is in serverComponentsExternalPackages.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Running on Node.js (server-side). pdfjs-dist auto-detects this and
  // runs the worker code in-thread via its fake-worker fallback, so we
  // intentionally do NOT set GlobalWorkerOptions.workerSrc here —
  // setting it would force webpack to resolve another ESM .mjs file
  // and re-break the build.

  const CanvasFactory = makeNodeCanvasFactory(createCanvas);
  const data = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CanvasFactory: CanvasFactory as any,
    disableFontFace: true,
    useSystemFonts: false,
  });

  const doc = await loadingTask.promise;
  const total = Math.min(doc.numPages, maxPages);
  const pages: Array<{ pageNum: number; png: Buffer }> = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const factory = new CanvasFactory();
    const { canvas, context } = factory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasFactory: factory as any,
    }).promise;

    const png: Buffer = canvas.toBuffer('image/png');
    pages.push({ pageNum: i, png });

    factory.destroy({ canvas, context });
    page.cleanup();
  }

  await doc.destroy();
  return pages;
}

async function ocrPng(png: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
  const Tesseract: any = require('tesseract.js');
  const recognize = Tesseract.recognize || Tesseract.default?.recognize;
  if (!recognize) throw new Error('tesseract.js recognize function not found');

  const result = await recognize(png, 'eng', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: (_m: any) => {
      /* noop */
    },
  });
  return (result?.data?.text as string) || '';
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function parseOcrTextToRows(ocrText: string, pageNum: number): PdfTableRow[] {
  const lines = ocrText.split('\n').filter(l => l.trim().length > 0);
  const rows: PdfTableRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const cells = line
      .split(/\s{2,}|\|/)
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (cells.length >= 1) {
      rows.push({
        page: pageNum,
        y: lines.length - i,
        cells,
        items: cells.map((text, idx) => ({
          text,
          x: idx * 100,
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

export async function extractPdfWithOcr(
  buffer: Buffer,
  maxPages: number = MAX_OCR_PAGES,
): Promise<PdfExtractionResult | null> {
  const startedAt = Date.now();
  console.log('[PdfOcr] Starting pdfjs-based OCR extraction (scale=' + RENDER_SCALE + ', maxPages=' + maxPages + ')');

  let renderedPages: Array<{ pageNum: number; png: Buffer }>;
  try {
    renderedPages = await renderPdfToPngs(buffer, maxPages);
  } catch (renderErr) {
    console.error('[PdfOcr] PDF render failed:', renderErr instanceof Error ? renderErr.message : renderErr);
    return null;
  }
  if (renderedPages.length === 0) {
    console.log('[PdfOcr] No pages rendered - skipping OCR');
    return null;
  }
  console.log('[PdfOcr] Rendered ' + renderedPages.length + ' pages (' + (Date.now() - startedAt) + 'ms)');

  const rawTextParts: string[] = [];
  const allRows: PdfTableRow[] = [];

  for (const { pageNum, png } of renderedPages) {
    const pageStart = Date.now();
    try {
      const text = await withTimeout(ocrPng(png), PER_PAGE_TIMEOUT_MS, 'OCR page ' + pageNum);
      rawTextParts.push(text);
      rawTextParts.push('--- PAGE BREAK ---');
      const pageRows = parseOcrTextToRows(text, pageNum);
      allRows.push(...pageRows);
      console.log('[PdfOcr] Page ' + pageNum + ': ' + pageRows.length + ' rows (' + (Date.now() - pageStart) + 'ms)');
    } catch (ocrErr) {
      console.error('[PdfOcr] OCR failed on page ' + pageNum + ':', ocrErr instanceof Error ? ocrErr.message : ocrErr);
      rawTextParts.push('[OCR FAILED FOR PAGE ' + pageNum + ']');
    }
  }

  const elapsed = Date.now() - startedAt;
  const tableRows = allRows.filter(r => r.cells.length >= 3);
  console.log('[PdfOcr] OCR complete in ' + elapsed + 'ms - ' + allRows.length + ' raw lines, ' + tableRows.length + ' table rows');

  return {
    allItems: allRows.flatMap(r => r.items),
    tableRows,
    rawText: rawTextParts.join('\n'),
    pageCount: renderedPages.length,
  };
}

// ---------------------------------------------------------------------------
// Broker-aware OCR row parser
// ---------------------------------------------------------------------------

interface OcrTradeRow {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  amount: number;
  time?: string;
}

function normaliseSideChar(raw: string): 'BUY' | 'SELL' | null {
  const c = raw.trim().toUpperCase();
  if (c === 'B' || c === '8' || c === '+') return 'BUY';
  if (c === 'S' || c === '5' || c === '-') return 'SELL';
  return null;
}

function cleanSymbol(raw: string): string {
  return raw
    .replace(/-NSE|-BSE|-MCX|-NCDEX/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFyersLine(line: string): OcrTradeRow | null {
  if (!/OPTIDX|OPTSTK|FUTIDX|FUTSTK|NIFTY|BANKNIFTY|\bEQ\b/i.test(line)) return null;

  // Order ID: Fyers IDs are 16 digits starting with 11-15. OCR sometimes splits
  // them with a space. Try progressively looser matches.
  let orderId: string | null = null;
  const strict = line.match(/\b(1[1-5]\d{14})\b/);
  if (strict) {
    orderId = strict[1];
  } else {
    const split = line.match(/\b(1[1-5]\d{5,10})\s(\d{5,10})\b/);
    if (split) {
      const combined = split[1] + split[2];
      if (combined.length >= 15 && combined.length <= 17) orderId = combined;
    }
  }
  if (!orderId) {
    const loose = line.match(/\b(\d{14,17})\b/);
    if (loose) orderId = loose[1];
  }
  if (!orderId) return null;

  const symMatch = line.match(
    /(OPTIDX|OPTSTK|FUTIDX|FUTSTK|EQ)\s+([A-Z][A-Z0-9]{1,15})(?:\s+(\d{1,2}[A-Za-z]{3}\d{4}))?\s*(\d{3,6})?\s*(CE|PE|FUT)?/i,
  );
  if (!symMatch) return null;
  const symbol = cleanSymbol(
    [symMatch[1], symMatch[2], symMatch[3], symMatch[4], symMatch[5]].filter(Boolean).join(' '),
  );

  const timeMatch = line.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
  const time = timeMatch ? timeMatch[1] : undefined;

  const postSymIdx = symMatch.index! + symMatch[0].length;
  const afterSymbol = line.slice(postSymIdx, postSymIdx + 40);
  let side: 'BUY' | 'SELL' | null = null;
  const sideCellMatch = afterSymbol.match(/[\[|]\s*([BbSs85+\-])\s*[\]|\s]/);
  if (sideCellMatch) side = normaliseSideChar(sideCellMatch[1]);

  const decimals = Array.from(line.matchAll(/\d+\.\d+/g)).map(m => m[0]);
  const price4dp = decimals.find(n => /\.\d{4}$/.test(n));
  const amount2dp = [...decimals].reverse().find(n => /\.\d{2}$/.test(n));
  if (!price4dp) return null;

  const ints = Array.from(line.matchAll(/(?<![\d.])(\d{1,4})(?!\d)/g)).map(m => m[0]);
  const qtyCandidate = ints.find(n => {
    const v = parseInt(n, 10);
    if (!Number.isFinite(v)) return false;
    if (v < 1 || v > 9999) return false;
    if (v >= 15000 && v <= 60000) return false;
    if (v >= 2020 && v <= 2030) return false;
    return true;
  });
  const qty = qtyCandidate ? parseInt(qtyCandidate, 10) : 0;
  if (qty === 0) return null;

  return {
    orderId,
    symbol,
    side: side || 'BUY',
    qty,
    price: parseFloat(price4dp),
    amount: amount2dp ? parseFloat(amount2dp) : 0,
    time,
  };
}

function detectBrokerFromOcr(ocrText: string): string {
  const t = ocrText.toLowerCase();
  if (t.includes('fyers')) return 'Fyers';
  if (t.includes('zerodha') || t.includes('kite.zerodha')) return 'Zerodha';
  if (t.includes('upstox')) return 'Upstox';
  if (t.includes('angel') && t.includes('broking')) return 'Angel One';
  if (t.includes('groww')) return 'Groww';
  if (t.includes('icici') && t.includes('securities')) return 'ICICI Direct';
  if (t.includes('hdfc') && t.includes('securities')) return 'HDFC Securities';
  if (t.includes('kotak') && t.includes('securities')) return 'Kotak Securities';
  if (t.includes('sharekhan')) return 'Sharekhan';
  if (t.includes('motilal') && t.includes('oswal')) return 'Motilal Oswal';
  if (t.includes('5paisa')) return '5Paisa';
  if (t.includes('dhan')) return 'Dhan';
  if (t.includes('paytm') && t.includes('money')) return 'Paytm Money';
  if (t.includes('iifl') && t.includes('securities')) return 'IIFL';
  return 'Unknown';
}

function detectTradeDate(ocrText: string): string {
  const m = ocrText.match(/Trade\s*Date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  return m ? m[1] : '';
}

function inferSidesFromPairs(rows: OcrTradeRow[]): OcrTradeRow[] {
  const byOrderId = new Map<string, OcrTradeRow[]>();
  for (const r of rows) {
    if (!byOrderId.has(r.orderId)) byOrderId.set(r.orderId, []);
    byOrderId.get(r.orderId)!.push(r);
  }

  // Use Array.from() to avoid TS "MapIterator can only be iterated with
  // downlevelIteration" error under the project's current tsconfig target.
  const groups: OcrTradeRow[][] = Array.from(byOrderId.values());
  for (const group of groups) {
    if (group.length < 2) continue;
    const allBuy = group.every((r: OcrTradeRow) => r.side === 'BUY');
    if (!allBuy) continue;
    const sorted = [...group].sort((a, b) => a.price - b.price);
    sorted[sorted.length - 1].side = 'SELL';
  }

  return rows;
}

export function parseOcrTradeRows(ocrText: string): {
  headers: string[];
  dataRows: string[][];
  broker: string;
  tradeDate: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const broker = detectBrokerFromOcr(ocrText);
  const tradeDate = detectTradeDate(ocrText);

  const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (broker === 'Fyers') {
    // Count how many lines *look* like Fyers trades (OPTIDX / OPTSTK / FUTIDX / FUTSTK / EQ)
    // so we can tell if the parser is silently dropping most of them.
    const tradeLineCount = lines.filter(l =>
      /OPTIDX|OPTSTK|FUTIDX|FUTSTK|\bEQ\b/i.test(l),
    ).length;

    const parsed: OcrTradeRow[] = [];
    for (const line of lines) {
      const row = parseFyersLine(line);
      if (row) parsed.push(row);
    }
    const deduped = inferSidesFromPairs(parsed);

    // Sanity gate: OCR output on vectorised Microsoft-Print-To-PDF files mangles
    // small-font numeric columns (price, quantity) into character soup, so
    // parseFyersLine can often only recover a tiny fraction of the rows. If we
    // detect >= 10 trade-looking lines but end up with < 70 %, bail out and let
    // the Claude vision fallback in /api/analyse handle the file truthfully.
    const COVERAGE_THRESHOLD = 0.7;
    if (tradeLineCount >= 10 && deduped.length < Math.ceil(tradeLineCount * COVERAGE_THRESHOLD)) {
      warnings.push(
        `Fyers OCR parser recovered only ${deduped.length} of ${tradeLineCount} trade-like lines ` +
          `(${Math.round((deduped.length / tradeLineCount) * 100)}% coverage) — OCR output too noisy, ` +
          `returning empty to trigger Claude vision fallback.`,
      );
      console.warn(
        '[PdfOcr] Fyers sanity gate tripped: ' + deduped.length + '/' + tradeLineCount +
          ' parsed — returning 0 rows so Claude vision handles the file.',
      );
      return {
        headers: ['symbol', 'side', 'quantity', 'price', 'amount', 'order_id', 'time'],
        dataRows: [],
        broker,
        tradeDate,
        warnings,
      };
    }

    if (deduped.length === 0) {
      warnings.push('Fyers OCR parser found no trade rows - text likely too noisy');
      return {
        headers: ['symbol', 'side', 'quantity', 'price', 'amount', 'order_id', 'time'],
        dataRows: [],
        broker,
        tradeDate,
        warnings,
      };
    }

    const dataRows = deduped.map(r => [
      r.symbol,
      r.side,
      String(r.qty),
      String(r.price),
      String(r.amount),
      r.orderId,
      r.time || '',
    ]);
    console.log('[PdfOcr] Fyers-specific parser: ' + dataRows.length + ' trade rows');
    return {
      headers: ['symbol', 'side', 'quantity', 'price', 'amount', 'order_id', 'time'],
      dataRows,
      broker,
      tradeDate,
      warnings,
    };
  }

  // Generic fallback for non-Fyers brokers
  const tradePattern = /^(OPTIDX|OPTSTK|FUTIDX|FUTSTK|EQ)\s+/i;
  const headers = ['symbol', 'side', 'quantity', 'price', 'amount'];
  const dataRows: string[][] = [];

  for (const line of lines) {
    if (!tradePattern.test(line)) continue;

    const symbolMatch = line.match(
      /^((?:OPTIDX|OPTSTK|FUTIDX|FUTSTK|EQ)\s+\S+\s+\S+\s+\d+\s+(?:CE|PE|FUT)\S*)/i,
    );
    let symbol = '';
    if (symbolMatch) {
      symbol = cleanSymbol(symbolMatch[1]);
    } else {
      const parts = line.split(/\s+/);
      symbol = parts.slice(0, 5).join(' ');
    }

    const hasNegativeQty = /-\d+/.test(line);
    const lastChar = line.trim().slice(-1).toUpperCase();
    let side = 'BUY';
    if (hasNegativeQty || lastChar === 'S') side = 'SELL';

    const numbers = line.match(/-?\d+\.?\d*/g) || [];
    const numericValues = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));

    let quantity = 0;
    let price = 0;
    let amount = 0;

    for (const val of numericValues) {
      const absVal = Math.abs(val);
      if (absVal > 10000 && amount === 0) amount = val;
      else if (absVal >= 1 && absVal <= 100000 && val % 1 !== 0 && price === 0) price = absVal;
      else if (absVal > 0 && absVal < 100000 && val % 1 === 0 && quantity === 0 && absVal !== 24) quantity = absVal;
    }

    if (symbol && (quantity > 0 || price > 0)) {
      dataRows.push([symbol, side, String(quantity), String(price), String(amount)]);
    }
  }

  if (dataRows.length > 0) {
    console.log('[PdfOcr] Generic OCR parser: ' + dataRows.length + ' trade rows (broker: ' + broker + ')');
  } else {
    warnings.push('OCR text did not contain recognizable trade patterns');
  }

  return { headers, dataRows, broker, tradeDate, warnings };
}
