'use client'

import Link from 'next/link'
import { PLANS } from '@/lib/config/pricing'
import {
  CURRENCY_SYMBOL,
  SUPPORTED_CURRENCIES,
  useCurrency,
  type Currency,
} from '@/lib/contexts/CurrencyContext'

interface PriceTable {
  free: Record<Currency, string>
  single: Record<Currency, string>
  proMonthly: Record<Currency, string>
  proYearly: Record<Currency, string>
}

/**
 * Display prices per currency.
 * - INR values are derived from the canonical paise-based PLANS config.
 * - USD/EUR/GBP are static reference conversions (mirroring v5 reference).
 *   Razorpay still settles in INR; the disclaimer line below makes that explicit.
 */
const PRICES: PriceTable = {
  free:        { USD: '0',    EUR: '0',    GBP: '0',    INR: '0' },
  single:      { USD: '1.20', EUR: '1.10', GBP: '0.95', INR: String(PLANS.single.price / 100) },
  proMonthly:  { USD: '9.99', EUR: '8.99', GBP: '7.99', INR: String(PLANS.pro_monthly.price / 100) },
  proYearly:   { USD: '74',   EUR: '68',   GBP: '59',   INR: '5,988' },
}

function fmt(c: Currency, amount: string): string {
  if (amount === '0') return `${CURRENCY_SYMBOL[c]}0`
  return `${CURRENCY_SYMBOL[c]}${amount}`
}

