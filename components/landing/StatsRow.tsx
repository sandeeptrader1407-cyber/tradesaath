'use client'

import { useCurrency, type Currency } from '@/lib/contexts/CurrencyContext'

const MISTAKE_COST: Record<Currency, string> = {
  USD: '$340K+',
  EUR: '€310K+',
  GBP: '£270K+',
  INR: '₹2.8Cr+',
}

export default function StatsRow() {
  const { currency } = useCurrency()
  const mistakeCost = MISTAKE_COST[currency]

  return (
    <section className="ts-stats">
      <div className="ts-container">
        <div className="ts-stats-row">
          <div className="ts-stat ts-stat-amber">
            <div className="ts-stat-n">4,200+</div>
            <div className="ts-stat-l">Sessions analysed</div>
            <div className="ts-stat-spark">
              <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                <path d="M 0,18 L 10,16 L 20,14 L 30,15 L 40,11 L 50,9 L 60,7 L 70,5 L 80,3" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="ts-stat ts-stat-crimson">
            <div className="ts-stat-n">{mistakeCost}</div>
            <div className="ts-stat-l">Mistake cost found</div>
            <div className="ts-stat-spark">
              <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                <path d="M 0,20 L 10,17 L 20,18 L 30,14 L 40,12 L 50,8 L 60,9 L 70,5 L 80,3" fill="none" stroke="#f05d6c" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="ts-stat ts-stat-mint">
            <div className="ts-stat-n">21+</div>
            <div className="ts-stat-l">Brokers supported</div>
            <div className="ts-stat-spark">
              <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                <path d="M 0,22 L 10,20 L 20,18 L 30,15 L 40,14 L 50,11 L 60,8 L 70,6 L 80,4" fill="none" stroke="#36d399" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="ts-stat ts-stat-white">
            <div className="ts-stat-n">3.2×</div>
            <div className="ts-stat-l">Avg patterns per trader</div>
            <div className="ts-stat-spark">
              <svg viewBox="0 0 80 24" preserveAspectRatio="none">
                <path d="M 0,15 L 10,18 L 20,12 L 30,16 L 40,10 L 50,14 L 60,8 L 70,12 L 80,6" fill="none" stroke="#ecedef" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ts-stats {
          background: #0c1322;
          color: #ecedef;
          padding: 0 0 60px;
          position: relative;
          font-family: var(--font-dm-sans);
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .ts-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          border-top: 1px solid #1f2a44;
          padding-top: 36px;
        }
        .ts-stat {
          padding: 0 24px;
          border-right: 1px solid #1f2a44;
        }
        .ts-stat:last-child {
          border-right: none;
        }
        .ts-stat-n {
          font-family: var(--font-dm-mono);
          font-size: 32px;
          letter-spacing: 0.02em;
        }
        .ts-stat-amber .ts-stat-n { color: #f59e0b; }
        .ts-stat-crimson .ts-stat-n { color: #f05d6c; }
        .ts-stat-mint .ts-stat-n { color: #36d399; }
        .ts-stat-white .ts-stat-n { color: #fff; }
        .ts-stat-l {
          margin-top: 6px;
          font-size: 11px;
          color: #8a93a8;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .ts-stat-spark {
          position: relative;
          margin-top: 14px;
          height: 24px;
          width: 80%;
        }
        .ts-stat-spark svg {
          width: 100%;
          height: 100%;
        }
        @media (max-width: 880px) {
          .ts-stats-row {
            grid-template-columns: 1fr;
          }
          .ts-stat {
            border-right: none;
            border-bottom: 1px solid #1f2a44;
            padding: 20px 24px;
          }
          .ts-stat:last-child {
            border-bottom: none;
          }
        }
      `}</style>
    </section>
  )
}
