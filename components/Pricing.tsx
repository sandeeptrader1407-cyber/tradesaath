'use client'

import { useState } from 'react'
import { useRazorpay } from '@/hooks/useRazorpay'

export default function Pricing() {
  const [yearly, setYearly] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const { pay, loading: payLoading, testMode } = useRazorpay()

  function handleBuy(plan: string) {
    setPayError(null)
    pay({
      plan,
      onSuccess: () => {
        window.location.href = '/upload'
      },
      onError: (err) => setPayError(err),
    })
  }

  return (
    <section className="landing-sec" id="pricing">
      <div className="wrap">
        <div className="sec-eyebrow" style={{ textAlign: 'center' }}>Pricing</div>
        <div className="sec-title" style={{ textAlign: 'center' }}>Start free. Upgrade when ready.</div>

        {testMode && (
          <div className="test-mode-badge" style={{ margin: '0 auto 16px', width: 'fit-content' }}>
            TEST MODE — no real charges
          </div>
        )}

        <div className="billing-toggle-row">
          <span className={`bt-label${yearly ? ' dim' : ''}`}>Monthly</span>
          <div className={`toggle-track${yearly ? ' on' : ''}`} onClick={() => setYearly(!yearly)}>
            <div className="toggle-thumb"></div>
          </div>
          <span className={`bt-label${yearly ? '' : ' dim'}`}>Yearly</span>
          {yearly && <span className="save-badge">Save 38%</span>}
        </div>

        {payError && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--red)', marginBottom: 16, padding: '10px 16px', background: 'rgba(244,63,94,.08)', borderRadius: 8, border: '1px solid rgba(244,63,94,.2)' }}>
            ⚠ {payError}
          </div>
        )}

        <div className="pricing-grid">

          {/* Free */}
          <div className="plan-card">
            <div className="plan-name">Free</div>
            <div className="plan-price">₹0</div>
            <div className="plan-billed">Always free &middot; no account needed</div>
            <a href="/upload" className="btn btn-ghost plan-cta">Start Free &rarr;</a>
            <ul className="plan-feats">
              <li>Session P&amp;L &amp; KPIs</li>
              <li>Vicious Cycle detection</li>
              <li>1 trade full psychology</li>
              <li>Free technical insights</li>
              <li className="no">Per-trade TA &amp; coaching</li>
              <li className="no">Journal &amp; history</li>
              <li className="no">Notes feature</li>
            </ul>
          </div>

          {/* Single Report */}
          <div className="plan-card">
            <div className="plan-name">Single Report</div>
            <div className="plan-price">₹99</div>
            <div className="plan-billed">One-time &middot; full session analysis</div>
            <button
              className="btn btn-ghost plan-cta"
              disabled={payLoading}
              onClick={() => handleBuy('single')}
            >
              {payLoading ? '⏳ Processing...' : 'Buy Report →'}
            </button>
            <ul className="plan-feats">
              <li>All trades full analysis</li>
              <li>Deep technical analysis</li>
              <li>Full psychology coaching</li>
              <li>Counterfactual scenarios</li>
              <li className="no">Journal &amp; history</li>
              <li className="no">Trading Journey</li>
            </ul>
          </div>

          {/* Pro */}
          <div className="plan-card featured">
            <div className="plan-name">Pro</div>
            {!yearly ? (
              <>
                <div className="plan-price">₹799<span>/mo</span></div>
                <div className="plan-billed">Billed monthly &middot; cancel anytime</div>
              </>
            ) : (
              <>
                <div className="plan-price">₹499<span>/mo</span></div>
                <div className="plan-billed">Billed ₹5,988/year &middot; save 38%</div>
              </>
            )}
            <button
              className="btn btn-accent plan-cta"
              disabled={payLoading}
              onClick={() => handleBuy(yearly ? 'pro_yearly' : 'pro_monthly')}
            >
              {payLoading ? '⏳ Processing...' : 'Get Pro Plan →'}
            </button>
            <ul className="plan-feats">
              <li>Everything in Free + Single Report</li>
              <li>All trades full analysis</li>
              <li>Deep technical analysis</li>
              <li>Counterfactual scenarios</li>
              <li>Trade notes (per section)</li>
              <li>Premium journal + history</li>
              <li>Trading Journey profiling</li>
              <li>Pattern intelligence alerts</li>
              <li><strong style={{ color: 'var(--accent)' }}>📊 Pro Dashboard</strong></li>
              <li><strong style={{ color: 'var(--accent)' }}>🗺 AI Coach (daily/weekly/monthly plans)</strong></li>
              <li><strong style={{ color: 'var(--accent)' }}>💬 Personal AI Chatbot</strong></li>
              <li>Priority support</li>
            </ul>
          </div>

        </div>

        {testMode && (
          <div className="test-card-hint" style={{ marginTop: 20 }}>
            Test card: <code>4111 1111 1111 1111</code> | Expiry: any future date | CVV: any 3 digits | OTP: <code>1234</code>
          </div>
        )}
      </div>
    </section>
  )
}
