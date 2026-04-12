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

/* ─── Module-level event bus (works without provider) ─── */
type Listener = (item: ToastItem) => void
const listeners: Set<Listener> = new Set()
let nextId = 0

function emit(message: string, type: ToastType = 'info', duration = 5000) {
  const item: ToastItem = { id: ++nextId, type, message, duration }
  listeners.forEach((fn) => fn(item))
}

/** Call from anywhere — no provider needed */
export const showToast = {
  success: (msg: string, dur?: number) => emit(msg, 'success', dur),
  error:   (msg: string, dur?: number) => emit(msg, 'error', dur),
  warning: (msg: string, dur?: number) => emit(msg, 'warning', dur),
  info:    (msg: string, dur?: number) => emit(msg, 'info', dur),
}

/* ─── Toaster component — mount once at page level ─── */
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
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 400,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastBubble key={t.id} item={t} onDismiss={removeToast} />
      ))}
    </div>
  )
}

/* ─── Individual toast bubble ─── */
function ToastBubble({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(item.id), 300)
    }, item.duration)
    return () => clearTimeout(timer)
  }, [item.id, item.duration, onDismiss])

  const colors: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: 'rgba(54,211,153,.12)', border: 'rgba(54,211,153,.3)', text: 'var(--green, #36d399)', icon: String.fromCodePoint(0x2705) },
    error:   { bg: 'rgba(240,93,108,.12)', border: 'rgba(240,93,108,.3)', text: 'var(--red, #f05d6c)', icon: String.fromCodePoint(0x274C) },
    warning: { bg: 'rgba(251,191,36,.12)', border: 'rgba(251,191,36,.3)', text: '#fbbf24', icon: String.fromCodePoint(0x26A0, 0xFE0F) },
    info:    { bg: 'rgba(96,165,250,.12)', border: 'rgba(96,165,250,.3)', text: '#60a5fa', icon: String.fromCodePoint(0x2139, 0xFE0F) },
  }

  const c = colors[item.type]

  return (
    <div
      style={{
        background: c.bg,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '12px 16px',
        color: c.text,
        fontSize: 14,
        fontFamily: "'Outfit', sans-serif",
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        pointerEvents: 'auto',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 20px rgba(0,0,0,.3)',
      }}
      onClick={() => {
        setVisible(false)
        setTimeout(() => onDismiss(item.id), 300)
      }}
    >
      <span style={{ flexShrink: 0 }}>{c.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{item.message}</span>
    </div>
  )
}
