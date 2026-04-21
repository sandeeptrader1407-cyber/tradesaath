'use client'

import { useState, useEffect, useCallback } from 'react'

/* ─── Types ─── */
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
  duration: number
}

/* ─── Module-level event bus — no provider needed ─── */
type Listener = (item: ToastItem) => void
const listeners: Set<Listener> = new Set()
let nextId = 0

function emit(message: string, type: ToastType = 'info', duration = 3000) {
  const item: ToastItem = { id: ++nextId, type, message, duration }
  listeners.forEach((fn) => fn(item))
}

/** Call from anywhere in the app — no context required */
export const showToast = {
  success: (msg: string, dur?: number) => emit(msg, 'success', dur),
  error:   (msg: string, dur?: number) => emit(msg, 'error',   dur),
  warning: (msg: string, dur?: number) => emit(msg, 'warning', dur),
  info:    (msg: string, dur?: number) => emit(msg, 'info',    dur),
}

/* ─── Toaster — mount once in layout ─── */
export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler: Listener = (item) => {
      setToasts((prev) => [...prev.slice(-4), item])
    }
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 320,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <ToastBubble key={t.id} item={t} onDismiss={removeToast} />
      ))}
    </div>
  )
}

/* ─── Individual toast ─── */
function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
}) {
  const [phase, setPhase] = useState<'in' | 'visible' | 'out'>('in')

  useEffect(() => {
    // Animate in
    const inTimer = setTimeout(() => setPhase('visible'), 20)
    // Start fade-out before dismissal
    const outTimer = setTimeout(() => setPhase('out'), item.duration - 300)
    // Remove after fade-out
    const removeTimer = setTimeout(() => onDismiss(item.id), item.duration)

    return () => {
      clearTimeout(inTimer)
      clearTimeout(outTimer)
      clearTimeout(removeTimer)
    }
  }, [item.id, item.duration, onDismiss])

  function dismiss() {
    setPhase('out')
    setTimeout(() => onDismiss(item.id), 300)
  }

  return (
    <div
      onClick={dismiss}
      style={{
        background: '#1A1F2E',
        color: '#F8F6F1',
        fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)',
        fontSize: 13,
        lineHeight: 1.5,
        borderRadius: 8,
        padding: '12px 16px',
        pointerEvents: 'auto',
        cursor: 'pointer',
        opacity: phase === 'visible' ? 1 : 0,
        transform: phase === 'visible' ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        userSelect: 'none',
      }}
    >
      {item.message}
    </div>
  )
}
