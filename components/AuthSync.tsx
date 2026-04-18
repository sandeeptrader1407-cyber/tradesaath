'use client'

import { useSyncUser } from '@/hooks/useSyncUser'
import ClerkErrorBoundary from './ClerkErrorBoundary'

function AuthSyncInner() {
  useSyncUser()
  return null
}

export default function AuthSync() {
  return (
    <ClerkErrorBoundary>
      <AuthSyncInner />
    </ClerkErrorBoundary>
  )
}
