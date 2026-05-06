"use client";

import { useState, useRef, useCallback } from "react";
import { useAnalysisStore } from "@/lib/analysisStore";
import { useRazorpay } from "@/hooks/useRazorpay";
import { usePlanStore } from "@/lib/planStore";
import { useUser } from "@clerk/nextjs";
import { showToast } from "@/components/ui/Toast";

interface TradeDetailProps {
  activeTrade?: number;
  freeLimit?: number;
}

// Renders **bold** as weight-500 span, not browser-bold <strong>
function parseMarkdownBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, idx) => {
    if (idx % 2 === 0) return part;
    return <span key={idx} style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{part}</span>;
  });
}

// Tag badge config — colours defined via CSS variables in style tag

function getTagStyling(tag?: string): { bg: string; color: string; label: string } {
  switch (tag?.toLowerCase()) {
    case "win": return { bg: "var(--tag-win-bg)",  color: "var(--tag-win-text)",  label: "Win"  };
    case "fomo":return { bg: "var(--tag-fomo-bg)", color: "var(--tag-fomo-text)", label: "FOMO" };
    case "rvg": return { bg: "var(--tag-rvg-bg)",  color: "var(--tag-rvg-text)",  label: "RVG"  };
    case "avg": return { bg: "var(--tag-avg-bg)",  color: "var(--tag-avg-text)",  label: "AVG"  };
    case "pnc": return { bg: "var(--tag-pnc-bg)",  color: "var(--tag-pnc-text)",  label: "PNC"  };
    case "vs":  return { bg: "var(--tag-vs-bg)",   color: "var(--tag-vs-text)",   label: "VS"   };
    default:    return { bg: "var(--tag-def-bg)",  color: "var(--tag-def-text)",  label: tag || "" };
  }
}

function getSideBadgeStyle(side: string): React.CSSProperties {
  const isBuy = side?.toUpperCase() === "BUY";
  return {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 4,
    fontFamily: "var(--font-sans)",
    fontWeight: 400,
    background: isBuy ? "rgba(29,158,117,.1)" : "rgba(192,57,43,.1)",
    color: isBuy ? "var(--color-profit)" : "var(--color-loss)",
  };
}

const CYCLE_STAGES = [
  "Disciplined Win","Overconfidence","Larger Position","Market Goes Against",
  "Hope & Hold","Averaging Down","Panic Exit","Revenge Trade","Decision Fatigue","FOMO Re-entry",
];

