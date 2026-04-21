'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePlanStore } from '@/lib/planStore'
import { showToast } from '@/components/ui/Toast'

interface CouponInputProps {
  /** Called after a successful redemption (e.g. close paywall, navigate). */
  onSuccess?: (info: { plan: string; durationDays: number }) => void
  /** Compact = single-line link style for nav banners. */
  compact?: boolean
  /** Optional className for the wrapper. */
  className?: string
}

export default function CouponInput({ onSuccess, compact = false, className }: CouponInputProps) {
  const { isSignedIn } = useUser()
  const refreshPlan = usePlanStore((s) => s.refreshPlan)
  const [open, setOpen] = useState(!compact)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (loading) return
    setError(null)
    setSuccess(null)

    if (!isSignedIn) {
      window.location.href = '/sign-in'
      return
    }

    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter a code')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Invalid or expired coupon code'
        setError(msg)
        showToast.error(msg)
        return
      }

      const days = Number(data.durationDays) || 0
      const okMsg = `Pro plan activated for ${days} days.`
      showToast.success(okMsg)
      setSuccess(okMsg)
      setCode('')
      refreshPlan()
      if (onSuccess) onSuccess({ plan: String(data.plan), durationDays: days })
    } catch {
      const msg = 'Something went wrong. Please try again.'
      setError(msg)
      showToast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        Have a coupon? Redeem here
      </button>
    )
  }

  return (
    <form onSubmit={submit} className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 360 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Have a coupon code?</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
          disabled={loading}
          autoCapitalize="characters"
          spellCheck={false}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--s1)',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#071a15',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !code.trim() ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '…' : 'Apply'}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: '#fca5a5',
            background: 'rgba(239,68,68,.12)',
            border: '1px solid rgba(239,68,68,.3)',
            padding: '6px 10px',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          {'\u26A0 '}{error}
        </div>
      )}
      {success && (
        <div
          role="status"
          style={{
            fontSize: 12,
            color: 'var(--accent)',
            background: 'rgba(62,232,196,.1)',
            border: '1px solid rgba(62,232,196,.3)',
            padding: '6px 10px',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {'\u2713 '}{success}
        </div>
      )}
    </form>
  )
}
