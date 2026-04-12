'use client'

import { useUser } from '@clerk/nextjs'
import { usePlan } from '@/lib/planStore'
import { ChatFAB } from './ChatFAB'
import { ChatPanel } from './ChatPanel'
import { useState } from 'react'

export function ChatWrapper() {
  const { user } = useUser()
  const { isPro } = usePlan()
  const [isOpen, setIsOpen] = useState(false)

  if (!user || !isPro) return null

  return (
    <>
      <ChatFAB onClick={() => setIsOpen(true)} visible={!isOpen} />
      <ChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
