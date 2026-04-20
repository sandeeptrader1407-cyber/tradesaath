export const PLANS = {
  single: {
    id: 'single',
    name: 'Single Report',
    price: 9900,        // paise (₹99)
    displayPrice: '₹99',
    description: 'One-time · full session analysis',
    tradeLimit: 99,
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 79900,       // paise (₹799)
    displayPrice: '₹799/mo',
    description: 'Billed monthly · cancel anytime',
    tradeLimit: 99,
    durationDays: 30,
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    price: 598800,             // paise (₹5,988 — actual yearly charge)
    displayPrice: '₹5,988/yr',
    monthlyEquivalent: '₹499/mo',
    description: 'Billed ₹5,988 once per year · save 38% vs monthly',
    tradeLimit: 99,
    durationDays: 365,
  },
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    displayPrice: '₹0',
    description: 'Always free · no account needed',
    tradeLimit: 3,
  }
} as const

export type PlanId = keyof typeof PLANS
