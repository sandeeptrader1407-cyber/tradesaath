'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

export function useSyncUser() {
  const { user, isLoaded, isSignedIn } = useUser()
  const hasSynced = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || hasSynced.current) return

    hasSynced.current = true

    fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        name: user.fullName || '',
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : null,
      }),
    }).catch((err) => {
      console.error('User sync failed:', err)
      hasSynced.current = false // allow retry on next render
    })
  }, [isLoaded, isSignedIn, user])
}
