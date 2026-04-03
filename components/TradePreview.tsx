'use client'

import type { ParseResult, StandardTrade } from '@/lib/parsers/universalParser'

interface TradePreviewProps {
  result: ParseResult
  onConfirm: () => void
  onReject: () => void
}

function fmtNum(n: number): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPnl(n: number | null): string {
  if (n == null || isNaN(n)) return '—'
  const prefix = n >= 0 ? '+' : ''
  return prefix + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TradePreview({ result, onConfirm, onReject }: TradePreviewProps) {
  const { broker, brokerName, trades, parsedCount, rawRowCount, requiresClaudeFallback } = result

  return (
    <div style={{
      background: 'var(--s1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius, 12px)',
      overflow: 'hidden',
      marginTop: 16,
    }}>
      {/* ─── Status Bar ─── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        background: 'rgba(255,255,255,.02)',
      }}>
        {broker !== 'generic' && broker !== 'image' && broker !== 'pdf' && !requiresClaudeFallback && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
            ✓ Detected: {brokerName}
          </span>
        )}
        {broker === 'generic' && !requiresClaudeFallback && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
            ⚡ Broker not listed — smart detection used
          </span>
        )}
        {requiresClaudeFallback && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue, #5b8def)' }}>
            🤖 PDF/Image — AI extraction will run
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
          {parsedCount} trades found · {rawRowCount} rows scanned
        </span>
      </div>

      {/* ─── Trade Table ─── */}
      {trades.length > 0 && (
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,.03)' }}>
                {['#', 'Date', 'Symbol', 'Type', 'Qty', 'Price', 'P&L'].map(h => (
                  <th key={h} style={{
                    padding: '8px 10px',
                    textAlign: h === '#' || h === 'Qty' || h === 'Price' || h === 'P&L' ? 'right' : 'left',
                    fontWeight: 700,
                    fontSize: 10,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    position: 'sticky',
                    top: 0,
                    background: 'var(--s1)',
                    zIndex: 1,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t: StandardTrade, i: number) => (
                <tr key={i} style={{
                  borderBottom: '1px solid var(--border)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--s2, rgba(255,255,255,.02))',
                }}>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text2, #ccc)' }}>{t.date}{t.time ? ` ${t.time}` : ''}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600, fontSize: 11, color: 'var(--text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.symbol}</td>
                  <td style={{ padding: '7px 10px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 9,
                      fontWeight: 700,
                      background: t.tradeType === 'BUY' ? 'rgba(54,211,153,.15)' : t.tradeType === 'SELL' ? 'rgba(240,93,108,.15)' : 'rgba(150,150,150,.15)',
                      color: t.tradeType === 'BUY' ? 'var(--green)' : t.tradeType === 'SELL' ? 'var(--red)' : 'var(--muted)',
                    }}>{t.tradeType}</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{t.quantity}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{fmtNum(t.price)}</td>
                  <td style={{
                    padding: '7px 10px',
                    textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.pnl === null ? 'var(--muted)' : t.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>{fmtPnl(t.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── No trades message for Claude fallback ─── */}
      {trades.length === 0 && requiresClaudeFallback && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted2, #888)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>
          <div style={{ fontSize: 13 }}>AI will extract trades from your file during analysis</div>
        </div>
      )}

      {/* ─── Bottom Row ─── */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 400 }}>
          If something looks wrong, your file may need column headers matching standard formats.
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, padding: '8px 16px' }}
            onClick={onReject}
          >
            ✕ Re-upload
          </button>
          <button
            className="btn btn-accent"
            style={{ fontSize: 12, padding: '8px 20px' }}
            onClick={onConfirm}
          >
            ✓ Looks Good — Run Analysis →
          </button>
        </div>
      </div>
    </div>
  )
}
