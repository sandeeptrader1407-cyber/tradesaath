'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

export default function KPIStrip() {
  const kpis = useAnalysisStore((s) => s.kpis);

  if (!kpis) {
    return null;
  }

  const isNetPLPositive = (kpis.net_pnl ?? 0) >= 0;
  const isWinRatePositive = (kpis.win_rate ?? 0) >= 50;

  const metrics = [
    {
      label: 'Net P&L',
      value: kpis.net_pnl ?? 0,
      formatter: (val: number) => {
        const sign = val >= 0 ? '+' : '';
        return `${sign}₹${Math.abs(val).toLocaleString('en-IN')}`;
      },
      isPositive: isNetPLPositive,
    },
    {
      label: 'Trades',
      value: kpis.total_trades ?? 0,
      formatter: (val: number) => val.toString(),
      isPositive: true,
    },
    {
      label: 'Wins',
      value: kpis.wins ?? 0,
      formatter: (val: number) => val.toString(),
      isPositive: true,
    },
    {
      label: 'Losses',
      value: kpis.losses ?? 0,
      formatter: (val: number) => val.toString(),
      isPositive: false,
    },
    {
      label: 'Win Rate',
      value: kpis.win_rate ?? 0,
      formatter: (val: number) => `${val.toFixed(1)}%`,
      isPositive: isWinRatePositive,
    },
    {
      label: 'Profit Factor',
      value: kpis.profit_factor ?? 0,
      formatter: (val: number) => val.toFixed(2),
      isPositive: (kpis.profit_factor ?? 0) > 1,
    },
    {
      label: 'Best Trade',
      value: kpis.best_trade_pnl ?? 0,
      formatter: (val: number) => {
        const sign = val >= 0 ? '+' : '';
        return `${sign}₹${Math.abs(val).toLocaleString('en-IN')}`;
      },
      isPositive: true,
    },
    {
      label: 'Worst Trade',
      value: kpis.worst_trade_pnl ?? 0,
      formatter: (val: number) => {
        const sign = val >= 0 ? '+' : '';
        return `${sign}₹${Math.abs(val).toLocaleString('en-IN')}`;
      },
      isPositive: false,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-nowrap gap-3 pb-2">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className="inline-flex flex-col flex-shrink-0 w-32 p-3 rounded-lg border bg-[var(--s1)] border-[var(--border)]"
          >
            <div
              className={`text-[17px] font-bold font-jetbrains-mono ${
                metric.isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {metric.formatter(metric.value)}
            </div>
            <div className="text-[9px] uppercase tracking-widest mt-1 text-[var(--text2)]">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
