import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Onboarding from '@/components/Onboarding'
import AuthSync from '@/components/AuthSync'
import AiChat from '@/components/AiChat'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
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
        className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}
      >
        <body>
          <AuthSync />
          <Navbar />
          {children}
          <Footer />
          <AiChat />
          <Onboarding />
        </body>
      </html>
    </ClerkProvider>
  )
}
