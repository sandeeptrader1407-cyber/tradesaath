'use client'

import { useState } from 'react'
import { useRazorpay } from '@/hooks/useRazorpay'
import { usePlanStore } from '@/lib/planStore'
import { useUser } from '@clerk/nextjs'

export default function PaywallGate({ tradeCount }: { tradeCount: number }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const { pay, loading, paid } = useRazorpay()
  const setPlan = usePlanStore((s) => s.setPlan)
  const isPaid = usePlanStore((s) => s.isPaid)
  const { user } = useUser()

  const PLANS = [
    { name: 'Single Report', key: 'single' as const, price: '99', period: 'one-time', desc: 'all trades', badge: '' },
    { name: 'Pro Monthly', key: 'pro_monthly' as const, price: '799', period: '/month', desc: 'unlimited', badge: '' },
    { name: 'Pro Yearly', key: 'pro_yearly' as const, price: '499', period: '/month', desc: 'unlimited', badge: 'Save 38%' },
  ]

  if (isPaid() || paid) return null

  const handleUnlock = async () => {
    const plan = PLANS[selectedIdx]
    await pay({
      plan: plan.key === 'pro_monthly' ? 'pro_monthly' : plan.key === 'pro_yearly' ? 'pro_yearly' : 'single',
      email: user?.primaryEmailAddress?.emailAddress,
      onSuccess: () => {
        setPlan(plan.key as any)
        setToast({ type: 'success', msg: 'Payment successful! All trades unlocked.' })
        setTimeout(() => setToast(null), 4000)
      },
      onError: (err) => {
        setToast({ type: 'error', msg: err || 'Payment failed. Please try again.' })
        setTimeout(() => setToast(null), 4000)
      },
    })
  }

  return (
    <div className="rounded-xl p-8 border" style={{ background: 'linear-gradient(135deg, rgba(157,122,247,.08) 0%, var(--bg) 100%)', borderColor: 'var(--border)' }}>
      {toast && (
        <div className="mb-6 text-center text-sm px-4 py-3 rounded-lg" style={{ background: toast.type === 'success' ? 'rgba(54,211,153,.1)' : 'rgba(240,93,108,.1)', color: toast.type === 'success' ? 'var(--green)' : 'var(--red)', border: '1px solid ' + (toast.type === 'success' ? 'rgba(54,211,153,.2)' : 'rgba(240,93,108,.2)') }}>
          {toast.type === 'success' ? '\u2705' : '\u274C'} {toast.msg}
        </div>
      )}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}>Unlock {tradeCount - 1} More Trades</h2>
        <p className="text-sm md:text-base" style={{ color: 'var(--text2)' }}>Full psychology coaching, technical analysis, counterfactuals, and notes for every trade.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan, idx) => (
          <div key={plan.key} onClick={() => setSelectedIdx(idx)} className="rounded-xl p-5 cursor-pointer transition-all border-2" style={{ background: 'var(--s2)', borderColor: selectedIdx === idx ? 'var(--accent)' : 'var(--border2)' }}>
            {plan.badge && <div className="mb-3"><span className="inline-block px-2 py-1 rounded text-xs font-semibold" style={{ background: 'rgba(54,211,153,.15)', color: 'var(--green)' }}>{plan.badge}</span></div>}
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>{plan.name}</h3>
            <div className="mb-3">
              <span className="text-2xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>\u20B9{plan.price}</span>
              <span className="text-xs ml-1" style={{ color: 'var(--text2)' }}>{plan.period}</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>{plan.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        <button onClick={handleUnlock} disabled={loading} className="font-semibold rounded-xl px-8 py-3 transition-all" style={{ background: loading ? 'var(--s3)' : 'var(--accent)', color: loading ? 'var(--muted)' : '#0a0e17', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? '\u23F3 Processing...' : 'Unlock Full Report \u2192'}
        </button>
      </div>
    </div>
  )
}
