"use client";

import { useState, useRef, useCallback } from "react";
import { useAnalysisStore } from "@/lib/analysisStore";

interface TradeDetailProps {
  activeTrade?: number;
  freeLimit?: number;
}

function parseMarkdownBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, idx) => {
    if (idx % 2 === 0) return part;
    return <strong key={idx}>{part}</strong>;
  });
}

export default function TradeDetail({ activeTrade: _activeTrade, freeLimit = 3 }: TradeDetailProps) {
  const { trades, sessionId } = useAnalysisStore();
  const [expandedTradeIndex, setExpandedTradeIndex] = useState<number>(0);
  const [deepDiveOpen, setDeepDiveOpen] = useState<Record<number, boolean>>({});
  const [tradeNotes, setTradeNotes] = useState<Record<number, string>>({});
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const saveNote = useCallback((tradeIndex: number, notes: string) => {
    if (!sessionId) return;
    if (saveTimers.current[tradeIndex]) clearTimeout(saveTimers.current[tradeIndex]);
    saveTimers.current[tradeIndex] = setTimeout(() => {
      fetch('/api/trade-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, tradeIndex, notes }),
      }).catch(() => { /* silent */ });
    }, 1000);
  }, [sessionId]);

  const isLocked = (index: number): boolean => index >= freeLimit;

  const getTagStyling = (tag?: string): { bg: string; color: string; label: string } => {
    switch (tag?.toLowerCase()) {
      case "win": return { bg: "bg-[var(--green)]", color: "text-white", label: "Win" };
      case "fomo": return { bg: "bg-[var(--gold)]", color: "text-black", label: "FOMO" };
      case "rvg": return { bg: "bg-[#f597c0]", color: "text-white", label: "RVG" };
      case "avg": return { bg: "bg-[var(--red)]", color: "text-white", label: "AVG" };
      case "pnc": return { bg: "bg-[var(--purple)]", color: "text-white", label: "PNC" };
      case "vs": return { bg: "bg-[#ff9500]", color: "text-white", label: "VS" };
      default: return { bg: "bg-[var(--s3)]", color: "text-[var(--text2)]", label: tag || "" };
    }
  };

  const getSideBadgeColor = (side: string): { bg: string; text: string } => {
    return side?.toUpperCase() === "BUY"
      ? { bg: "bg-[var(--green)]", text: "text-white" }
      : { bg: "bg-[var(--red)]", text: "text-white" };
  };

  const formatPnl = (pnl: number): string => {
    // Losses must render with an explicit minus sign, not an empty string.
    // Old bug: sign was "" for negative pnl, so a loss displayed without any sign.
    const sign = pnl > 0 ? "+" : pnl < 0 ? "-" : "";
    return `${sign}\u20B9${Math.abs(Math.round(pnl)).toLocaleString("en-IN")}`;
  };

  const formatPrice = (price: number): string => {
    if (!price) return "-";
    return `\u20B9${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTimeGap = (currentIdx: number): string | null => {
    if (currentIdx === 0) return null;
    const prevTrade = trades[currentIdx - 1];
    const currTrade = trades[currentIdx];
    if (!prevTrade?.exit_time || !currTrade?.entry_time) return null;
    try {
      const [ph, pm] = prevTrade.exit_time.split(":").map(Number);
      const [ch, cm] = currTrade.entry_time.split(":").map(Number);
      const diffMin = (ch * 60 + cm) - (ph * 60 + pm);
      if (diffMin <= 0) return null;
      if (diffMin < 60) return `${diffMin}m gap`;
      return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m gap`;
    } catch {
      return null;
    }
  };

  const getCumulativePnl = (idx: number): number => {
    return trades.slice(0, idx + 1).reduce((s, t) => s + t.pnl, 0);
  };

  const getSessionBadge = (time: string): { label: string; color: string } => {
    if (!time) return { label: "Afternoon", color: "text-[var(--red)]" };
    const hour = parseInt(time.split(":")[0], 10);
    if (hour < 12) return { label: "Morning", color: "text-[var(--green)]" };
    if (hour < 14) return { label: "Midday", color: "text-[var(--gold)]" };
    return { label: "Afternoon", color: "text-[var(--red)]" };
  };

  const getPrevTradesMomentum = (idx: number): { wins: number; losses: number; streak: string } => {
    const prev = trades.slice(Math.max(0, idx - 5), idx);
    const wins = prev.filter((t) => t.pnl > 0).length;
    const losses = prev.filter((t) => t.pnl <= 0).length;
    let streak = "";
    if (prev.length > 0) {
      let count = 1;
      const lastResult = prev[prev.length - 1]?.pnl > 0 ? "W" : "L";
      for (let i = prev.length - 2; i >= 0; i--) {
        const r = prev[i]?.pnl > 0 ? "W" : "L";
        if (r === lastResult) count++;
        else break;
      }
      streak = `${count}${lastResult} streak`;
    }
    return { wins, losses, streak };
  };

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--muted)]">
        <p>No trades to display</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4">
      {trades.map((trade, idx) => {
        const locked = isLocked(idx);
        const isExpanded = expandedTradeIndex === idx;
        const sideColors = getSideBadgeColor(trade.side);
        const tagStyling = getTagStyling(trade.tag);
        const timeGap = getTimeGap(idx);
        const cumulativePnl = getCumulativePnl(idx);
        const sessionBadge = getSessionBadge(trade.entry_time);
        const prevMomentum = getPrevTradesMomentum(idx);
        const isDeepDive = deepDiveOpen[idx] || false;

        return (
          <div key={idx}>
            {timeGap && (
              <div className="flex justify-center mb-2">
                <span className="text-[10px] px-3 py-1 rounded-full bg-[var(--s2)] text-[var(--muted)] font-jetbrains-mono">
                  {timeGap}
                </span>
              </div>
            )}

            <div
              onClick={() => !locked && setExpandedTradeIndex(isExpanded ? -1 : idx)}
              className={`bg-[var(--s1)] border border-[var(--border)] rounded-xl p-4 cursor-pointer transition-all ${locked ? "cursor-not-allowed opacity-60" : "hover:border-[var(--border2)]"}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="shrink-0">
                    <div className="text-xs font-bold text-[var(--text)]">#{idx + 1}</div>
                    <div className="text-[10px] font-jetbrains-mono text-[var(--text2)] mt-0.5">{trade.entry_time}</div>
                  </div>
                  <div className="h-8 w-px bg-[var(--border)] shrink-0"></div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--text)] truncate">{trade.symbol}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${sideColors.bg} ${sideColors.text}`}>
                        {trade.side?.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[var(--text2)]">{"\u00D7"}{trade.quantity}</span>
                      <span className={`text-[10px] ${sessionBadge.color}`}>{sessionBadge.label}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className={`font-jetbrains-mono font-bold text-xl ${trade.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {formatPnl(trade.pnl)}
                    </div>
                    {trade.tag && (
                      <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full mt-1 font-bold ${tagStyling.bg} ${tagStyling.color}`}>
                        {tagStyling.label}
                      </span>
                    )}
                  </div>
                  {locked && <span className="badge badge-pending" style={{ fontSize: 9 }}>Locked</span>}
                  <div className="text-[var(--text2)] text-lg">{isExpanded ? "\u25BE" : "\u25B8"}</div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isExpanded ? "4000px" : "0", opacity: isExpanded ? 1 : 0 }}>
              <div className={`bg-[var(--s1)] border border-t-0 border-[var(--border)] rounded-b-xl p-5 relative ${locked ? "blur-sm" : ""}`}>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5 p-3 rounded-lg bg-[var(--s2)]">
                  <div>
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Entry</div>
                    <div className="text-sm font-jetbrains-mono font-bold text-[var(--text)]">{formatPrice(trade.entry_price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Exit</div>
                    <div className="text-sm font-jetbrains-mono font-bold text-[var(--text)]">{formatPrice(trade.exit_price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Qty</div>
                    <div className="text-sm font-jetbrains-mono font-bold text-[var(--text)]">{trade.quantity}</div>
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Gross P&L</div>
                    <div className={`text-sm font-jetbrains-mono font-bold ${trade.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {formatPnl(trade.pnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Cumulative</div>
                    <div className={`text-sm font-jetbrains-mono font-bold ${cumulativePnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {formatPnl(cumulativePnl)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  <div className="p-3 rounded-lg bg-[var(--s2)]">
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Running P&L after this trade</div>
                    <div className={`text-lg font-jetbrains-mono font-bold ${cumulativePnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {formatPnl(cumulativePnl)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-1">
                      {trade.pnl >= 0 ? "\u2191" : "\u2193"} {formatPnl(trade.pnl)} from previous
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--s2)]">
                    <div className="text-[10px] sm:text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">Previous Trades Momentum</div>
                    {idx === 0 ? (
                      <div className="text-sm text-[var(--text2)]">First trade of session</div>
                    ) : (
                      <div>
                        <div className="flex gap-3 items-center">
                          <span className="text-sm font-bold text-[var(--green)]">{prevMomentum.wins}W</span>
                          <span className="text-sm font-bold text-[var(--red)]">{prevMomentum.losses}L</span>
                          {prevMomentum.streak && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--text2)]">{prevMomentum.streak}</span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {trades.slice(Math.max(0, idx - 5), idx).map((t, i) => (
                            <div key={i} className={`w-3 h-3 rounded-full ${t.pnl > 0 ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} title={formatPnl(t.pnl)}></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {trade.quick_summary && (
                  <div className="detail-section ds-ta" style={{ marginBottom: 10 }}>
                    <p className="label" style={{ marginBottom: 4 }}>Quick summary</p>
                    <div className="t-body">{parseMarkdownBold(trade.quick_summary)}</div>
                    {trade.cycle_stage && (
                      <span className="badge badge-pending" style={{ marginTop: 8, display: 'inline-block' }}>
                        Cycle: {trade.cycle_stage}
                      </span>
                    )}
                  </div>
                )}

                {trade.psychology_coaching && (
                  <div className="detail-section ds-psych" style={{ marginBottom: 10 }}>
                    <p className="label" style={{ marginBottom: 4 }}>Psychology</p>
                    <div className="t-body">{parseMarkdownBold(trade.psychology_coaching)}</div>
                  </div>
                )}

                {trade.counterfactual && (
                  <div className="detail-section ds-counter" style={{ marginBottom: 10 }}>
                    <p className="label" style={{ marginBottom: 4 }}>Recommended action</p>
                    <div className="t-body">{parseMarkdownBold(trade.counterfactual)}</div>
                  </div>
                )}

                {trade.technical_analysis && (
                  <div style={{ textAlign: 'center', margin: '12px 0' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeepDiveOpen((prev) => ({ ...prev, [idx]: !prev[idx] })); }}
                      className="deep-dive-btn"
                    >
                      {isDeepDive ? 'Hide deep dive' : 'Show deep dive'}
                    </button>
                  </div>
                )}

                {isDeepDive && trade.technical_analysis && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--color-border)' }}>
                    <div className="detail-section ds-ta" style={{ marginBottom: 10 }}>
                      <p className="label" style={{ marginBottom: 4 }}>Technical analysis</p>
                      <div className="t-body">{parseMarkdownBold(trade.technical_analysis)}</div>
                    </div>

                    {trade.cycle_stage && (
                      <div style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--s2)', border: '0.5px solid var(--color-border)', marginBottom: 10 }}>
                        <p className="label" style={{ marginBottom: 10 }}>Vicious cycle position</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {[
                            "Disciplined Win", "Overconfidence", "Larger Position",
                            "Market Goes Against", "Hope & Hold", "Averaging Down",
                            "Panic Exit", "Revenge Trade", "Decision Fatigue", "FOMO Re-entry",
                          ].map((label) => {
                            const isActive = trade.cycle_stage?.toLowerCase().includes(label.toLowerCase());
                            return (
                              <span
                                key={label}
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: 4,
                                  fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)',
                                  fontSize: 11,
                                  fontWeight: 500,
                                  background: isActive ? 'rgba(192,57,43,.08)' : 'var(--color-surface)',
                                  color: isActive ? 'var(--color-loss)' : 'var(--color-muted)',
                                  border: isActive ? '0.5px solid var(--color-loss)' : '0.5px solid var(--color-border)',
                                  opacity: isActive ? 1 : 0.5,
                                }}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <label className="label" style={{ marginBottom: 6, display: 'block' }}>Your reflection</label>
                  <p className="t-caption" style={{ marginBottom: 8 }}>What were you thinking? How did this trade feel?</p>
                  <textarea
                    disabled={locked}
                    placeholder="Notes for this trade..."
                    value={tradeNotes[idx] || ""}
                    onChange={(e) => { setTradeNotes({ ...tradeNotes, [idx]: e.target.value }); saveNote(idx, e.target.value); }}
                    className="input ctx-textarea"
                    rows={3}
                  />
                </div>

                {locked && (
                  <div className="trade-lock-overlay" style={{ borderRadius: '0 0 10px 10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: 'var(--font-dm-serif, DM Serif Display, serif)', fontSize: 18, color: 'var(--color-ink)', marginBottom: 8 }}>Upgrade to unlock.</p>
                      <p className="t-caption">Full trade analysis is available on paid plans.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
