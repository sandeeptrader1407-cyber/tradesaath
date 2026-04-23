'use client'

import { useRazorpay } from '@/hooks/useRazorpay'
import { usePlanStore } from '@/lib/planStore'
import { useUser } from '@clerk/nextjs'
import { showToast } from '@/components/ui/Toast'
import { useState } from 'react'
import CouponInput from '@/components/CouponInput'

export default function PaywallGate({ tradeCount }: { tradeCount: number }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const { pay, loading, paid } = useRazorpay()
  const setPlan = usePlanStore((s) => s.setPlan)
  const isPaid = usePlanStore((s) => s.isPaid)
  const { user } = useUser()

  const PLANS = [
    { name: 'Starter',    key: 'single'      as const, price: '99',  period: 'one-time', desc: '50 sessions',  badge: '' },
    { name: 'Pro Monthly', key: 'pro_monthly' as const, price: '799', period: '/month',   desc: 'unlimited',    badge: '' },
    { name: 'Pro Yearly',  key: 'pro_yearly'  as const, price: '499', period: '/month',   desc: 'unlimited',    badge: 'Save 38%' },
  ]

  if (isPaid() || paid) return null

  const handleUnlock = async () => {
    const plan = PLANS[selectedIdx]
    await pay({
      plan: plan.key === 'pro_monthly' ? 'pro_monthly' : plan.key === 'pro_yearly' ? 'pro_yearly' : 'single',
      email: user?.primaryEmailAddress?.emailAddress,
      onSuccess: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPlan(plan.key as any)
        showToast.success('Payment successful. All trades unlocked.')
      },
      onError: (err) => {
        let msg = err || 'Payment failed. Please try again.'
        if (/verif/i.test(msg)) {
          msg = 'Payment received but verification pending. Your plan will be activated within a few minutes.'
        } else if (/network|fetch|internet/i.test(msg)) {
          msg = 'Network error. Your payment was not processed. Please try again.'
        } else if (/load.*razorpay/i.test(msg)) {
          msg = 'Could not load payment gateway. Check your internet connection and try again.'
        }
        showToast.error(msg)
      },
    })
  }

  return (
    <div style={{
      borderRadius: 10,
      padding: '32px 24px',
      border: '0.5px solid var(--color-border)',
      background: '#FFFFFF',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 8,
        }}>
          Unlock {tradeCount - 1} More Trades
        </h2>
        <p style={{ fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Full psychology coaching, technical analysis, counterfactuals, and notes for every trade.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        {PLANS.map((plan, idx) => (
          <div
            key={plan.key}
            onClick={() => setSelectedIdx(idx)}
            style={{
              borderRadius: 10,
              padding: '16px',
              cursor: 'pointer',
              border: selectedIdx === idx
                ? '0.5px solid var(--color-ink)'
                : '0.5px solid var(--color-border)',
              background: selectedIdx === idx ? 'rgba(26,31,46,.03)' : '#FFFFFF',
              transition: 'all 0.1s',
            }}
          >
            {plan.badge && (
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(29,158,117,.1)',
                  color: 'var(--color-profit)',
                  fontFamily: 'var(--font-sans)',
                  border: '0.5px solid rgba(29,158,117,.25)',
                }}>
                  {plan.badge}
                </span>
              </div>
            )}
            <div style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink)', marginBottom: 6 }}>
              {plan.name}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-ink)' }}>
                &#8377;{plan.price}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginLeft: 4 }}>
                {plan.period}
              </span>
            </div>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)' }}>{plan.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <button
          onClick={handleUnlock}
          disabled={loading}
          style={{
            padding: '10px 32px',
            borderRadius: 8,
            border: 'none',
            background: loading ? 'var(--color-border)' : 'var(--color-ink)',
            color: 'var(--color-canvas)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Processing...' : 'Unlock Full Report'}
        </button>
      </div>

      <div style={{ paddingTop: 16, borderTop: '0.5px solid var(--color-border)', display: 'flex', justifyContent: 'center' }}>
        <CouponInput />
      </div>
    </div>
  )
}
