'use client'

import Link from 'next/link'

export default function FinalCTA() {
  return (
    <section className="ts-final">
      <svg className="ts-float-candle" style={{ left: '8%', top: '20%' }} width="40" height="60" viewBox="0 0 40 60">
        <line x1="20" y1="6" x2="20" y2="54" stroke="var(--profit)" strokeWidth="1" />
        <rect x="14" y="14" width="12" height="32" fill="var(--profit)" />
      </svg>
      <svg
        className="ts-float-candle"
        style={{ left: '12%', top: '60%', animationDelay: '2s' }}
        width="36"
        height="50"
        viewBox="0 0 36 50"
      >
        <line x1="18" y1="4" x2="18" y2="46" stroke="var(--loss)" strokeWidth="1" />
        <rect x="12" y="12" width="12" height="28" fill="var(--loss)" />
      </svg>
      <svg
        className="ts-float-candle"
        style={{ right: '10%', top: '25%', animationDelay: '1s' }}
        width="40"
        height="55"
        viewBox="0 0 40 55"
      >
        <line x1="20" y1="4" x2="20" y2="50" stroke="var(--profit)" strokeWidth="1" />
        <rect x="14" y="10" width="12" height="36" fill="var(--profit)" />
      </svg>
      <svg
        className="ts-float-candle"
        style={{ right: '14%', top: '65%', animationDelay: '3s' }}
        width="36"
        height="48"
        viewBox="0 0 36 48"
      >
        <line x1="18" y1="6" x2="18" y2="44" stroke="var(--loss)" strokeWidth="1" />
        <rect x="12" y="14" width="12" height="26" fill="var(--loss)" />
      </svg>

      <div className="ts-container">
        <h2 className="ts-final-h2">
          Your next trade
          <br />
          is already decided.
        </h2>
        <p className="ts-final-p">Find out what&apos;s deciding it. Drop your file. Take 60 seconds.</p>
        <div className="ts-final-ctas">
          <Link href="/upload" className="final-btn final-btn-primary">Drop your file →</Link>
          <Link href="/results" className="final-btn final-btn-ghost">See sample report</Link>
        </div>
        <div className="ts-disclaimer">
          TradeSaath is not a SEBI-registered investment advisor, research analyst, or financial advisor. All
          analysis is for educational purposes only — based on your past trades, not market predictions. Past
          performance does not guarantee future returns.
        </div>
      </div>

      <style jsx>{`
        .ts-final {
          background: var(--void);
          color: var(--ink);
          text-align: center;
          padding: 120px 0;
          position: relative;
          overflow: hidden;
          font-family: var(--font-sans);
        }
        .ts-final::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 50% 40% at 50% 50%, rgba(232, 121, 43, 0.06), transparent 60%);
          pointer-events: none;
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 2;
        }
        .ts-final-h2 {
          font-family: var(--font-display);
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 60px;
          color: var(--ink);
        }
        .ts-final-p {
          margin-top: 18px;
          color: var(--mute);
          font-size: 17px;
        }
        .ts-final-ctas {
          margin-top: 34px;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        :global(.final-btn) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: 10px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.15s ease, color 0.15s ease;
          font-family: var(--font-sans);
        }
        :global(.final-btn:hover) {
          transform: translateY(-1px);
        }
        :global(.final-btn-primary) {
          background: var(--signal);
          color: #16202e;
          box-shadow: 0 8px 24px -8px rgba(232, 121, 43, 0.45);
        }
        :global(.final-btn-primary:hover) {
          box-shadow: 0 14px 32px -8px rgba(232, 121, 43, 0.6);
        }
        :global(.final-btn-ghost) {
          border-color: var(--line);
          color: var(--mute);
          background: transparent;
        }
        :global(.final-btn-ghost:hover) {
          border-color: var(--mute);
          color: var(--ink);
        }
        :global(.final-btn:focus-visible) {
          outline: 2px solid var(--ts-signal-dk);
          outline-offset: 3px;
        }
        .ts-disclaimer {
          margin-top: 60px;
          color: var(--mute);
          font-size: 11.5px;
          max-width: 680px;
          margin-left: auto;
          margin-right: auto;
          line-height: 1.6;
        }
        .ts-float-candle {
          position: absolute;
          opacity: 0.18;
          pointer-events: none;
          animation: ts-floatY 7s ease-in-out infinite;
        }
        @keyframes ts-floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ts-float-candle { animation: none; }
        }
        @media (max-width: 880px) {
          .ts-final { padding: 60px 0; }
          .ts-final-h2 {
            font-size: 36px;
          }
        }
      `}</style>
    </section>
  )
}