export default function PricingSection() {
  const { currency, setCurrency, hydrated } = useCurrency()

  return (
    <section className="ts-pricing" id="pricing">
      <div className="ts-container">
        <div className="ts-pricing-head">
          <span className="ts-pill ts-pill-light">
            <span className="ts-pill-dot ts-pill-dot-orange" />
            SIMPLE PRICING
          </span>
          <h2 className="ts-pricing-h2">Start free. Pay when you grow.</h2>
          <p className="ts-pricing-sub">No card for the first analysis. Cancel anytime.</p>

          <div className="ts-currency-toggle" role="tablist" aria-label="Currency">
            {SUPPORTED_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={currency === c}
                className={currency === c ? 'ts-on' : ''}
                onClick={() => setCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {hydrated && (
            <div className="ts-geo-hint">
              <span className="ts-pin">📍</span>
              Showing prices in <span className="ts-currency-name">{currency}</span> · click toggle to override
            </div>
          )}
        </div>

        <div className="ts-price-grid">
          {/* FREE */}
          <div className="ts-price-card">
            <span className="ts-badge ts-badge-free">Free</span>
            <div className="ts-amt">{fmt(currency, PRICES.free[currency])}</div>
            <div className="ts-billed">Free forever · no card required</div>
            <hr />
            <ul>
              <li>One full analysis, fully unlocked</li>
              <li>Universal broker file parser</li>
              <li>Local KPIs · P&amp;L · win rate</li>
              <li>Vicious-cycle detection</li>
              <li>3 deep trade insights</li>
            </ul>
            <Link href="/upload" className="ts-cta">Start free →</Link>
          </div>

          {/* SINGLE / STARTER */}
          <div className="ts-price-card">
            <span className="ts-badge ts-badge-single">Starter</span>
            <div className="ts-amt">
              {fmt(currency, PRICES.single[currency])}
              <sub>once</sub>
            </div>
            <div className="ts-billed">One-time · unlocks past sessions + 50 future analyses</div>
            <hr />
            <ul>
              <li>Everything in Free</li>
              <li>50 deep AI analyses</li>
              <li>Past session backfill</li>
              <li>DQS sub-scores breakdown</li>
              <li>Email support</li>
            </ul>
            <Link href="/pricing?plan=single" className="ts-cta">Get Starter →</Link>
          </div>

          {/* PRO MONTHLY */}
          <div className="ts-price-card ts-price-card-featured">
            <span className="ts-badge ts-badge-pro">Pro</span>
            <div className="ts-amt">
              {fmt(currency, PRICES.proMonthly[currency])}
              <sub>/month</sub>
            </div>
            <div className="ts-billed">
              or <span>{fmt(currency, PRICES.proYearly[currency])}</span>/year —{' '}
              <span className="ts-save">save 38%</span>
            </div>
            <hr />
            <ul>
              <li>Everything in Starter</li>
              <li>Unlimited deep AI analyses</li>
              <li>Saathi AI coach (chat &amp; sessions)</li>
              <li>Journey timeline + narrative</li>
              <li>Behavioural insights cards</li>
              <li>Priority support</li>
            </ul>
            <Link href="/pricing?plan=pro_monthly" className="ts-cta">Go Pro →</Link>
          </div>
        </div>

        <div className="ts-pricing-foot">
          All plans billed in INR via Razorpay · prices shown in your currency for reference
        </div>
      </div>

      <style jsx>{`
        .ts-pricing {
          padding: 120px 0;
          background: #f7f7f3;
          font-family: var(--font-sans);
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .ts-pricing-head {
          text-align: center;
          margin-bottom: 46px;
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
        .ts-pill-light {
          color: #7a8093 !important;
          border-color: #e7e8ea !important;
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
        .ts-pricing-h2 {
          font-family: var(--font-display);
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 56px;
          color: #0c1322;
          margin-top: 18px;
        }
        .ts-pricing-sub {
          color: #7a8093;
          margin-top: 12px;
        }
        .ts-currency-toggle {
          display: inline-flex;
          background: #fff;
          border: 1px solid #e7e8ea;
          border-radius: 99px;
          padding: 4px;
          margin-top: 24px;
          font-size: 12px;
        }
        .ts-currency-toggle button {
          border: 0;
          background: transparent;
          padding: 8px 18px;
          border-radius: 99px;
          cursor: pointer;
          font-family: var(--font-mono);
          letter-spacing: 0.04em;
          color: #7a8093;
          transition: color 0.15s, background 0.15s;
        }
        .ts-currency-toggle button.ts-on {
          background: #0c1322;
          color: #fff;
        }
        .ts-currency-toggle button:not(.ts-on):hover {
          color: #0c1322;
        }
        .ts-geo-hint {
          margin: 14px auto 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: #7a8093;
          letter-spacing: 0.04em;
        }
        .ts-pin {
          font-size: 13px;
        }
        .ts-currency-name {
          color: #0c1322;
          font-weight: 500;
        }
        .ts-price-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          margin-top: 46px;
        }
        .ts-price-card {
          background: #fff;
          border: 1px solid #e7e8ea;
          border-radius: 20px;
          padding: 34px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .ts-price-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 30px 60px -25px rgba(12, 19, 34, 0.18);
          border-color: #d4d6da;
        }
        .ts-price-card-featured {
          background: linear-gradient(180deg, #fff8eb, #fff4dd);
          border-color: rgba(245, 158, 11, 0.4);
          box-shadow: 0 30px 80px -30px rgba(245, 158, 11, 0.35);
          position: relative;
        }
        .ts-price-card-featured:hover {
          box-shadow: 0 40px 100px -30px rgba(245, 158, 11, 0.45);
        }
        .ts-price-card-featured::before {
          content: 'Most loved';
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff7a00;
          color: #fff;
          padding: 5px 14px;
          border-radius: 99px;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .ts-badge {
          display: inline-block;
          font-size: 11px;
          padding: 4px 12px;
          border-radius: 99px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .ts-badge-free {
          background: #e8f7ee;
          color: #177a44;
        }
        .ts-badge-single {
          background: #eef2ff;
          color: #3a4ec1;
        }
        .ts-badge-pro {
          background: #fff0d4;
          color: #9a6a00;
        }
        .ts-amt {
          font-family: var(--font-display);
          font-size: 54px;
          line-height: 1;
          letter-spacing: -0.02em;
          color: #0c1322;
        }
        .ts-amt sub {
          font-family: var(--font-mono);
          font-size: 14px;
          color: #7a8093;
          margin-left: 6px;
          letter-spacing: 0.04em;
          vertical-align: baseline;
        }
        .ts-billed {
          font-size: 11.5px;
          color: #7a8093;
          margin-top: 10px;
          font-family: var(--font-mono);
          letter-spacing: 0.04em;
        }
        .ts-save {
          color: #177a44;
          background: rgba(54, 211, 153, 0.15);
          padding: 2px 6px;
          border-radius: 99px;
          font-size: 10px;
        }
        hr {
          border: 0;
          border-top: 1px solid #e7e8ea;
          margin: 22px 0;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0 0 26px;
        }
        li {
          font-size: 14px;
          padding: 7px 0;
          color: #0c1322;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        li::before {
          content: '✓';
          color: #36d399;
          font-weight: 700;
        }
        .ts-price-card-featured li::before {
          color: #f59e0b;
        }
        .ts-cta {
          display: block;
          text-align: center;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e7e8ea;
          font-weight: 500;
          font-size: 14px;
          background: #fff;
          color: #0c1322;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          text-decoration: none;
        }
        .ts-cta:hover {
          transform: translateY(-1px);
        }
        .ts-price-card-featured .ts-cta {
          background: #ff7a00;
          color: #fff;
          border-color: transparent;
          box-shadow: 0 8px 20px -6px rgba(255, 122, 0, 0.45);
        }
        .ts-price-card-featured .ts-cta:hover {
          box-shadow: 0 14px 28px -6px rgba(255, 122, 0, 0.6);
        }
        .ts-pricing-foot {
          margin-top: 30px;
          text-align: center;
          color: #7a8093;
          font-size: 12.5px;
          font-family: var(--font-mono);
          letter-spacing: 0.04em;
        }
        @media (max-width: 880px) {
          .ts-pricing { padding: 60px 0; }
          .ts-price-grid { grid-template-columns: 1fr; }
          .ts-pricing-h2 { font-size: 36px; }
          .ts-amt { font-size: 40px; }
          .ts-plan-card { padding: 22px; }
        }
      `}</style>
    </section>
  )
}
