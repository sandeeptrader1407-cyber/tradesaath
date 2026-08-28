import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Onboarding from '@/components/Onboarding'
import AuthSync from '@/components/AuthSync'
import AiChat from '@/components/AiChat'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// IBM Plex Sans has no static 450 weight file (Google only ships 100/200/300/
// 400/500/600/700) — the reference design's 450 nav/button weight falls back
// to the nearest loaded weight (400/500) rather than a true intermediate cut.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sans',
  display: 'swap',
})

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-display',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TradeSaath — Your AI Trading Companion',
  description:
    'Understand your trading psychology. Detect patterns, measure discipline, and get personalised coaching — for every market, every trader, everywhere.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${ibmPlexSans.variable} ${ibmPlexSerif.variable} ${ibmPlexMono.variable}`}
      >
        <body>
          <AuthSync />
          <Navbar />
          {children}
          <Footer />
          <AiChat />
          <Analytics />
          <SpeedInsights />
          <Onboarding />
        </body>
      </html>
    </ClerkProvider>
  )
}
