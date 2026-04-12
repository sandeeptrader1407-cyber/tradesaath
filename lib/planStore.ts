'use client'

import { create } from 'zustand'
import { useEffect } from 'react'

/* ── Types ─────────────────────────────────────────────────────── */
export type PlanType = 'free' | 'single' | 'pro_monthly' | 'pro_yearly'

interface PlanState {
  /* core */
  plan: PlanType
  authenticated: boolean
  fetched: boolean
  loading: boolean

  /* actions */
  setPlan: (plan: PlanType) => void
  fetchPlan: () => Promise<void>
  refreshPlan: () => void

  /* derived helpers (vanilla — no hooks) */
  isPaid: () => boolean
  isPro: () => boolean
  tradeLimit: () => number
  planDisplayName: () => string
}

const TRADE_LIMITS: Record<PlanType, number> = {
  free: 3,
  single: 99,
  pro_monthly: 99,
  pro_yearly: 99,
}

const DISPLAY_NAMES: Record<PlanType, string> = {
  free: 'Free',
  single: 'Single Report',
  pro_monthly: 'Pro Monthly',
  pro_yearly: 'Pro Yearly',
}

/* ── Zustand store ─────────────────────────────────────────────── */
export const usePlanStore = create<PlanState>((set, get) => ({
  plan: 'free',
  authenticated: false,
  fetched: false,
  loading: true,

  setPlan: (plan) => set({ plan }),

  fetchPlan: async () => {
    if (get().fetched) {
      set({ loading: false })
      return
    }
    set({ loading: true })
    try {
      const res = await fetch('/api/user/plan')
      const data = await res.json()
      set({
        plan: (data.plan as PlanType) || 'free',
        authenticated: !!data.authenticated,
        fetched: true,
        loading: false,
      })
    } catch {
      set({ plan: 'free', loading: false })
    }
  },

  refreshPlan: () => {
    set({ fetched: false })
    get().fetchPlan()
  },

  isPaid: () => get().plan !== 'free',
  isPro: () => {
    const p = get().plan
    return p === 'pro_monthly' || p === 'pro_yearly'
  },
  tradeLimit: () => TRADE_LIMITS[get().plan] ?? 3,
  planDisplayName: () => DISPLAY_NAMES[get().plan] ?? 'Free',
}))

/* ── Convenience React hook (auto-fetches on mount) ──────────── */
export function usePlan() {
  const store = usePlanStore()

  useEffect(() => {
    if (!store.fetched) {
      store.fetchPlan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.fetched])

  return {
    plan: store.plan,
    setPlan: store.setPlan,
    isPro: store.isPro(),
    isPaid: store.isPaid(),
    isFree: store.plan === 'free',
    tradeLimit: store.tradeLimit(),
    loading: store.loading,
    authenticated: store.authenticated,
    refreshPlan: store.refreshPlan,
    planDisplayName: store.planDisplayName(),
  }
}
