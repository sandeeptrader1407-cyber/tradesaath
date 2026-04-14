import type { Metadata } from 'next'
import Pricing from '@/components/Pricing'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for TradesAath',
}

export default function PricingPage() {
  return <Pricing />
}
