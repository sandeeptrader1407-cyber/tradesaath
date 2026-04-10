'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

export default function KPIStrip() {
  const kpis = useAnalysisStore((s) => s.kpis);

  if (!kpis) return null;

  const fmt = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}\u20B9${Math.abs(Math.round(val)).toLocaleString('en-IN')}`;
  };
  const fmtAbs = (val: number) => `\u20B9${Math.abs(Math.round(val)).toLocaleString('en-IN')}`;

  const metrics = [
    { label: 'Net P&L', value: fmt(kpis.net_pnl), pos: kpis.net_pnl >= 0 },
    { label: 'Trades', value: String(kpis.total_trades), pos: true },
    { label: 'Winners', value: String(kpis.wins), pos: true },
    { label: 'Losers', value: String(kpis.losses), pos: false },
    { label: 'Win Rate', value: `${(kpis.win_rate ?? 0).toFixed(2)}%`, pos: (kpis.win_rate ?? 0) >= 50 },
    { label: 'Profit Factor', value: (kpis.profit_factor ?? 0).toFixed(2), pos: (kpis.profit_factor ?? 0) > 1 },
    { label: 'Best Trade', value: fmt(kpis.best_trade_pnl), pos: true },
    { label: 'Worst Trade', value: fmtAbs(kpis.worst_trade_pnl), pos: false },
    { label: 'Buy Value', value: fmtAbs(kpis.buy_value ?? 0), pos: true },
    { label: 'Sell Value', value: fmtAbs(kpis.sell_value ?? 0), pos: true },
  ];

  return (
    <div className="space-y-3">
      {/* Main KPI row */}
      <div className="overflow-x-auto">
        <div className="flex flex-nowrap gap-3 pb-2">
          {metrics.map((m, i) => (
            <div key={i} className="inline-flex flex-col flex-shrink-0 w-32 p-3 rounded-lg border bg-[var(--s1)] border-[var(--border)]">
              <div className={`text-[17px] font-bold font-jetbrains-mono ${m.pos ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {m.value}
              </div>
              <div className="text-[9px] uppercase tracking-widest mt-1 text-[var(--text2)]">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gross Profit / Gross Loss row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-lg border bg-[var(--s1)] border-[var(--border)]">
          <div className="text-[9px] uppercase tracking-widest text-[var(--text2)] mb-1">Gross Profit</div>
          <div className="text-xl font-bold font-jetbrains-mono text-[var(--green)]">+{fmtAbs(kpis.gross_profit ?? 0)}</div>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--s1)] border-[var(--border)]">
          <div className="text-[9px] uppercase tracking-widest text-[var(--text2)] mb-1">Gross Loss</div>
          <div className="text-xl font-bold font-jetbrains-mono text-[var(--red)]">{fmtAbs(kpis.gross_loss ?? 0)}</div>
        </div>
      </div>
    </div>
  );
}
