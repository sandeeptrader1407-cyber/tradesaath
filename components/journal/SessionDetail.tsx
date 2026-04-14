"use client"

import { useState } from "react"
import { formatPnl } from "@/lib/format/money"

interface Trade {
  // Accept both naming conventions:
  // - AI extraction (Claude) returns: entry_time, exit_time, entry_price, exit_price, quantity
  // - Local parser returns:           time,       (no exit_time), entry, exit,         qty
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

export default function SessionDetail({ session }: Props) {
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null)

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Select a session to view details</p>
        </div>
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

  const getTagColor = (tag?: string) => {
    switch (tag?.toLowerCase()) {
      case "win": return { bg: "rgba(62,232,196,.15)", color: "var(--green)" }
      case "fomo": return { bg: "rgba(255,193,7,.15)", color: "var(--gold)" }
      case "rvg": return { bg: "rgba(245,151,192,.15)", color: "#f597c0" }
      case "avg": return { bg: "rgba(240,93,108,.15)", color: "var(--red)" }
      default: return { bg: "var(--s3)", color: "var(--text2)" }
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
            {session.trade_date || "Session"}
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {session.detected_market || "NSE"} &middot; {session.trade_count || trades.length} trades
          </p>
        </div>
        <div className="font-jetbrains-mono font-bold text-xl" style={{ color: Number(session.net_pnl) >= 0 ? "var(--green)" : "var(--red)" }}>
          {formatPnl(Number(session.net_pnl || 0))}
        </div>
      </div>

      {/* Trade Timeline */}
      {trades.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: "var(--muted)" }}>No trade data available for this session</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: "var(--border)" }} />

          {trades.map((trade, idx) => {
            const tagStyle = getTagColor(trade.tag)
            const displayTime = trade.entry_time || trade.time || `#${idx + 1}`
            const displayQty = trade.quantity ?? trade.qty
            const entryPrice = trade.entry_price ?? trade.entry
            const exitPrice = trade.exit_price ?? trade.exit
            const hasAIAnalysis = !!(trade.quick_summary || trade.psychology_coaching || trade.technical_analysis || trade.counterfactual || trade.cycle_stage)

            return (
              <div key={idx} className="relative mb-4 last:mb-0">
                {/* Dot */}
                <div
                  className="absolute -left-4 top-3 w-3 h-3 rounded-full border-2"
                  style={{
                    background: trade.pnl >= 0 ? "var(--green)" : "var(--red)",
                    borderColor: "var(--s1)",
                  }}
                />

                <div
                  className="rounded-lg border ml-2 cursor-pointer transition-all"
                  style={{ background: "var(--s1)", borderColor: expandedTrade === idx ? "var(--accent)" : "var(--border)" }}
                  onClick={() => setExpandedTrade(expandedTrade === idx ? null : idx)}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-jetbrains-mono" style={{ color: "var(--muted)" }}>
                        {displayTime}
                      </span>
                      <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{trade.symbol}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: trade.side?.toUpperCase() === "BUY" ? "rgba(62,232,196,.15)" : "rgba(240,93,108,.15)",
                          color: trade.side?.toUpperCase() === "BUY" ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {trade.side?.toUpperCase()}
                      </span>
                      {displayQty !== undefined && (
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>&times;{displayQty}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {trade.tag && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: tagStyle.bg, color: tagStyle.color }}>
                          {trade.tag_label || trade.tag}
                        </span>
                      )}
                      <span className="text-xs font-jetbrains-mono font-bold" style={{ color: trade.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                        {formatPnl(trade.pnl)}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                        {expandedTrade === idx ? "\u25B2" : "\u25BC"}
                      </span>
                    </div>
                  </div>

                  {/* Quick summary always visible if available */}
                  {trade.quick_summary && expandedTrade !== idx && (
                    <div className="px-3 pb-2">
                      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>
                        {trade.quick_summary}
                      </p>
                    </div>
                  )}

                  {/* Expanded view — ALWAYS render when expanded so the click is responsive */}
                  {expandedTrade === idx && (
                    <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: "var(--border)" }}>
                      {/* Trade details — always shown */}
                      <div className="pt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                        {entryPrice !== undefined && entryPrice !== 0 && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Entry</span>
                            <span className="font-jetbrains-mono" style={{ color: "var(--text)" }}>&#8377;{entryPrice.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {exitPrice !== undefined && exitPrice !== 0 && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Exit</span>
                            <span className="font-jetbrains-mono" style={{ color: "var(--text)" }}>&#8377;{exitPrice.toLocaleString("en-IN")}</span>
                          </div>
                        )}
                        {displayQty !== undefined && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Quantity</span>
                            <span className="font-jetbrains-mono" style={{ color: "var(--text)" }}>{displayQty}</span>
                          </div>
                        )}
                        {trade.exit_time && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Exit Time</span>
                            <span className="font-jetbrains-mono" style={{ color: "var(--text)" }}>{trade.exit_time}</span>
                          </div>
                        )}
                        {trade.session && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--muted)" }}>Session</span>
                            <span style={{ color: "var(--text)" }}>{trade.session}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span style={{ color: "var(--muted)" }}>Net P&amp;L</span>
                          <span className="font-jetbrains-mono font-bold" style={{ color: trade.pnl >= 0 ? "var(--green)" : "var(--red)" }}>{formatPnl(trade.pnl)}</span>
                        </div>
                      </div>

                      {/* AI analysis — only if available */}
                      {trade.quick_summary && (
                        <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                          <p className="text-[11px] font-bold mb-1 mt-2" style={{ color: "var(--accent)" }}>Summary</p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>{trade.quick_summary}</p>
                        </div>
                      )}
                      {trade.psychology_coaching && (
                        <div>
                          <p className="text-[11px] font-bold mb-1" style={{ color: "var(--gold)" }}>Psychology Coaching</p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>{trade.psychology_coaching}</p>
                        </div>
                      )}
                      {trade.technical_analysis && (
                        <div>
                          <p className="text-[11px] font-bold mb-1" style={{ color: "var(--blue, #60a5fa)" }}>Technical Analysis</p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>{trade.technical_analysis}</p>
                        </div>
                      )}
                      {trade.counterfactual && (
                        <div>
                          <p className="text-[11px] font-bold mb-1" style={{ color: "var(--green)" }}>What If</p>
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text2)" }}>{trade.counterfactual}</p>
                        </div>
                      )}
                      {trade.cycle_stage && (
                        <div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--s3)", color: "var(--text2)" }}>
                            Cycle: {trade.cycle_stage}
                          </span>
                        </div>
                      )}

                      {/* If no AI analysis, tell the user why */}
                      {!hasAIAnalysis && (
                        <div className="pt-2 border-t text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                          AI psychology and technical analysis weren&apos;t generated for this session. Re-upload the file to run analysis.
                        </div>
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
