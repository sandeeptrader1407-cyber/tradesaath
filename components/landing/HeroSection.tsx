'use client'

import Link from 'next/link'
import CandleStage from './CandleStage'

export default function HeroSection() {
  return (
    <section className="ts-hero">
      <div className="ts-container">
        <div className="ts-hero-grid">
          <div>
            <span className="ts-pill">
              <span className="ts-pill-dot" />
              FOR EVERY TRADER · STOCKS · OPTIONS · FUTURES · FOREX · CRYPTO
            </span>
            <h1 className="ts-hero-h1">
              You knew it was
              <br />
              the wrong trade.
              <span className="ts-hero-accent">You took it anyway.</span>
            </h1>
            <p className="ts-hero-lede">
              TradeSaath reads your trade history from any broker, any market, anywhere. It finds the patterns
              you already feel — revenge trades, FOMO entries, panic exits — and shows you exactly what they cost.
            </p>
            <div className="ts-hero-ctas">
              <Link href="/upload" className="ts-btn ts-btn-primary">
                Drop your file →
              </Link>
              <Link href="/results" className="ts-hero-quiet-link">
                See sample report
              </Link>
            </div>

            <div className="ts-hero-facts">
              <span className="ts-hero-fact">
                <span className="ts-hero-fact-n">60s</span> to first insight
              </span>
              <span className="ts-hero-fact">
                <span className="ts-hero-fact-n">20+</span> brokers
              </span>
              <span className="ts-hero-fact">
                <span className="ts-hero-fact-n">₹0</span> first file
              </span>
            </div>
          </div>

          <CandleStage />
        </div>
      </div>

      <style jsx>{`
        .ts-hero {
          position: relative;
          background: var(--ts-void);
          color: var(--ts-ink);
          overflow: hidden;
          padding: 96px 0 110px;
          font-family: var(--font-sans);
        }
        .ts-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 40% at 80% 20%, rgba(232, 121, 43, 0.08), transparent 60%);
          pointer-events: none;
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 2;
        }
        .ts-hero-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 60px;
          align-items: center;
        }
        .ts-pill {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid var(--ts-line);
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ts-mute);
          margin-bottom: 28px;
        }
        .ts-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: var(--ts-profit);
          box-shadow: 0 0 0 4px rgba(54, 211, 153, 0.15);
        }
        .ts-hero-h1 {
          font-family: var(--font-display);
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 72px;
          line-height: 0.98;
          color: #fff;
        }
        .ts-hero-accent {
          color: var(--ts-loss);
          display: block;
        }
        .ts-hero-lede {
          margin-top: 22px;
          color: var(--ts-mute);
          font-size: 17px;
          line-height: 1.6;
          max-width: 520px;
        }
        .ts-hero-ctas {
          margin-top: 32px;
          display: flex;
          gap: 24px;
          align-items: center;
          flex-wrap: wrap;
        }
        :global(.ts-btn) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: 10px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.2s ease;
          font-family: var(--font-sans);
        }
        :global(.ts-btn:hover) {
          transform: translateY(-1px);
        }
        :global(.ts-btn-primary) {
          background: var(--ts-signal);
          color: #fff;
          box-shadow: 0 8px 24px -8px rgba(232, 121, 43, 0.45);
        }
        :global(.ts-btn-primary:hover) {
          box-shadow: 0 14px 32px -8px rgba(232, 121, 43, 0.6);
        }
        :global(.ts-btn:focus-visible),
        :global(.ts-hero-quiet-link:focus-visible) {
          outline: 2px solid var(--ts-signal);
          outline-offset: 3px;
          border-radius: 4px;
        }
        :global(.ts-hero-quiet-link) {
          font-size: 14px;
          color: var(--ts-mute);
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: var(--ts-line);
          transition: color 0.15s ease;
        }
        :global(.ts-hero-quiet-link:hover) {
          color: #fff;
        }
        .ts-hero-facts {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid var(--ts-line);
          display: flex;
          gap: 28px;
          flex-wrap: wrap;
        }
        .ts-hero-fact {
          font-size: 13px;
          color: var(--ts-mute);
        }
        .ts-hero-fact-n {
          font-family: var(--font-mono);
          color: #fff;
          font-weight: 500;
          margin-right: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.ts-btn) {
            transition: none;
          }
          :global(.ts-btn:hover) {
            transform: none;
          }
          :global(.ts-hero-quiet-link) {
            transition: none;
          }
        }
        @media (max-width: 880px) {
          .ts-hero { padding: 56px 0 64px; }
          .ts-hero-grid {
            grid-template-columns: 1fr;
          }
          .ts-hero-h1 {
            font-size: 46px;
          }
        }
      `}</style>
    </section>
  )
}
