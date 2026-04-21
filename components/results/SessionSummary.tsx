'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

function parseMarkdownBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, idx) => {
    if (idx % 2 === 0) return part;
    return <strong key={idx}>{part}</strong>;
  });
}

export default function SessionSummary() {
  const analysis = useAnalysisStore((s) => s.analysis);
  const kpis = useAnalysisStore((s) => s.kpis);

  if (!analysis?.session_summary || !kpis) return null;

  const isPos = (kpis.net_pnl ?? 0) >= 0;
  const wl = kpis.losses && kpis.losses > 0 ? ((kpis.wins ?? 0) / kpis.losses).toFixed(2) : '—';
  const wr = (kpis.win_rate ?? 0).toFixed(1);
  const pf = (kpis.profit_factor ?? 0).toFixed(2);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--s1)', borderColor: 'var(--border)' }}>
      <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold" style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}>
          AI Session Summary
        </h2>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent)] bg-opacity-20 text-[var(--accent)]">
          FREE
        </span>
      </div>
      <div className="p-5">
        <div className="text-sm" style={{ lineHeight: 1.8, color: 'var(--text2)', fontFamily: "'Outfit', sans-serif" }}>
          {parseMarkdownBold(analysis.session_summary)}
        </div>
      </div>
      <div className="flex items-center gap-6 px-5 py-4 text-xs border-t" style={{ background: 'var(--s2)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col">
          <span style={{ color: 'var(--muted)' }}>Gross P&L</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: isPos ? 'var(--green)' : 'var(--red)' }}>
            {isPos ? '+' : ''}₹{Math.abs(kpis.net_pnl ?? 0).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex flex-col">
          <span style={{ color: 'var(--muted)' }}>W/L Ratio</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--text)' }}>{wl}</span>
        </div>
        <div className="flex flex-col">
          <span style={{ color: 'var(--muted)' }}>Win Rate</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--text)' }}>{wr}%</span>
        </div>
        <div className="flex flex-col">
          <span style={{ color: 'var(--muted)' }}>P.Factor</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--text)' }}>{pf}</span>
        </div>
      </div>
    </div>
  );
}
