"use client";

import { useAnalysisStore } from "@/lib/analysisStore";

export default function EquityCurve() {
  const trades = useAnalysisStore((s) => s.trades);
  const kpis = useAnalysisStore((s) => s.kpis);

  if (!trades || trades.length === 0) return null;

  let cumulative = 0;
  const data = trades.map((t, i) => {
    cumulative += t.pnl;
    return { index: i, pnl: t.pnl, cumulative, symbol: t.symbol };
  });

  const maxAbsPnl = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  const barWidth = Math.max(4, Math.min(16, Math.floor(800 / trades.length) - 2));

  const fmt = (val: number): string => {
    const sign = val >= 0 ? "+" : "";
    return sign + "₹" + Math.abs(Math.round(val)).toLocaleString("en-IN");
  };

  return (
    <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--color-ink)' }}>
          Session Equity Curve
        </h2>
        <span style={{
          padding: '2px 10px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 400,
          fontFamily: 'var(--font-sans)',
          background: 'rgba(29,158,117,.1)',
          color: 'var(--color-profit)',
          border: '0.5px solid rgba(29,158,117,.25)',
        }}>
          FREE
        </span>
      </div>
      <div style={{ padding: '16px 20px' }}>
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
                  background: d.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)",
                }}
                title={`#${i + 1} ${d.symbol}: ${fmt(d.pnl)}`}
              />
            );
          })}
        </div>
        {/* Axis labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>Trade #1</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
            Cumulative: <span style={{ color: (kpis?.net_pnl ?? 0) >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{fmt(kpis?.net_pnl ?? 0)}</span>
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>Trade #{trades.length}</span>
        </div>
      </div>
    </div>
  );
}
