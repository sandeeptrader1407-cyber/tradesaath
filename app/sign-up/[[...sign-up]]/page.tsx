import type { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'Sign Up — TradeSaath',
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', paddingTop: 80 }}>
      <SignUp forceRedirectUrl="/dashboard" />
    </div>
  )
}
