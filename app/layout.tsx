import type { Metadata } from 'next'
import './globals.css'
import ClerkWrapper from '@/components/ClerkWrapper'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Onboarding from '@/components/Onboarding'

export const metadata: Metadata = {
  title: 'TradeSaath – AI Trading Psychology Coach',
  description:
    'Upload your trades and get deep AI-powered psychological insights to fix emotional biases and grow as a trader.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkWrapper>
          <Navbar />
          {children}
          <Footer />
          <Onboarding />
        </ClerkWrapper>
      </body>
    </html>
  )
}
