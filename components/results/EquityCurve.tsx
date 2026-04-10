"use client";

import { useAnalysisStore } from "@/lib/analysisStore";

export default function EquityCurve() {
  const trades = useAnalysisStore((s) => s.trades);
  const kpis = useAnalysisStore((s) => s.kpis);

  if (!trades || trades.length === 0) return null;

  // Build cumulative P&L data
  let cumulative = 0;
  const data = trades.map((t, i) => {
    cumulative += t.pnl;
    return { index: i, pnl: t.pnl, cumulative, symbol: t.symbol };
  });

  const maxAbsPnl = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const barWidth = Math.max(4, Math.min(16, Math.floor(800 / trades.length) - 2));

  const formatPnl = (val: number): string => {
    const sign = val >= 0 ? "+" : "";
    return sign + "\u20B9" + Math.abs(Math.round(val)).toLocaleString("en-IN");
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-base font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
          Session Equity Curve
        </h2>
        <span className="text-[10px] px-3 py-1 rounded-full font-bold" style={{ background: "rgba(62,232,196,.12)", color: "var(--accent)" }}>
          FREE
        </span>
      </div>
      <div className="px-5 py-6">
        {/* Bar chart */}
        <div className="flex items-end gap-[2px] h-[120px] overflow-x-auto pb-2">
          {data.map((d, i) => {
            const height = Math.max(4, (Math.abs(d.pnl) / maxAbsPnl) * 100);
            return (
              <div
                key={i}
                className="flex-shrink-0 rounded-t-sm transition-all hover:opacity-80"
                style={{
                  width: barWidth,
                  height: `${height}%`,
                  background: d.pnl >= 0 ? "var(--green)" : "var(--red)",
                }}
                title={`#${i + 1} ${d.symbol}: ${formatPnl(d.pnl)}`}
              />
            );
          })}
        </div>
        {/* Labels */}
        <div className="flex justify-between mt-3 text-[10px] font-jetbrains-mono" style={{ color: "var(--muted)" }}>
          <span>Trade #1</span>
          <span>Cumulative: {formatPnl(kpis?.net_pnl ?? 0)}</span>
          <span>Trade #{trades.length}</span>
        </div>
      </div>
    </div>
  );
}
