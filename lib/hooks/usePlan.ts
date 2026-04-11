'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useEffect, useCallback } from 'react'
import { usePlanStore, PlanType } from '@/lib/planStore'

/**
 * Client-side hook that fetches the user's plan from the API,
 * caches it in planStore, and returns derived helpers.
 */
export function usePlan() {
  const { user, isLoaded } = useUser()
  const plan = usePlanStore((s) => s.plan)
  const setPlan = usePlanStore((s) => s.setPlan)
  const isPro = usePlanStore((s) => s.isPro)
  const isPaid = usePlanStore((s) => s.isPaid)
  const tradeLimit = usePlanStore((s) => s.tradeLimit)
  const [loading, setLoading] = useState(true)
  const [fetched, setFetched] = useState(false)

  const fetchPlan = useCallback(() => {
    setLoading(true)
    fetch('/api/user/plan')
      .then((r) => r.json())
      .then((data) => {
        const p = (data.plan || 'free') as PlanType
        setPlan(p)
        setFetched(true)
        setLoading(false)
      })
      .catch(() => {
        setPlan('free')
        setLoading(false)
      })
  }, [setPlan])

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      setPlan('free')
      setLoading(false)
      return
    }

    // Only fetch once per session (unless refreshPlan is called)
    if (fetched) {
      setLoading(false)
      return
    }

    fetchPlan()
  }, [user, isLoaded, fetched, setPlan, fetchPlan])

  /** Force re-fetch from API (call after payment success) */
  const refreshPlan = useCallback(() => {
    setFetched(false)
    fetchPlan()
  }, [fetchPlan])

  return {
    plan,
    setPlan,
    isPro: isPro(),
    isPaid: isPaid(),
    tradeLimit: tradeLimit(),
    loading,
    refreshPlan,
  }
}
