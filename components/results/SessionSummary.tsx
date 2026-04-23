'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

// Renders **bold** as weight-500 span, not browser-bold <strong>
function parseMarkdownBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, idx) => {
    if (idx % 2 === 0) return part;
    return <span key={idx} style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{part}</span>;
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
    <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--color-ink)' }}>
          AI Session Summary
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
        <div style={{
          fontSize: 14,
          fontFamily: 'var(--font-sans)',
          color: '#444441',
          lineHeight: 1.7,
        }}>
          {parseMarkdownBold(analysis.session_summary)}
        </div>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: '12px 20px',
        background: 'var(--color-surface-raised, #F8F6F1)',
        borderTop: '0.5px solid var(--color-border)',
      }}>
        {[
          { label: 'Gross P&L', value: `${isPos ? '+' : ''}₹${Math.abs(kpis.net_pnl ?? 0).toLocaleString('en-IN')}`, color: isPos ? 'var(--color-profit)' : 'var(--color-loss)' },
          { label: 'W/L Ratio', value: wl,    color: 'var(--color-ink)' },
          { label: 'Win Rate',  value: `${wr}%`, color: 'var(--color-ink)' },
          { label: 'P.Factor',  value: pf,    color: 'var(--color-ink)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'var(--color-muted)', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color, fontSize: 14, marginTop: 1 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
