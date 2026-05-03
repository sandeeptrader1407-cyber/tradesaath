'use client'

export default function HowItWorks() {
  return (
    <section className="ts-how" id="how">
      <div className="ts-container">
        <div className="ts-how-head">
          <span className="ts-pill ts-pill-light">
            <span className="ts-pill-dot ts-pill-dot-orange" />
            HOW IT WORKS
          </span>
          <h2 className="ts-how-h2">Upload once. Know everything.</h2>
          <p className="ts-how-sub">
            Works with statements from any global broker — stocks, options, futures, forex, or crypto.
          </p>
        </div>

        <div className="ts-steps">
          <div className="ts-step">
            <div className="ts-step-icon">
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="28" height="36" rx="3" stroke="#0c1322" strokeWidth="1.5" />
                <path d="M14 18h16M14 24h16M14 30h10" stroke="#7a8093" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="34" cy="34" r="8" fill="#ff7a00" />
                <path d="M30 34l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ts-step-num">01</div>
            <h3 className="ts-step-h3">Drop your statement</h3>
            <p className="ts-step-p">
              PDF, CSV, or Excel from any broker — Interactive Brokers, Robinhood, Binance, Zerodha, MetaTrader,
              anything. Auto-detected. Takes under 10 seconds.
            </p>
          </div>

          <div className="ts-step">
            <div className="ts-step-icon">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="22" cy="22" r="14" stroke="#0c1322" strokeWidth="1.5" />
                <path d="M32 32l8 8" stroke="#0c1322" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="22" cy="22" r="7" fill="#f05d6c" />
                <path d="M19 22l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ts-step-num">02</div>
            <h3 className="ts-step-h3">We find the psychology</h3>
            <p className="ts-step-p">
              Revenge entries after stops. Averaging into losers. Oversized positions on news days. Every
              behavioural pattern is tagged, counted, and costed.
            </p>
          </div>

          <div className="ts-step">
            <div className="ts-step-icon">
              <svg viewBox="0 0 48 48" fill="none">
                <path d="M6 38L14 28L22 32L30 18L40 22" stroke="#0c1322" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="14" cy="28" r="2.5" fill="#36d399" />
                <circle cx="22" cy="32" r="2.5" fill="#36d399" />
                <circle cx="30" cy="18" r="2.5" fill="#36d399" />
                <circle cx="40" cy="22" r="2.5" fill="#36d399" />
                <path d="M40 22L40 12L36 12" stroke="#36d399" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="ts-step-num">03</div>
            <h3 className="ts-step-h3">You get the plan</h3>
            <p className="ts-step-p">
              Your Decision Quality Score out of 100. Your top 3 leaks ranked by money lost. A specific fix for
              each one — based on your actual trades, not generic advice.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ts-how {
          padding: 120px 0 90px;
          background: #f7f7f3;
          font-family: var(--font-dm-sans);
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .ts-how-head {
          text-align: center;
          margin-bottom: 60px;
        }
        .ts-pill-light {
          color: #7a8093 !important;
          border-color: #e7e8ea !important;
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
        }
        .ts-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: #36d399;
          box-shadow: 0 0 0 4px rgba(54, 211, 153, 0.15);
        }
        .ts-pill-dot-orange {
          background: #ff7a00;
          box-shadow: 0 0 0 4px rgba(255, 122, 0, 0.15);
        }
        .ts-how-h2 {
          font-family: var(--font-dm-serif);
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 56px;
          margin-top: 18px;
          color: #0c1322;
        }
        .ts-how-sub {
          color: #7a8093;
          margin-top: 14px;
          font-size: 16px;
        }
        .ts-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 50px;
        }
        .ts-step {
          background: #fff;
          border: 1px solid #e7e8ea;
          border-radius: 18px;
          padding: 32px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .ts-step:hover {
          transform: translateY(-3px);
          box-shadow: 0 24px 50px -25px rgba(12, 19, 34, 0.18);
          border-color: #d4d6da;
        }
        .ts-step-icon {
          position: absolute;
          right: 24px;
          top: 24px;
          width: 48px;
          height: 48px;
          opacity: 0.85;
        }
        .ts-step-icon svg {
          width: 100%;
          height: 100%;
        }
        .ts-step-num {
          font-family: var(--font-dm-mono);
          color: #7a8093;
          font-size: 13px;
          background: #f0f1f3;
          display: inline-block;
          width: 34px;
          height: 34px;
          border-radius: 99px;
          line-height: 34px;
          text-align: center;
          margin-bottom: 18px;
          position: relative;
          z-index: 2;
        }
        .ts-step-h3 {
          font-family: var(--font-dm-serif);
          font-weight: 400;
          font-size: 22px;
          margin: 0 0 10px;
          color: #0c1322;
          position: relative;
          z-index: 2;
        }
        .ts-step-p {
          color: #7a8093;
          font-size: 14.5px;
          line-height: 1.6;
          margin: 0;
          position: relative;
          z-index: 2;
        }
        @media (max-width: 880px) {
          .ts-steps {
            grid-template-columns: 1fr;
          }
          .ts-how-h2 {
            font-size: 36px;
          }
        }
      `}</style>
    </section>
  )
}
