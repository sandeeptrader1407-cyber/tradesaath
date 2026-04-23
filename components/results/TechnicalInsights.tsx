'use client';

import { useAnalysisStore } from '@/lib/analysisStore';
import { useEffect, useState } from 'react';

export default function TechnicalInsights() {
  const { analysis } = useAnalysisStore();
  const [animated, setAnimated] = useState(false);

  useEffect(() => { setAnimated(true); }, []);

  if (!analysis?.technical_insights || analysis.technical_insights.length === 0) {
    return null;
  }

  const barColor = (score: number) => {
    if (score < 40) return 'var(--color-loss)';
    if (score <= 60) return 'var(--color-muted)';
    return 'var(--color-profit)';
  };

  return (
    <div style={{ borderRadius: 10, border: '0.5px solid var(--color-border)', background: '#FFFFFF', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--color-ink)' }}>
          Technical Insights
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

      <div className="space-y-5">
        {analysis.technical_insights.map((insight, idx) => (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: 'var(--color-ink)' }}>
                {insight.name}
              </span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-muted)' }}>
                {insight.score}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  background: barColor(insight.score),
                  width: animated ? `${insight.score}%` : '0%',
                  transition: 'width 0.8s ease-out',
                }}
              />
            </div>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginTop: 6, lineHeight: 1.6 }}>
              {insight.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
