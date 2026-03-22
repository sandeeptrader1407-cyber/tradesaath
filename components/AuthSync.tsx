'use client'

import { useSyncUser } from '@/hooks/useSyncUser'

export default function AuthSync() {
  useSyncUser()
  return null
}
