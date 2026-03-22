import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Onboarding from '@/components/Onboarding'
import AuthSync from '@/components/AuthSync'

export const metadata: Metadata = {
  title: 'TradeSaath – AI Trading Psychology Coach',
  description:
    'Upload your trades and get deep AI-powered psychological insights to fix emotional biases and grow as a trader.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AuthSync />
          <Navbar />
          {children}
          <Footer />
          <Onboarding />
        </body>
      </html>
    </ClerkProvider>
  )
}
