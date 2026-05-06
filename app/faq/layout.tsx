import type { Metadata } from 'next'

/**
 * FAQ route metadata. Lives in the layout because page.tsx is a client
 * component (uses framer-motion + useState) and Next.js does not allow
 * `export const metadata` from a 'use client' file.
 */
export const metadata: Metadata = {
  title: 'FAQ — TradeSaath',
  description:
    'Common questions about TradeSaath: how the AI trading psychology analyser works, what brokers are supported, pricing, privacy, and more.',
  alternates: { canonical: 'https://tradesaath.com/faq' },
  openGraph: {
    title: 'FAQ — TradeSaath',
    description: 'Common questions about TradeSaath.',
    url: 'https://tradesaath.com/faq',
    type: 'website',
  },
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
