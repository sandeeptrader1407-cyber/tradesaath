"use client"

import { useState } from "react"
import { formatPnl } from "@/lib/format/money"

interface Trade {
  entry_time?: string
  exit_time?: string
  time?: string
  symbol: string
  side: string
  quantity?: number
  qty?: number
  entry_price?: number
  exit_price?: number
  entry?: number
  exit?: number
  pnl: number
  date?: string
  session?: string
  tag?: string
  tag_label?: string
  label?: string
  quick_summary?: string
  psychology_coaching?: string
  counterfactual?: string
  technical_analysis?: string
  cycle_stage?: string
}

interface Session {
  id: string
  trade_date: string
  detected_market: string
  trade_count: number
  net_pnl: number
  trades: Trade[] | string | null
  analysis: Record<string, unknown> | string | null
}

interface Props {
  session: Session | null
}

// Tag badge config — uses CSS variables from results components where possible
function getTagStyle(tag?: string): { bg: string; color: string } {
  switch (tag?.toLowerCase()) {
    case "win":  return { bg: 'rgba(29,158,117,.12)',  color: 'var(--color-profit)' }
    case "fomo": return { bg: 'rgba(184,123,43,.12)',  color: 'var(--gold)' }
    case "rvg":  return { bg: 'rgba(192,57,43,.12)',   color: 'var(--color-loss)' }
    case "avg":  return { bg: 'rgba(192,57,43,.12)',   color: 'var(--color-loss)' }
    case "pnc":  return { bg: 'rgba(91,75,138,.12)',   color: 'var(--purple)' }
    case "vs":   return { bg: 'rgba(192,107,40,.12)',  color: 'var(--orange)' }
    case "over": return { bg: 'rgba(192,107,40,.12)',  color: 'var(--orange)' }
    case "size": return { bg: 'rgba(192,107,40,.12)',  color: 'var(--orange)' }
    case "late": return { bg: 'rgba(15,76,129,.1)',    color: 'var(--accent)' }
    default:     return { bg: 'var(--color-border)',   color: 'var(--color-muted)' }
  }
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-sans)',
  fontWeight: 400,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-muted)',
  marginBottom: 4,
}

const sectionContentStyle: React.CSSProperties = {
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
  fontWeight: 400,
  color: '#444441',
  lineHeight: 1.7,
}

