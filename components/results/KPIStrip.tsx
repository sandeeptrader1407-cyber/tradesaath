'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

export default function KPIStrip() {
  const kpis = useAnalysisStore((s) => s.kpis);

  if (!kpis) return null;

  const safe = (v: number) => (Number.isFinite(v) ? v : 0);
  const fmt = (val: number) => {
    const v = safe(val);
    const sign = v > 0 ? '+' : v < 0 ? '-' : '';
    return `${sign}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
  };
  const fmtAbs = (val: number) => `₹${Math.abs(Math.round(safe(val))).toLocaleString('en-IN')}`;

  const metrics = [
    { label: 'Gross P&L',     value: fmt(kpis.net_pnl),                           signed: true,  num: kpis.net_pnl },
    { label: 'Trades',        value: String(kpis.total_trades),                    signed: false, num: 1 },
    { label: 'Winners',       value: String(kpis.wins),                            signed: false, num: 1 },
    { label: 'Losers',        value: String(kpis.losses),                          signed: false, num: -1 },
    { label: 'Win Rate',      value: `${(kpis.win_rate ?? 0).toFixed(2)}%`,        signed: true,  num: kpis.win_rate - 50 },
    { label: 'Profit Factor', value: (kpis.profit_factor ?? 0).toFixed(2),         signed: true,  num: (kpis.profit_factor ?? 0) - 1 },
    { label: 'Best Trade',    value: fmt(kpis.best_trade_pnl),                     signed: false, num: 1 },
    { label: 'Worst Trade',   value: fmtAbs(kpis.worst_trade_pnl),                 signed: false, num: -1 },
    { label: 'Buy Value',     value: fmtAbs(kpis.buy_value ?? 0),                  signed: false, num: 0 },
    { label: 'Sell Value',    value: fmtAbs(kpis.sell_value ?? 0),                 signed: false, num: 0 },
  ];

  function valueColor(signed: boolean, num: number): string {
    if (!signed) return 'var(--color-ink)';
    if (num > 0) return 'var(--color-profit)';
    if (num < 0) return 'var(--color-loss)';
    return 'var(--color-ink)';
  }

  const cardStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    flexShrink: 0,
    width: 128,
    padding: '10px 12px',
    borderRadius: 10,
    background: '#FFFFFF',
    border: '0.5px solid var(--color-border)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'var(--font-sans)',
    fontWeight: 400,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--color-muted)',
    marginBottom: 4,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--color-ink)' }}>
          Session KPIs
        </h2>
        <span style={{
          display: 'inline-block',
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

      {/* Main KPI row */}
      <div className="overflow-x-auto">
        <div className="flex flex-nowrap gap-3 pb-2">
          {metrics.map((m) => (
            <div key={m.label} style={cardStyle}>
              <div style={labelStyle}>{m.label}</div>
              <div style={{
                fontSize: 22,
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                color: valueColor(m.signed, m.num),
                lineHeight: 1.1,
              }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}>
        Excludes brokerage, STT &amp; other charges
      </div>

      {/* Gross Profit / Gross Loss */}
      <div className="grid grid-cols-2 gap-3">
        <div style={{ ...cardStyle, width: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={labelStyle}>Gross Profit</div>
          <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-profit)' }}>
            +{fmtAbs(kpis.gross_profit ?? 0)}
          </div>
        </div>
        <div style={{ ...cardStyle, width: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={labelStyle}>Gross Loss</div>
          <div style={{ fontSize: 20, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-loss)' }}>
            {fmtAbs(kpis.gross_loss ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
