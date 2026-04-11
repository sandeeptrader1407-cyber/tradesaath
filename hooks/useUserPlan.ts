'use client'

import { useState, useEffect } from 'react'

export type PlanId = 'free' | 'single' | 'pro_monthly' | 'pro_yearly'

export interface UserPlan {
  plan: PlanId
  authenticated: boolean
  loading: boolean
  /** User has paid for single report OR pro */
  isPaid: boolean
  /** User is on pro monthly or yearly */
  isPro: boolean
  /** User is on free plan */
  isFree: boolean
  /** Max trades visible per session */
  tradeLimit: number
}

const TRADE_LIMITS: Record<PlanId, number> = {
  free: 3,
  single: 99,
  pro_monthly: 99,
  pro_yearly: 99,
}

export function useUserPlan(): UserPlan {
  const [plan, setPlan] = useState<PlanId>('free')
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/plan')
      .then(r => r.json())
      .then(d => {
        setPlan((d.plan as PlanId) || 'free')
        setAuthenticated(!!d.authenticated)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly'
  const isPaid = plan !== 'free'
  const isFree = plan === 'free'

  return {
    plan,
    authenticated,
    loading,
    isPaid,
    isPro,
    isFree,
    tradeLimit: TRADE_LIMITS[plan] || 1,
  }
}
