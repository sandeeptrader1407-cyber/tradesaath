import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

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

const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )

  // Wrap with ClerkProvider only when the publishable key is available.
  // During Vercel static page generation the env var may not be present,
  // which causes Clerk to throw and fail the entire build.
  if (clerkPubKey) {
    return <ClerkProvider publishableKey={clerkPubKey}>{body}</ClerkProvider>
  }

  return body
}
