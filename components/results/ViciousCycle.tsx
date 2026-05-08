'use client';

import { useAnalysisStore } from '@/lib/analysisStore';
import CyclePipeline from './CyclePipeline';

export default function ViciousCycle() {
  const { analysis } = useAnalysisStore();

  if (!analysis?.vicious_cycle || analysis.vicious_cycle.length === 0) {
    return null;
  }

  return (
    <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--color-ink)' }}>
            Vicious Cycle Detector
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

        <CyclePipeline mode="aggregate" stages={analysis.vicious_cycle} />
      </div>
  );
}
