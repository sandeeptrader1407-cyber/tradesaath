/**
 * PDF Parser for TradeSaath
 * Handles PDF trade documents from various brokers (Fyers, Kotak, etc.)
 */

import { AnyRow } from './types';
import { parseCSVText } from './csvParser';

/* ─── Parse Fyers/Indian broker order book format (PDF text) ─── */
function parseFyersOrderBook(text: string): AnyRow[] {
  const trades: AnyRow[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this is a symbol line (e.g., NIFTY26MAR22900PE, BANKNIFTY...)
    if (/^(NIFTY|BANKNIFTY|FINNIFTY|SENSEX|MIDCPNIFTY)/i.test(line) && !line.includes('Symbol')) {
      // Next line(s) should have exchange (NFO/NSE) then order details
      // PDF text format: "NFO\n27 Mar 2026 02:34:43 PMSELL\nOvernightExecutedMarket195/195₹243.26..."
      // OR inline: "NFO 27 Mar 2026 02:34:43 PMSELL OvernightExecuted..."

      // Collect next 3 lines as context (PDF extraction can split differently)
      const context = [lines[i + 1], lines[i + 2], lines[i + 3]].filter(Boolean).join(' ').trim();

      // Match pattern: date time AM/PM immediately followed by BUY/SELL
      // Then: Overnight/Intraday + Executed/Rejected + Market/Limit + qty/qty + ₹price
      const match = context.match(
        /(\d{1,2}\s+\w{3}\s+\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s*(?:AM|PM)?\s*(BUY|SELL)/i
      );

      if (!match) continue;

      const [, dateStr, timeRaw, side] = match;

      // Check if Executed (skip Rejected)
      if (/Rejected/i.test(context)) continue;
      if (!/Executed/i.test(context)) continue;

      // Extract qty/qty and price: "195/195₹243.26" or "195/195 ₹243.26"
      const qtyPriceMatch = context.match(/(\d+)\/(\d+)\s*₹?([\d,.]+)/);
      if (!qtyPriceMatch) continue;

      const tradedQty = parseInt(qtyPriceMatch[1]);
      const price = parseFloat(qtyPriceMatch[3].replace(/,/g, ''));
      if (isNaN(price) || isNaN(tradedQty) || tradedQty === 0) continue;

      // Parse time — check if AM/PM was concatenated with BUY/SELL
      const fullTimeMatch = context.match(/(\d{1,2}):(\d{2}):\d{2}\s*(AM|PM)/i);
      let hour = parseInt(fullTimeMatch?.[1] || timeRaw.split(':')[0]);
      const min = fullTimeMatch?.[2] || timeRaw.split(':')[1] || '00';
      const ampm = fullTimeMatch?.[3]?.toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      const time = `${hour.toString().padStart(2, '0')}:${min}`;

      // Format symbol nicely
      let symbol = line;
      const symMatch = line.match(/(NIFTY|BANKNIFTY|FINNIFTY|SENSEX|MIDCPNIFTY)\w*?(\d{5})(CE|PE)/i);
      if (symMatch) {
        symbol = `${symMatch[1]} ${symMatch[2]} ${symMatch[3]}`;
      }

      trades.push({
        time,
        symbol,
        side: side.toUpperCase(),
        qty: tradedQty,
        price,
        date: dateStr,
      });
    }
  }

  return trades;
}

/* ─── Parse Kotak PDF text ─── */
function parseKotakPDF(text: string): AnyRow[] {
  const trades: AnyRow[] = [];
  // Kotak PDFs have lines like:
  // "12/06/2025 14:13:21 OPTIDXNIFTY 12JUN2025CE 24750.00 - NSEDERV Buy Cash KotakSecurities 150 107.7500 16162.50 6.99 8.42"
  // OR extracted text may have varied spacing. We search for OPTIDXNIFTY patterns.

  // Normalize text: replace multiple spaces/tabs with single space
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const lines = normalized.split('\n');

  // Also try to find rows in fully concatenated text by splitting on date patterns
  // Kotak format: DD/MM/YYYY HH:MM:SS ... Buy/Sell ... Qty ... Price
  const tradeLinePattern = /(\d{2}\/\d{2}\/\d{4})\s*(\d{1,2}:\d{2}:\d{2})\s+(OPTIDX[A-Z]+\s+\d+[A-Z]+\d+(?:CE|PE)\s+[\d.]+)\s*-?\s*\w*\s*(Buy|Sell)\s+\w+\s+\w+\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i;

  // Strategy 1: Try matching complete lines
  for (const line of lines) {
    const m = line.match(tradeLinePattern);
    if (m) {
      const [, dateStr, timeStr, secName, side, qtyStr, priceStr, , chargesStr, sttStr] = m;
      const qty = parseInt(qtyStr);
      const price = parseFloat(priceStr);
      if (isNaN(qty) || isNaN(price) || qty === 0) continue;

      // Clean symbol: "OPTIDXNIFTY 12JUN2025CE 24750.00" → "NIFTY 24750 CE"
      let symbol = secName.trim();
      const symMatch = symbol.match(/OPTIDX(NIFTY|BANKNIFTY|FINNIFTY)\s*(\d+[A-Z]+\d+)(CE|PE)\s+([\d.]+)/i);
      if (symMatch) {
        symbol = `${symMatch[1]} ${symMatch[4]} ${symMatch[3]}`;
      }

      trades.push({
        time: timeStr,
        symbol,
        side: side.toUpperCase(),
        qty,
        price,
        date: dateStr,
        charges: parseFloat(chargesStr) + parseFloat(sttStr),
      });
      continue;
    }
  }

  // Strategy 2: If no complete lines matched, try flexible parsing
  // PDF extractors sometimes split across lines. Collect all text and re-split on date patterns.
  if (trades.length === 0) {
    const allText = lines.join(' ');
    // Split on date/time patterns
    const chunks = allText.split(/(?=\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/);

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      // Extract fields from each chunk
      const dtm = chunk.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2})/);
      if (!dtm) continue;

      const sideMatch = chunk.match(/\b(Buy|Sell)\b/i);
      if (!sideMatch) continue;

      const secMatch = chunk.match(/OPTIDX(NIFTY|BANKNIFTY|FINNIFTY)\s*(\d+[A-Z]*\d*)(CE|PE)\s*([\d.]+)/i);
      if (!secMatch) continue;

      // Find numbers after side: qty, price, total, charges, stt
      const afterSide = chunk.substring(chunk.indexOf(sideMatch[0]) + sideMatch[0].length);
      const numbers = afterSide.match(/[\d.]+/g);
      if (!numbers || numbers.length < 3) continue;

      // Skip "Cash" and "KotakSecurities" text — find qty (integer) and price
      let qty = 0, price = 0;
      for (let ni = 0; ni < numbers.length; ni++) {
        const n = parseFloat(numbers[ni]);
        if (Number.isInteger(n) && n >= 25 && n <= 100000 && qty === 0) {
          qty = n;
        } else if (qty > 0 && price === 0 && n > 0 && n < 1000000) {
          price = n;
          break;
        }
      }
      if (qty === 0 || price === 0) continue;

      const symbol = `${secMatch[1]} ${secMatch[4]} ${secMatch[3]}`;

      trades.push({
        time: dtm[2],
        symbol,
        side: sideMatch[1].toUpperCase(),
        qty,
        price,
        date: dtm[1],
      });
    }
  }

  if (trades.length > 0) {
    console.log(`[Parser] Kotak PDF format detected: ${trades.length} orders`);
  }
  return trades;
}

