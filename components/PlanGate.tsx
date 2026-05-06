'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { usePlan, usePlanStore } from '@/lib/planStore'
import { useRazorpay } from '@/hooks/useRazorpay'
import { showToast } from '@/components/ui/Toast'

interface PlanGateProps {
  required: 'paid' | 'pro'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PlanGate({ required, children, fallback }: PlanGateProps) {
  const { isPaid, isPro, loading } = usePlan()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (required === 'paid' && !isPaid) {
    return <>{fallback || <UpgradePrompt plan="single" />}</>
  }
  if (required === 'pro' && !isPro) {
    return <>{fallback || <UpgradePrompt plan="pro" />}</>
  }

  return <>{children}</>
}

function UpgradePrompt({ plan }: { plan: string }) {
  // J3: direct-to-Razorpay (was `<a href="/#pricing">` which routed
  // free users back to the marketing homepage anchor — same bug fixed
  // in /coach (H1) and /settings (H2) earlier today).
  const { pay, loading: payLoading } = useRazorpay()
  const setPlan = usePlanStore((s) => s.setPlan)
  const { user } = useUser()

  const openCheckout = useCallback(() => {
    if (payLoading) return
    pay({
      plan: 'pro_monthly',
      email: user?.primaryEmailAddress?.emailAddress,
      onSuccess: () => {
        setPlan('pro_monthly')
        showToast.success('Welcome to Pro! Feature unlocked.')
      },
      onError: (err) => showToast.error(err || 'Payment failed.'),
    })
  }, [pay, payLoading, setPlan, user])

  return (
    <div className="text-center py-20 px-5">
      <div className="text-5xl mb-4">&#x1F512;</div>
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: 'var(--text)', fontFamily: "'Fraunces', serif" }}
      >
        {plan === 'pro' ? 'Pro Feature' : 'Paid Feature'}
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text2)' }}>
        {plan === 'pro'
          ? 'Saathi requires a Pro subscription. Upgrade to access daily, weekly, and monthly improvement plans.'
          : 'This feature requires a paid plan. Unlock with a Single Report or Pro subscription.'}
      </p>
      <button
        type="button"
        onClick={openCheckout}
        disabled={payLoading}
        className="inline-flex px-6 py-3 rounded-lg font-semibold text-sm transition-all"
        style={{
          background: 'var(--accent)',
          color: '#071a15',
          border: 'none',
          cursor: payLoading ? 'wait' : 'pointer',
          opacity: payLoading ? 0.7 : 1,
        }}
      >
        {payLoading ? 'Opening payment…' : 'Upgrade to Pro · ₹799/mo'}
      </button>
      <div className="mt-3">
        <Link
          href="/pricing"
          className="text-xs"
          style={{
            color: 'var(--color-muted)',
            textDecoration: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        >
          View all plans &rarr;
        </Link>
      </div>
    </div>
  )
}
