import type { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'Sign In — TradeSaath',
  robots: { index: false, follow: false },
}

export default function SignInPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', paddingTop: 80 }}>
      <SignIn forceRedirectUrl="/dashboard" />
    </div>
  )
}