export default function SessionDetail({ session }: Props) {
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null)

  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
        <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>
          Select a session to view details
        </p>
      </div>
    )
  }

  let trades: Trade[] = []
  try {
    if (typeof session.trades === "string") {
      trades = JSON.parse(session.trades)
    } else if (Array.isArray(session.trades)) {
      trades = session.trades
    }
  } catch {
    trades = []
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Session header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 400,
            color: 'var(--color-ink)',
            marginBottom: 4,
          }}>
            {session.trade_date || "Session"}
          </h2>
          <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-muted)' }}>
            {session.detected_market || "Market"} &middot; {session.trade_count || trades.length}&nbsp;
            {((session.trade_count || trades.length) === 1) ? 'trade' : 'trades'}
          </p>
        </div>
        {/* Net P&L: DM Mono 500 24px */}
        <div style={{
          fontSize: 24,
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          color: Number(session.net_pnl) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
          lineHeight: 1,
        }}>
          {formatPnl(Number(session.net_pnl || 0))}
        </div>
      </div>

      {/* Trade Timeline */}
      {trades.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>
            No trade data available for this session
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 20 }}>
          {/* Vertical timeline line */}
          <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 1, background: 'var(--color-border)' }} />

          {trades.map((trade, idx) => {
            const tagStyle = getTagStyle(trade.tag)
            const displayTime = trade.entry_time || trade.time || `#${idx + 1}`
            const displayQty = trade.quantity ?? trade.qty
            const entryPrice = trade.entry_price ?? trade.entry
            const exitPrice  = trade.exit_price  ?? trade.exit
            const hasAI = !!(trade.quick_summary || trade.psychology_coaching || trade.technical_analysis || trade.counterfactual || trade.cycle_stage)

            return (
              <div key={idx} style={{ position: 'relative', marginBottom: 12 }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: -14,
                  top: 10,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                  border: '2px solid #FFFFFF',
                }} />

                {/* Trade card */}
                <div
                  onClick={() => setExpandedTrade(expandedTrade === idx ? null : idx)}
                  style={{
                    borderRadius: 8,
                    border: `0.5px solid ${expandedTrade === idx ? 'var(--color-ink)' : 'var(--color-border)'}`,
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    marginLeft: 4,
                    overflow: 'hidden',
                  }}
                >
                  {/* Row header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Time */}
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 400, color: 'var(--color-muted)' }}>
                        {displayTime}
                      </span>
                      {/* Symbol */}
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)' }}>
                        {trade.symbol}
                      </span>
                      {/* Side badge */}
                      <span style={{
                        fontSize: 10,
                        padding: '1px 7px',
                        borderRadius: 4,
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 400,
                        background: trade.side?.toUpperCase() === "BUY" ? 'rgba(29,158,117,.1)' : 'rgba(192,57,43,.1)',
                        color: trade.side?.toUpperCase() === "BUY" ? 'var(--color-profit)' : 'var(--color-loss)',
                      }}>
                        {trade.side?.toUpperCase()}
                      </span>
                      {/* Qty */}
                      {displayQty !== undefined && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                          &times;{displayQty}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Tag badge */}
                      {trade.tag && (
                        <span style={{
                          fontSize: 10,
                          padding: '1px 7px',
                          borderRadius: 4,
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 400,
                          background: tagStyle.bg,
                          color: tagStyle.color,
                        }}>
                          {trade.tag_label || trade.tag}
                        </span>
                      )}
                      {/* P&L */}
                      <span style={{
                        fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                        color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                      }}>
                        {formatPnl(trade.pnl)}
                      </span>
                      {/* Chevron */}
                      <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
                        {expandedTrade === idx ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Quick summary preview when collapsed */}
                  {trade.quick_summary && expandedTrade !== idx && (
                    <div style={{ padding: '0 12px 10px', borderTop: '0.5px solid var(--color-border)' }}>
                      <p style={{ ...sectionContentStyle, fontSize: 12, marginTop: 8 }}>
                        {trade.quick_summary}
                      </p>
                    </div>
                  )}

                  {/* Expanded detail */}
                  {expandedTrade === idx && (
                    <div style={{ padding: '12px', borderTop: '0.5px solid var(--color-border)' }}>
                      {/* Trade data grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px', marginBottom: 14, fontSize: 12 }}>
                        {entryPrice !== undefined && entryPrice !== 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>Entry</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>₹{entryPrice.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {exitPrice !== undefined && exitPrice !== 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>Exit</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>₹{exitPrice.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {displayQty !== undefined && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>Qty</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{displayQty}</span>
                          </div>
                        )}
                        {trade.exit_time && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>Exit time</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>{trade.exit_time}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>Net P&amp;L</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                            {formatPnl(trade.pnl)}
                          </span>
                        </div>
                      </div>

                      {/* AI sections — all use same label/content style */}
                      {trade.quick_summary && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={sectionLabelStyle}>Summary</p>
                          <p style={sectionContentStyle}>{trade.quick_summary}</p>
                        </div>
                      )}
                      {trade.psychology_coaching && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={sectionLabelStyle}>Psychology</p>
                          <p style={sectionContentStyle}>{trade.psychology_coaching}</p>
                        </div>
                      )}
                      {trade.technical_analysis && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={sectionLabelStyle}>Technical</p>
                          <p style={sectionContentStyle}>{trade.technical_analysis}</p>
                        </div>
                      )}
                      {trade.counterfactual && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={sectionLabelStyle}>Recommended action</p>
                          <p style={sectionContentStyle}>{trade.counterfactual}</p>
                        </div>
                      )}
                      {trade.cycle_stage && (
                        <div>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}>
                            Cycle: {trade.cycle_stage}
                          </span>
                        </div>
                      )}
                      {!hasAI && (
                        <p style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', paddingTop: 8, borderTop: '0.5px solid var(--color-border)' }}>
                          AI analysis was not generated for this session. Re-upload the file to run analysis.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
