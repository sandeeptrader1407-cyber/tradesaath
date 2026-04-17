import type { Metadata } from 'next'
import Pricing from '@/components/Pricing'
import { SoftwareApplicationSchema, BreadcrumbSchema, WebPageSchema } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'TradeSaath Pricing \u2014 Plans from \u20B999 | Free First Analysis',
  description:
    'TradeSaath pricing: Single Report \u20B999, Pro Monthly \u20B9499/mo, Pro Yearly \u20B9399/mo. Free first analysis included. AI-powered trading psychology coaching for Nifty and BankNifty options traders.',
  keywords: [
    'TradeSaath pricing',
    'trading psychology tool price',
    'AI trading analysis cost',
    'trading journal subscription India',
  ],
  openGraph: {
    title: 'TradeSaath Pricing \u2014 Plans from \u20B999',
    description: 'Single Report \u20B999, Pro Monthly \u20B9499/mo. Free first analysis included.',
    url: 'https://tradesaath.com/pricing',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: 'https://tradesaath.com/pricing' },
}

export default function PricingPage() {
  return (
    <>
      <SoftwareApplicationSchema />
      <BreadcrumbSchema items={[
        { name: 'Home', url: 'https://tradesaath.com' },
        { name: 'Pricing', url: 'https://tradesaath.com/pricing' },
      ]} />
      <WebPageSchema
        name="TradeSaath Pricing"
        description="AI-powered trading psychology analysis plans starting from \u20B999."
        url="https://tradesaath.com/pricing"
      />
      <Pricing />
    </>
  )
}
