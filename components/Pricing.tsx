'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRazorpay } from '@/hooks/useRazorpay'
import { PLANS } from '@/lib/config/pricing'
import CouponInput from '@/components/CouponInput'

export default function Pricing() {
  const [yearly, setYearly] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const { pay, loading: payLoading, testMode } = useRazorpay()
  const { isSignedIn } = useUser()

  function handleBuy(plan: string) {
    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }
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
            TEST MODE - no real charges
          </div>
        )}

        <div className="billing-toggle-row">
          <div className={`billing-pill${yearly ? ' yearly' : ''}`} role="tablist" aria-label="Billing frequency">
            <div className="billing-pill-slider" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={!yearly}
              className={`billing-pill-opt${!yearly ? ' active' : ''}`}
              onClick={() => setYearly(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={yearly}
              className={`billing-pill-opt${yearly ? ' active' : ''}`}
              onClick={() => setYearly(true)}
            >
              Yearly
            </button>
          </div>
          {yearly && <span className="save-badge">Save 38%</span>}
        </div>

        {payError && (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--red)', marginBottom: 16, padding: '10px 16px', background: 'rgba(244,63,94,.08)', borderRadius: 8, border: '1px solid rgba(244,63,94,.2)' }}>
            {payError}
          </div>
        )}

        <div className="pricing-grid">

          <div className="plan-card">
            <div className="plan-name">{PLANS.free.name}</div>
            <div className="plan-price">{PLANS.free.displayPrice}</div>
            <div className="plan-billed">{PLANS.free.description}</div>
            {isSignedIn ? (
              <a href="/upload" className="btn btn-ghost plan-cta">Go to Upload &rarr;</a>
            ) : (
              <a href="/sign-up" className="btn btn-ghost plan-cta">Start Free &rarr;</a>
            )}
            <ul className="plan-feats">
              <li>Gross P&amp;L &amp; KPIs</li>
              <li>Vicious Cycle detection</li>
              <li>3 trades full psychology</li>
              <li>Free technical insights</li>
              <li className="no">Per-trade TA &amp; coaching</li>
              <li className="no">Journal &amp; history</li>
              <li className="no">Notes feature</li>
            </ul>
          </div>

          <div className="plan-card">
            <div className="plan-name">{PLANS.single.name}</div>
            <div className="plan-price">{PLANS.single.displayPrice}</div>
            <div className="plan-billed">{PLANS.single.description}</div>
            <button
              className="btn btn-ghost plan-cta"
              disabled={payLoading}
              onClick={() => handleBuy('single')}
            >
              {payLoading ? 'Processing...' : 'Buy Report'}
            </button>
            <ul className="plan-feats">
              <li>Full session analysis (one-time)</li>
              <li>Per-trade technical breakdown</li>
              <li>Full psychology coaching</li>
              <li>Counterfactual scenarios</li>
              <li className="no">Journal &amp; history</li>
              <li className="no">Trading Journey</li>
              <li className="no">Saathi coaching</li>
            </ul>
          </div>

          <div className="plan-card" style={{ position: 'relative', border: '2px solid #3ee8c4', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f0b429', color: '#071a15', fontSize: 10, fontWeight: 600, padding: '3px 12px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace', whiteSpace: 'nowrap', zIndex: 1 }}>Most Popular</div>
            <div className="plan-name">Pro</div>
            {!yearly ? (
              <>
                <div className="plan-price">{PLANS.pro_monthly.displayPrice.replace('/mo', '')}<span>/mo</span></div>
                <div className="plan-billed">{PLANS.pro_monthly.description}</div>
              </>
            ) : (
              <>
                <div className="plan-price">{PLANS.pro_yearly.displayPrice.replace('/mo', '')}<span>/mo</span></div>
                <div className="plan-billed">{PLANS.pro_yearly.description}</div>
              </>
            )}
            <button
              className="btn btn-accent plan-cta"
              disabled={payLoading}
              onClick={() => handleBuy(yearly ? 'pro_yearly' : 'pro_monthly')}
            >
              {payLoading ? 'Processing...' : 'Get Pro Plan'}
            </button>
            <ul className="plan-feats">
              <li>Everything in Free + Single Report</li>
              <li>Unlimited sessions + history</li>
              <li>Saathi AI coaching (daily/weekly/monthly)</li>
              <li>Counterfactual scenarios</li>
              <li>Trade notes (per section)</li>
              <li>Premium journal + history</li>
              <li>Trading Journey profiling</li>
              <li>Pattern intelligence alerts</li>
              <li><strong style={{ color: 'var(--accent)' }}>Pro Dashboard</strong></li>
              <li><strong style={{ color: 'var(--accent)' }}>Saathi (daily/weekly/monthly plans)</strong></li>
              <li><strong style={{ color: 'var(--accent)' }}>Personal AI Chatbot</strong></li>
              <li>Priority support</li>
            </ul>
          </div>

        </div>

        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
          <CouponInput onSuccess={() => { window.location.href = '/dashboard' }} />
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
