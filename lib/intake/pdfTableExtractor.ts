/**
 * TradeSaath PDF Table Extractor
 * Layout-aware PDF text extraction using pdfjs (via unpdf).
 * Uses X/Y coordinates to reconstruct table rows and columns
 * from any Indian broker's contract note PDF.
 */

/** A single text item with position info from pdfjs */
interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/** A reconstructed row from coordinate-based grouping */
export interface PdfTableRow {
  /** Page number (1-based) */
  page: number;
  /** Y coordinate of this row */
  y: number;
  /** Cell values in left-to-right order */
  cells: string[];
  /** Raw text items that make up this row */
  items: PdfTextItem[];
}

/** Result of PDF table extraction */
export interface PdfExtractionResult {
  /** All text items with coordinates */
  allItems: PdfTextItem[];
  /** Reconstructed table rows (grouped by Y, sorted by X) */
  tableRows: PdfTableRow[];
  /** Full raw text (for broker/date detection) */
  rawText: string;
  /** Number of pages */
  pageCount: number;
}

/**
 * Y-tolerance for grouping text items into the same row.
 * PDF text items on the "same line" can vary by a few points.
 */
const Y_TOLERANCE = 3;

/**
 * Minimum number of cells in a row to consider it a table row.
 * Filters out headings, footers, single-value lines.
 */
const MIN_CELLS_FOR_TABLE_ROW = 3;

/**
 * Extract all text items with X/Y coordinates from a PDF buffer.
 * Uses unpdf's getDocumentProxy which gives us full pdfjs access.
 */
export async function extractPdfWithCoordinates(buffer: Buffer): Promise<PdfExtractionResult> {
  const { getDocumentProxy } = await import('unpdf');
  const uint8 = new Uint8Array(buffer);
  const doc = await getDocumentProxy(uint8);

  const allItems: PdfTextItem[] = [];
  const rawTextParts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageItems: PdfTextItem[] = [];

    for (const item of textContent.items) {
      // pdfjs items have: str, transform[4]=x, transform[5]=y, width, height
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ti = item as any;
      if (!ti.str || ti.str.trim() === '') continue;

      const x = ti.transform ? ti.transform[4] : 0;
      const y = ti.transform ? ti.transform[5] : 0;
      const width = ti.width || 0;
      const height = ti.height || ti.transform?.[0] || 10;

      pageItems.push({
        text: ti.str.trim(),
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        page: pageNum,
      });
    }

    // Sort by Y descending (PDF Y=0 is bottom), then X ascending
    pageItems.sort((a, b) => b.y - a.y || a.x - b.x);
    allItems.push(...pageItems);

    // Build raw text for this page (line by line)
    const rows = groupItemsIntoRows(pageItems);
    for (const row of rows) {
      rawTextParts.push(row.cells.join(' '));
    }
    rawTextParts.push('--- PAGE BREAK ---');
  }

  // Group ALL items into table rows
  const tableRows = groupItemsIntoRows(allItems).filter(
    row => row.cells.length >= MIN_CELLS_FOR_TABLE_ROW
  );

  console.log(`[PdfTableExtractor] Extracted ${allItems.length} text items across ${doc.numPages} pages, ${tableRows.length} table rows`);

  return {
    allItems,
    tableRows,
    rawText: rawTextParts.join('\n'),
    pageCount: doc.numPages,
  };
}

/**
 * Group text items into rows based on Y-coordinate proximity.
 * Items within Y_TOLERANCE of each other are on the same row.
 * Within each row, items are sorted left-to-right by X.
 * Adjacent items close in X are merged into one cell.
 */
function groupItemsIntoRows(items: PdfTextItem[]): PdfTableRow[] {
  if (items.length === 0) return [];

  // Sort by Y descending (top of page first in PDF coords), then X ascending
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: PdfTableRow[] = [];
  let currentRow: PdfTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  let currentPage = sorted[0].page;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    // Same row if Y is close AND same page
    if (Math.abs(item.y - currentY) <= Y_TOLERANCE && item.page === currentPage) {
      currentRow.push(item);
    } else {
      // Finish current row
      rows.push(buildRow(currentRow, currentY, currentPage));
      currentRow = [item];
      currentY = item.y;
      currentPage = item.page;
    }
  }
  // Don't forget last row
  if (currentRow.length > 0) {
    rows.push(buildRow(currentRow, currentY, currentPage));
  }

  return rows;
}

/**
 * Build a PdfTableRow from a group of items on the same Y line.
 * Merges adjacent items that are close in X into single cells.
 */
function buildRow(items: PdfTextItem[], y: number, page: number): PdfTableRow {
  // Sort left to right
  const sorted = [...items].sort((a, b) => a.x - b.x);

  // Merge adjacent items into cells
  // Two items are "adjacent" if the gap between them is small (< 5 points)
  const cells: string[] = [];
  let currentCell = sorted[0].text;
  let lastRight = sorted[0].x + sorted[0].width;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - lastRight;
    if (gap < 5) {
      // Adjacent — merge into same cell
      currentCell += (gap < 1 ? '' : ' ') + sorted[i].text;
    } else {
      // New cell
      cells.push(currentCell.trim());
      currentCell = sorted[i].text;
    }
    lastRight = sorted[i].x + sorted[i].width;
  }
  cells.push(currentCell.trim());

  return { page, y, cells, items: sorted };
}

/**
 * Detect column boundaries from table rows.
 * Finds consistent X positions across rows to identify column edges.
 * Returns sorted array of X positions that represent column left edges.
 */
export function detectColumnBoundaries(rows: PdfTableRow[]): number[] {
  if (rows.length === 0) return [];

  // Collect all unique X positions from all items
  const xPositions: number[] = [];
  for (const row of rows) {
    for (const item of row.items) {
      xPositions.push(Math.round(item.x));
    }
  }

  // Cluster X positions (within 5 points = same column)
  xPositions.sort((a, b) => a - b);
  const clusters: number[][] = [];
  let currentCluster = [xPositions[0]];

  for (let i = 1; i < xPositions.length; i++) {
    if (xPositions[i] - xPositions[i - 1] <= 5) {
      currentCluster.push(xPositions[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [xPositions[i]];
    }
  }
  clusters.push(currentCluster);

  // Take the average of each cluster as the column boundary
  // Only keep clusters that appear in at least 20% of rows (consistent columns)
  const minCount = Math.max(2, Math.floor(rows.length * 0.2));
  const boundaries = clusters
    .filter(c => c.length >= minCount)
    .map(c => Math.round(c.reduce((a, b) => a + b, 0) / c.length));

  return boundaries.sort((a, b) => a - b);
}

/**
 * Re-align rows to detected column boundaries.
 * Maps each item in a row to the nearest column, producing
 * a consistent number of cells per row.
 */
export function alignRowsToColumns(
  rows: PdfTableRow[],
  columnBoundaries: number[],
): string[][] {
  if (columnBoundaries.length === 0 || rows.length === 0) return [];

  const numCols = columnBoundaries.length;
  const result: string[][] = [];

  for (const row of rows) {
    const aligned = new Array(numCols).fill('');

    for (const item of row.items) {
      // Find nearest column boundary
      let bestCol = 0;
      let bestDist = Math.abs(item.x - columnBoundaries[0]);
      for (let c = 1; c < numCols; c++) {
        const dist = Math.abs(item.x - columnBoundaries[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = c;
        }
      }
      // Append to that column (may have multiple items per cell)
      if (aligned[bestCol]) {
        aligned[bestCol] += ' ' + item.text;
      } else {
        aligned[bestCol] = item.text;
      }
    }

    result.push(aligned);
  }

  return result;
}
