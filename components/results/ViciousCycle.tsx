'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

export default function ViciousCycle() {
  const { analysis } = useAnalysisStore();

  if (!analysis?.vicious_cycle || analysis.vicious_cycle.length === 0) {
    return null;
  }

  const getTopBorderColor = (stage: string): string => {
    if (stage.includes('Win')) return 'var(--green)';
    if (stage.includes('Overconfidence') || stage.includes('FOMO')) return 'var(--gold)';
    if (stage.includes('Against') || stage.includes('Hope')) return 'var(--orange)';
    if (stage.includes('Averaging') || stage.includes('Panic')) return 'var(--red)';
    if (stage.includes('Revenge')) return '#e879a0';
    return 'var(--muted)';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-fraunces text-[var(--text)]">
          🔄 Vicious Cycle Detector
        </h2>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[var(--accent)] bg-opacity-20 text-[var(--accent)]">
          FREE
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {analysis.vicious_cycle.map((cycle, idx) => {
          const borderColor = getTopBorderColor(cycle.stage);
          const isDimmed = cycle.count === 0;

          return (
            <div
              key={idx}
              className={`rounded-lg bg-[var(--s2)] p-3 border-t-[3px] transition-opacity ${isDimmed ? 'opacity-40' : ''}`}
              style={{ borderTopColor: borderColor }}
            >
              {/* Icon + Stage Name */}
              <div className="flex items-start gap-2 mb-3">
                <span className="text-lg">{cycle.icon}</span>
                <span className="text-xs font-outfit text-[var(--text)] leading-tight flex-1">
                  {cycle.stage}
                </span>
              </div>

              {/* Count (Large) */}
              <div className="mb-3">
                <span className="text-2xl font-jetbrains-mono font-bold text-[var(--text)]">
                  {cycle.count}
                </span>
              </div>

              {/* Proportional Bar */}
              <div className="mb-3 w-full h-1 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all ease-out"
                  style={{
                    backgroundColor: borderColor,
                    width: `${Math.min(cycle.count * 10, 100)}%`,
                  }}
                />
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--text2)] leading-snug">
                {cycle.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
