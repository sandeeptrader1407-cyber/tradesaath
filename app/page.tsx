import type { Metadata } from 'next'
import HomeClient from '@/components/HomeClient'

export const metadata: Metadata = {
  title: 'TradeSaath — AI Trading Psychology Analysis for Indian Traders',
  description:
    'Upload your tradebook. Get your Decision Quality Score in 60 seconds. AI-powered analysis detects revenge trading, FOMO, panic exits, and overtrading patterns. Works with Zerodha, Upstox, Angel One, Fyers, and 20+ brokers.',
  keywords: [
    'trading psychology', 'AI trading analysis', 'revenge trading',
    'FOMO trading', 'trading journal India', 'Zerodha analysis',
    'options trading psychology', 'decision quality score', 'Nifty options psychology',
  ],
  metadataBase: new URL('https://tradesaath.com'),
  openGraph: {
    type: 'website',
    title: 'TradeSaath — AI Trading Psychology Analysis',
    description: 'Upload your tradebook. Get your Decision Quality Score in 60 seconds.',
    url: 'https://tradesaath.com',
    siteName: 'TradeSaath',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'TradeSaath' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeSaath — AI Trading Psychology Analysis',
    description: 'Upload your tradebook. Get your Decision Quality Score in 60 seconds.',
    images: ['/api/og'],
  },
  alternates: { canonical: 'https://tradesaath.com' },
}

export default function HomePage() {
  return <HomeClient />
}