export default function TradeDetail({ activeTrade: _activeTrade, freeLimit = 3 }: TradeDetailProps) {
  const { trades, sessionId } = useAnalysisStore();
  const { pay, loading: payLoading } = useRazorpay();
  const setPlan = usePlanStore((s) => s.setPlan);
  const { user } = useUser();
  const [expandedTradeIndex, setExpandedTradeIndex] = useState<number>(0);
  const [deepDiveOpen, setDeepDiveOpen] = useState<Record<number, boolean>>({});
  const [tradeNotes, setTradeNotes] = useState<Record<number, string>>({});
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Direct-to-Razorpay upgrade for the locked-trade overlay (matches the
  // Top-Issue card pattern in app/dashboard/page.tsx).
  const openCheckout = useCallback(() => {
    if (payLoading) return;
    pay({
      plan: "pro_monthly",
      email: user?.primaryEmailAddress?.emailAddress,
      onSuccess: () => {
        setPlan("pro_monthly");
        showToast.success("Payment successful. All trades unlocked.");
      },
      onError: (err) => {
        showToast.error(err || "Payment failed. Please try again.");
      },
    });
  }, [pay, payLoading, setPlan, user]);

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

  const formatPnl = (pnl: number): string => {
    const sign = pnl > 0 ? "+" : pnl < 0 ? "-" : "";
    return `${sign}₹${Math.abs(Math.round(pnl)).toLocaleString("en-IN")}`;
  };

  const formatPrice = (price: number): string => {
    if (!price) return "—";
    return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTimeGap = (currentIdx: number): string | null => {
    if (currentIdx === 0) return null;
    const prev = trades[currentIdx - 1];
    const curr = trades[currentIdx];
    if (!prev?.exit_time || !curr?.entry_time) return null;
    try {
      const [ph, pm] = prev.exit_time.split(":").map(Number);
      const [ch, cm] = curr.entry_time.split(":").map(Number);
      const diffMin = (ch * 60 + cm) - (ph * 60 + pm);
      if (diffMin <= 0) return null;
      if (diffMin < 60) return `${diffMin}m gap`;
      return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m gap`;
    } catch { return null; }
  };

  const getCumulativePnl = (idx: number): number =>
    trades.slice(0, idx + 1).reduce((s, t) => s + t.pnl, 0);

  const getPrevMomentum = (idx: number): { wins: number; losses: number; streak: string } => {
    const prev = trades.slice(Math.max(0, idx - 5), idx);
    const wins = prev.filter((t) => t.pnl > 0).length;
    const losses = prev.filter((t) => t.pnl <= 0).length;
    let streak = "";
    if (prev.length > 0) {
      let count = 1;
      const last = prev[prev.length - 1]?.pnl > 0 ? "W" : "L";
      for (let i = prev.length - 2; i >= 0; i--) {
        if ((prev[i]?.pnl > 0 ? "W" : "L") === last) count++;
        else break;
      }
      streak = `${count}${last}`;
    }
    return { wins, losses, streak };
  };

  if (trades.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
        No trades to display
      </div>
    );
  }

  return (
    <>
      {/* Tag badge colour tokens */}
      <style>{`:root{
        --tag-win-bg:rgba(29,158,117,.12);--tag-win-text:var(--color-profit);
        --tag-fomo-bg:rgba(184,123,43,.12);--tag-fomo-text:var(--gold);
        --tag-rvg-bg:rgba(192,57,43,.12);--tag-rvg-text:var(--color-loss);
        --tag-avg-bg:rgba(192,57,43,.12);--tag-avg-text:var(--color-loss);
        --tag-pnc-bg:rgba(91,75,138,.12);--tag-pnc-text:var(--purple);
        --tag-vs-bg:rgba(192,107,40,.12);--tag-vs-text:var(--orange);
        --tag-def-bg:rgba(136,135,128,.1);--tag-def-text:var(--color-muted);
      }`}</style>

      <div className="flex-1 overflow-y-auto space-y-4">
        {trades.map((trade, idx) => {
          const locked = isLocked(idx);
          const isExpanded = expandedTradeIndex === idx;
          const tagStyle = getTagStyling(trade.tag);
          const timeGap = getTimeGap(idx);
          const cumPnl = getCumulativePnl(idx);
          const prevMomentum = getPrevMomentum(idx);
          const isDeepDive = deepDiveOpen[idx] || false;

          return (
            <div key={idx}>
              {timeGap && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: 'var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
                    {timeGap}
                  </span>
                </div>
              )}

              <div
                onClick={() => !locked && setExpandedTradeIndex(isExpanded ? -1 : idx)}
                style={{
                  background: '#FFFFFF',
                  border: `0.5px solid ${isExpanded ? 'var(--color-ink)' : 'var(--color-border)'}`,
                  borderRadius: 10,
                  padding: 14,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.6 : 1,
                  transition: 'border-color 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)' }}>#{idx + 1}</div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)', marginTop: 1 }}>{trade.entry_time}</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'var(--color-border)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {trade.symbol}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={getSideBadgeStyle(trade.side)}>{trade.side?.toUpperCase()}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                          &times;{trade.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 500, color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                        {formatPnl(trade.pnl)}
                      </div>
                      {trade.tag && (
                        <span style={{
                          display: 'inline-block',
                          fontSize: 10,
                          padding: '1px 7px',
                          borderRadius: 4,
                          marginTop: 3,
                          fontFamily: 'var(--font-sans)',
                          fontWeight: 400,
                          background: tagStyle.bg,
                          color: tagStyle.color,
                        }}>
                          {tagStyle.label}
                        </span>
                      )}
                    </div>
                    {locked && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', border: '0.5px solid var(--color-border)', padding: '2px 6px', borderRadius: 4 }}>
                        Locked
                      </span>
                    )}
                    <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{isExpanded ? "▾" : "▸"}</span>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              <div style={{ overflow: 'hidden', transition: 'max-height 0.3s ease', maxHeight: isExpanded ? 4000 : 0, opacity: isExpanded ? 1 : 0 }}>
                <div style={{
                  background: '#FFFFFF',
                  border: '0.5px solid var(--color-border)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  padding: '16px 14px',
                  position: 'relative',
                }}>
                  {/* Prices grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'var(--color-canvas)',
                    marginBottom: 14,
                  }}>
                    {[
                      { label: 'Entry',      value: formatPrice(trade.entry_price) },
                      { label: 'Exit',       value: formatPrice(trade.exit_price)  },
                      { label: 'Qty',        value: String(trade.quantity)         },
                      { label: 'Gross P&L',  value: formatPnl(trade.pnl),          color: trade.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' },
                      { label: 'Cumulative', value: formatPnl(cumPnl),             color: cumPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color: color || 'var(--color-ink)' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Momentum */}
                  {idx > 0 && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 6, background: 'var(--color-canvas)' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>Previous trades momentum</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-profit)' }}>{prevMomentum.wins}W</span>
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-loss)' }}>{prevMomentum.losses}L</span>
                        {prevMomentum.streak && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
                            {prevMomentum.streak} streak
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 3 }}>
                          {trades.slice(Math.max(0, idx - 5), idx).map((t, i) => (
                            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: t.pnl > 0 ? 'var(--color-profit)' : 'var(--color-loss)', opacity: 0.7 }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI coaching sections */}
                  {trade.quick_summary && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>Summary</p>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-ink)', lineHeight: 1.6 }}>
                        {parseMarkdownBold(trade.quick_summary)}
                      </div>
                      {trade.cycle_stage && (
                        <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, padding: '1px 7px', borderRadius: 4, background: 'var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}>
                          Cycle: {trade.cycle_stage}
                        </span>
                      )}
                    </div>
                  )}

                  {trade.psychology_coaching && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>Psychology</p>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-ink)', lineHeight: 1.6 }}>
                        {parseMarkdownBold(trade.psychology_coaching)}
                      </div>
                    </div>
                  )}

                  {trade.counterfactual && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>Recommended action</p>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-ink)', lineHeight: 1.6 }}>
                        {parseMarkdownBold(trade.counterfactual)}
                      </div>
                    </div>
                  )}

                  {/* Deep dive toggle */}
                  {trade.technical_analysis && (
                    <div style={{ textAlign: 'center', margin: '10px 0' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeepDiveOpen((p) => ({ ...p, [idx]: !p[idx] })); }}
                        style={{
                          fontSize: 12,
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--color-muted)',
                          background: 'transparent',
                          border: '0.5px solid var(--color-border)',
                          borderRadius: 6,
                          padding: '4px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        {isDeepDive ? 'Hide deep dive' : 'Show deep dive'}
                      </button>
                    </div>
                  )}

                  {isDeepDive && trade.technical_analysis && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--color-border)' }}>
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>Technical analysis</p>
                        <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-ink)', lineHeight: 1.6 }}>
                          {parseMarkdownBold(trade.technical_analysis)}
                        </div>
                      </div>

                      {trade.cycle_stage && (
                        <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--color-canvas)', marginBottom: 10 }}>
                          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>Vicious cycle position</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {CYCLE_STAGES.map((label) => {
                              const isActive = trade.cycle_stage?.toLowerCase().includes(label.toLowerCase());
                              return (
                                <span key={label} style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontFamily: 'var(--font-sans)',
                                  fontWeight: isActive ? 500 : 400,
                                  background: isActive ? 'rgba(192,57,43,.08)' : 'var(--color-border)',
                                  color: isActive ? 'var(--color-loss)' : 'var(--color-muted)',
                                  border: isActive ? '0.5px solid rgba(192,57,43,.25)' : '0.5px solid transparent',
                                  opacity: isActive ? 1 : 0.6,
                                }}>
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                      Your reflection
                    </label>
                    <p style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
                      What were you thinking? How did this trade feel?
                    </p>
                    <textarea
                      disabled={locked}
                      placeholder="Notes for this trade..."
                      value={tradeNotes[idx] || ""}
                      onChange={(e) => { setTradeNotes({ ...tradeNotes, [idx]: e.target.value }); saveNote(idx, e.target.value); }}
                      rows={3}
                      style={{
                        width: '100%',
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--color-ink)',
                        background: 'var(--color-canvas)',
                        border: '0.5px solid var(--color-border)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: 1.6,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Locked overlay — clickable, opens Razorpay for pro_monthly directly. */}
                  {locked && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openCheckout(); }}
                      disabled={payLoading}
                      aria-label="Upgrade to unlock full trade analysis"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '0 0 10px 10px',
                        background: 'rgba(248,246,241,.88)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        padding: 0,
                        cursor: payLoading ? 'wait' : 'pointer',
                        opacity: payLoading ? 0.7 : 1,
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--color-ink)', marginBottom: 6 }}>
                          {payLoading ? 'Opening payment…' : 'Upgrade to unlock'}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', margin: 0 }}>
                          Full trade analysis is available on paid plans.
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
