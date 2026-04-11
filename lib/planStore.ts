import { create } from 'zustand'

export type PlanType = 'free' | 'single' | 'pro_monthly' | 'pro_yearly'

interface PlanStore {
  plan: PlanType
  setPlan: (plan: PlanType) => void
  isPro: () => boolean
  isPaid: () => boolean
  tradeLimit: () => number
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plan: 'free',

  setPlan: (plan) => set({ plan }),

  isPro: () => {
    const p = get().plan
    return p === 'pro_monthly' || p === 'pro_yearly'
  },

  isPaid: () => get().plan !== 'free',

  tradeLimit: () => {
    const p = get().plan
    if (p === 'free') return 3
    return 99 // single, pro_monthly, pro_yearly all get full access
  },
}))
