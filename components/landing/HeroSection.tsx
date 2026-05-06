'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import CandleStage from './CandleStage'

const SPARK_COLORS = ['#36d399', '#f59e0b', '#f05d6c', '#4c6ef5', '#ff7a00'] as const
const SPARK_COUNT = 28

export default function HeroSection() {
  const sparksRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const wrap = sparksRef.current
    if (!wrap) return
    wrap.innerHTML = ''
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = document.createElement('div')
      s.className = 'ts-spark'
      s.style.left = Math.random() * 100 + '%'
      s.style.top = Math.random() * 100 + '%'
      s.style.background = SPARK_COLORS[i % SPARK_COLORS.length]
      // Per-spark animation params via CSS vars — keyframes read these
      // so each dot drifts on its own timeline and they don't pulse in lockstep.
      s.style.setProperty('--ts-spark-scale', String(0.6 + Math.random() * 1.4))
      s.style.setProperty('--ts-spark-opacity', String(0.3 + Math.random() * 0.4))
      s.style.setProperty('--ts-spark-dx', `${(Math.random() - 0.5) * 20}px`)
      s.style.setProperty('--ts-spark-dy', `${(Math.random() - 0.5) * 24}px`)
      s.style.setProperty('--ts-spark-dur', `${6 + Math.random() * 10}s`)
      s.style.setProperty('--ts-spark-delay', `-${Math.random() * 10}s`)
      wrap.appendChild(s)
    }
  }, [])

  return (
    <section className="ts-hero">
      <div ref={sparksRef} className="ts-sparks" aria-hidden="true" />
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
              <Link href="/results" className="ts-btn ts-btn-ghost">
                See sample report
              </Link>
              <span className="ts-hero-meta">first analysis free · no signup</span>
            </div>
          </div>

          <CandleStage />
        </div>
      </div>

      <style jsx>{`
        .ts-hero {
          position: relative;
          background: #0c1322;
          color: #ecedef;
          overflow: hidden;
          padding: 96px 0 110px;
          font-family: var(--font-sans);
        }
        .ts-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(255, 122, 0, 0.08), transparent 60%),
            radial-gradient(ellipse 40% 30% at 10% 90%, rgba(76, 110, 245, 0.06), transparent 60%);
          pointer-events: none;
        }
        .ts-sparks {
          position: absolute;
          inset: 0;
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
          border: 1px solid #1f2a44;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8a93a8;
          margin-bottom: 28px;
        }
        .ts-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: #36d399;
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
          color: #f05d6c;
          display: block;
        }
        .ts-hero-lede {
          margin-top: 22px;
          color: #8a93a8;
          font-size: 17px;
          line-height: 1.6;
          max-width: 520px;
        }
        .ts-hero-ctas {
          margin-top: 32px;
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .ts-hero-meta {
          margin-left: 8px;
          font-size: 12px;
          color: #8a93a8;
          font-family: var(--font-mono);
          letter-spacing: 0.06em;
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
          background: #ff7a00;
          color: #fff;
          box-shadow: 0 8px 24px -8px rgba(255, 122, 0, 0.45);
        }
        :global(.ts-btn-primary:hover) {
          box-shadow: 0 14px 32px -8px rgba(255, 122, 0, 0.6);
        }
        :global(.ts-btn-ghost) {
          border-color: rgba(255, 255, 255, 0.18);
          color: #ecedef;
          background: transparent;
        }
        :global(.ts-btn-ghost:hover) {
          border-color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.04);
        }
        :global(.ts-btn-dark) {
          background: #0c1322;
          color: #fff;
        }
        :global(.ts-spark) {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 99px;
          opacity: var(--ts-spark-opacity, 0.55);
          transform: scale(var(--ts-spark-scale, 1));
          animation: ts-sparkDrift var(--ts-spark-dur, 8s) ease-in-out infinite;
          animation-delay: var(--ts-spark-delay, 0s);
          will-change: transform, opacity;
        }
        @keyframes ts-sparkDrift {
          0%, 100% {
            transform: translate(0, 0) scale(var(--ts-spark-scale, 1));
            opacity: var(--ts-spark-opacity, 0.55);
          }
          50% {
            transform: translate(var(--ts-spark-dx, 0), var(--ts-spark-dy, 0)) scale(calc(var(--ts-spark-scale, 1) * 1.15));
            opacity: calc(var(--ts-spark-opacity, 0.55) * 0.4);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.ts-spark) {
            animation: none;
          }
        }
        @media (max-width: 880px) {
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
