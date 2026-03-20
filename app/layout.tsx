import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import ClerkWrapper from '@/components/ClerkWrapper'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'TradeSaath – AI Trading Psychology Coach',
  description:
    'Upload your trades and get deep AI-powered psychological insights to fix emotional biases and grow as an Indian trader.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClerkWrapper>{children}</ClerkWrapper>
      </body>
    </html>
  )
}