/* ─── Parse PDF buffer ─── */
export async function parsePDFBuffer(buffer: Buffer): Promise<{ text: string; rows: AnyRow[] }> {
  let fullText = '';

  // Try multiple PDF extraction methods
  // Method 1: unpdf
  try {
    const { extractText } = await import('unpdf');
    const uint8 = new Uint8Array(buffer);
    const result = await extractText(uint8);
    if (typeof result === 'string') {
      fullText = result;
    } else if (result && Array.isArray(result.text)) {
      fullText = result.text.join('\n');
    } else if (result && typeof result.text === 'string') {
      fullText = result.text;
    }
    console.log(`[Parser] unpdf extracted ${fullText.length} chars`);
  } catch (e) {
    console.error('[Parser] unpdf failed:', e instanceof Error ? e.message : e);
  }

  // Method 2: If unpdf failed or returned nothing, try pdf-parse
  if (!fullText || fullText.trim().length < 50) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
      const pdfParse = require('pdf-parse') as any;
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > fullText.trim().length) {
        fullText = data.text;
        console.log(`[Parser] pdf-parse extracted ${fullText.length} chars`);
      }
    } catch (e2) {
      console.error('[Parser] pdf-parse also failed:', e2 instanceof Error ? e2.message : e2);
    }
  }

  // Method 3: Raw buffer text scan (last resort — finds visible ASCII strings)
  if (!fullText || fullText.trim().length < 50) {
    try {
      const raw = buffer.toString('latin1');
      // Extract text between BT/ET operators (PDF text objects)
      const textMatches = raw.match(/\(([^)]+)\)/g);
      if (textMatches && textMatches.length > 10) {
        fullText = textMatches.map(m => m.slice(1, -1)).join(' ');
        console.log(`[Parser] Raw PDF text scan extracted ${fullText.length} chars`);
      }
    } catch (e3) {
      console.error('[Parser] Raw PDF scan failed:', e3 instanceof Error ? e3.message : e3);
    }
  }

  if (!fullText || fullText.trim().length < 20) {
    console.error('[Parser] All PDF extraction methods failed');
    return { text: '', rows: [] };
  }

  if (!fullText || fullText.trim().length < 50) {
    return { text: fullText, rows: [] };
  }

  // Strategy 1a: Try Kotak PDF format (OPTIDXNIFTY, Security Name, TransactionType)
  if (/kotak|OPTIDX|Security.?Name|Transaction.?Type/i.test(fullText)) {
    const kotakTrades = parseKotakPDF(fullText);
    if (kotakTrades.length > 0) {
      return { text: fullText, rows: kotakTrades };
    }
  }

  // Strategy 1b: Try Fyers/Indian broker order book format
  const fyersTrades = parseFyersOrderBook(fullText);
  if (fyersTrades.length > 0) {
    console.log(`[Parser] Fyers format detected: ${fyersTrades.length} orders`);
    return { text: fullText, rows: fyersTrades };
  }

  // Strategy 2: Try generic table parsing
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Tab-delimited
  const tabLines = lines.filter(l => l.includes('\t'));
  if (tabLines.length >= 3) {
    const rows = parseCSVText(tabLines.join('\n'));
    if (rows.length > 0) return { text: fullText, rows };
  }

  // Pipe-delimited
  const pipeLines = lines.filter(l => l.includes('|'));
  if (pipeLines.length >= 3) {
    const csvText = pipeLines.map(l => l.split('|').map(c => c.trim()).join(',')).join('\n');
    const rows = parseCSVText(csvText);
    if (rows.length > 0) return { text: fullText, rows };
  }

  // Multi-space delimited
  const spacedLines = lines.filter(l => /\s{2,}/.test(l) && l.split(/\s{2,}/).length >= 4);
  if (spacedLines.length >= 3) {
    const csvLines = spacedLines.map(l => l.split(/\s{2,}/).map(c => c.trim()).join(','));
    const rows = parseCSVText(csvLines.join('\n'));
    if (rows.length > 0) return { text: fullText, rows };
  }

  // Comma-delimited
  const commaLines = lines.filter(l => l.split(',').length >= 4);
  if (commaLines.length >= 3) {
    const rows = parseCSVText(commaLines.join('\n'));
    if (rows.length > 0) return { text: fullText, rows };
  }

  return { text: fullText, rows: [] };
}
