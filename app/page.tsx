import type { Metadata } from 'next'
import Hero from '@/components/Hero'
import HomeUpload from '@/components/HomeUpload'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'
import { OrganizationSchema, WebPageSchema, HowToSchema } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'TradeSaath — AI Trading Psychology Analysis for Indian Traders',
  description:
    'Upload your tradebook. Get your Decision Quality Score in 60 seconds. AI-powered analysis detects revenge trading, FOMO, panic exits, and overtrading patterns. Works with Zerodha, Upstox, Angel One, and 20+ brokers.',
  keywords: [
    'trading psychology',
    'AI trading analysis',
    'revenge trading',
    'FOMO trading',
    'trading journal India',
    'Zerodha analysis',
    'options trading psychology',
    'trading psychology coach',
    'decision quality score',
    'Nifty options psychology',
    'BankNifty trading mistakes',
  ],
  metadataBase: new URL('https://tradesaath.com'),
  openGraph: {
    type: 'website',
    title: 'TradeSaath — AI Trading Psychology Analysis for Indian Traders',
    description:
      'Upload your tradebook. Get your Decision Quality Score in 60 seconds. Detects revenge trading, FOMO, panic exits, and overtrading.',
    url: 'https://tradesaath.com',
    siteName: 'TradeSaath',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'TradeSaath — AI Trading Psychology Analysis' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeSaath — AI Trading Psychology Analysis',
    description: 'Upload your tradebook. Get your Decision Quality Score in 60 seconds.',
    images: ['/api/og'],
  },
  alternates: { canonical: 'https://tradesaath.com' },
}

export default function Home() {
  return (
    <div id="page-home">
      <OrganizationSchema />
      <WebPageSchema
        name="TradeSaath — AI Trading Psychology Analysis"
        description="AI-powered trading psychology analysis for Indian retail traders. Detects revenge trading, FOMO, panic exits, overtrading."
        url="https://tradesaath.com"
      />
      <HowToSchema
        name="How to Analyse Your Trading Psychology with TradeSaath"
        description="Upload your tradebook and get AI-powered psychology insights in 60 seconds."
        steps={[
          { name: 'Export your tradebook', text: 'Download your trade history as CSV, Excel, or PDF from your broker (Zerodha, Upstox, Angel One, etc.).' },
          { name: 'Upload to TradeSaath', text: 'Drag and drop your file on the upload page. TradeSaath auto-detects your broker and maps columns.' },
          { name: 'Get your Decision Quality Score', text: 'In 60 seconds, receive your DQS score, emotional pattern analysis, and personalised coaching from Saathi AI.' },
        ]}
      />
      <Hero />
      <HomeUpload />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
    </div>
  )
}
