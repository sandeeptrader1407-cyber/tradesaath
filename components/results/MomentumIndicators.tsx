'use client';

import { useAnalysisStore } from '@/lib/analysisStore';
import { useEffect, useState } from 'react';

export default function MomentumIndicators() {
  const { analysis } = useAnalysisStore();
  const [animationTriggered, setAnimationTriggered] = useState(false);

  useEffect(() => {
    setAnimationTriggered(true);
  }, []);

  if (!analysis?.momentum_indicators || analysis.momentum_indicators.length === 0) {
    return null;
  }

  const getBarColor = (score: number) => {
    if (score < 40) return 'var(--red)';
    if (score <= 60) return 'var(--gold)';
    return 'var(--accent)';
  };

  return (
    <div className="rounded-xl border bg-[var(--s1)] border-[var(--border)] p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-fraunces text-[var(--text)]">
          📊 Session Momentum Indicators
        </h2>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent)] bg-opacity-20 text-[var(--accent)]">
          FREE
        </span>
      </div>

      <div className="space-y-5">
        {analysis.momentum_indicators.map((indicator, idx) => (
          <div key={idx}>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-outfit text-[var(--text)]">
                {indicator.name}
              </span>
              <span className="text-sm font-jetbrains-mono font-semibold text-[var(--text2)]">
                {indicator.score}%
              </span>
            </div>

            <div
              className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden"
              style={{ backgroundColor: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full transition-all ease-out"
                style={{
                  backgroundColor: getBarColor(indicator.score),
                  width: animationTriggered ? `${indicator.score}%` : '0%',
                  transitionDuration: '0.8s',
                }}
              />
            </div>

            <p className="text-xs text-[var(--text2)] mt-2 leading-relaxed">
              {indicator.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
