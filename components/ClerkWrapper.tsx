'use client'

import { ClerkProvider } from '@clerk/nextjs'

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default function ClerkWrapper({ children }: { children: React.ReactNode }) {
  if (!publishableKey) {
    // No Clerk key available — render children without auth provider.
    // This lets the build succeed and the site run (without auth) until
    // the key is properly configured in the hosting environment.
    return <>{children}</>
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  )
}
