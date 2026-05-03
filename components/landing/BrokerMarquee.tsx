'use client'

const BROKERS: readonly string[] = [
  'Robinhood',
  'eToro',
  'Saxo Bank',
  'XTB',
  'IG Markets',
  'Webull',
  'Tastytrade',
  'Alpaca',
  'Oanda',
  'Plus500',
  'Capital.com',
  'Binance',
  'Coinbase',
  'Interactive Brokers',
  'Charles Schwab',
  'Fidelity',
  'E*TRADE',
  'Zerodha',
  'Upstox',
  'Angel One',
  'Groww',
  'MetaTrader 4/5',
] as const

export default function BrokerMarquee() {
  // Duplicate the list so the CSS marquee can loop seamlessly.
  const items = [...BROKERS, ...BROKERS]

  return (
    <div className="ts-marquee">
      <div className="ts-marquee-track">
        {items.map((b, i) => (
          <span key={`${b}-${i}`}>{b}</span>
        ))}
      </div>

      <style jsx>{`
        .ts-marquee {
          background: #0c1322;
          padding: 24px 0;
          border-top: 1px solid #1f2a44;
          border-bottom: 1px solid #1f2a44;
          overflow: hidden;
          color: #8a93a8;
          font-size: 14px;
          position: relative;
          font-family: var(--font-dm-sans);
        }
        .ts-marquee::before,
        .ts-marquee::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 80px;
          z-index: 2;
          pointer-events: none;
        }
        .ts-marquee::before {
          left: 0;
          background: linear-gradient(90deg, #0c1322, transparent);
        }
        .ts-marquee::after {
          right: 0;
          background: linear-gradient(-90deg, #0c1322, transparent);
        }
        .ts-marquee-track {
          display: flex;
          gap: 48px;
          width: max-content;
          animation: ts-marq 38s linear infinite;
          padding-left: 48px;
        }
        .ts-marquee-track span {
          transition: color 0.2s;
          white-space: nowrap;
        }
        .ts-marquee-track span:hover {
          color: #fff;
        }
        @keyframes ts-marq {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
