'use client';

import { useAnalysisStore } from '@/lib/analysisStore';

export default function ViciousCycle() {
  const { analysis } = useAnalysisStore();

  if (!analysis?.vicious_cycle || analysis.vicious_cycle.length === 0) {
    return null;
  }

  return (
    <>
      {/* Stage colour tokens — scoped inline to avoid modifying globals.css */}
      <style>{`:root{
        --vc-active-bg:#FCEBEB;--vc-active-border:#F09595;--vc-active-text:#A32D2D;
        --vc-inactive-bg:#F1EFE8;--vc-inactive-text:#888780
      }`}</style>

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {analysis.vicious_cycle.map((cycle, idx) => {
            const isActive = cycle.count > 0;
            return (
              <div
                key={idx}
                style={{
                  borderRadius: 10,
                  padding: '12px',
                  background: isActive ? 'var(--vc-active-bg)' : 'var(--vc-inactive-bg)',
                  border: isActive
                    ? '0.5px solid var(--vc-active-border)'
                    : '0.5px solid var(--color-border)',
                }}
              >
                {/* Stage name */}
                <div style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  color: isActive ? 'var(--vc-active-text)' : 'var(--vc-inactive-text)',
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}>
                  {cycle.stage}
                </div>

                {/* Count */}
                <div style={{
                  fontSize: 22,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  color: isActive ? 'var(--vc-active-text)' : 'var(--vc-inactive-text)',
                  marginBottom: 8,
                  lineHeight: 1,
                }}>
                  {cycle.count}
                </div>

                {/* Proportional bar */}
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,.08)', overflow: 'hidden', marginBottom: 8 }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 2,
                      background: isActive ? 'var(--vc-active-text)' : 'var(--vc-inactive-text)',
                      width: `${Math.min(cycle.count * 10, 100)}%`,
                      opacity: isActive ? 0.6 : 0.3,
                      transition: 'width 0.6s ease-out',
                    }}
                  />
                </div>

                {/* Description */}
                <p style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  color: isActive ? 'var(--vc-active-text)' : 'var(--vc-inactive-text)',
                  opacity: isActive ? 0.8 : 0.7,
                  lineHeight: 1.4,
                  margin: 0,
                }}>
                  {cycle.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
