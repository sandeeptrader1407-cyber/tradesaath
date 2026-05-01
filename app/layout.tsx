import type { Metadata } from 'next'
import { Inter, Lato, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Onboarding from '@/components/Onboarding'
import AuthSync from '@/components/AuthSync'
import AiChat from '@/components/AiChat'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sans',
  display: 'swap',
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
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
        className={`${inter.variable} ${lato.variable} ${jetbrainsMono.variable}`}
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
