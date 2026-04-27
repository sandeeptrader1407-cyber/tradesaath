"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"

const INTENTIONS = [
  "No revenge trades",
  "Stop at 10:30 AM",
  "Max 8 trades",
  "Fixed 20 lots",
  "Stop loss every trade",
]

interface Props {
  compact?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'done'

export default function PreMarketCheckin({ compact = false }: Props) {
  const { isSignedIn } = useUser()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/user/intentions')
      .then(r => r.json())
      .then(d => {
        if (d.completed && Array.isArray(d.intentions) && d.intentions.length > 0) {
          setSelected(new Set(d.intentions as string[]))
          setSaveStatus('done')
        }
      })
      .catch(() => {})
  }, [isSignedIn])

  const toggle = (item: string) => {
    if (saveStatus === 'done') return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }

  const handleReady = async () => {
    if (selected.size === 0 || saveStatus !== 'idle') return
    setSaveStatus('saving')
    try {
      await fetch('/api/user/intentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentions: Array.from(selected) }),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('done'), 1500)
    } catch {
      setSaveStatus('idle')
    }
  }

  const isDone = saveStatus === 'done'
  const isSaving = saveStatus === 'saving'
  const isSaved = saveStatus === 'saved'

  const chipStyle = (item: string): React.CSSProperties => ({
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    fontWeight: 400,
    padding: '4px 10px',
    borderRadius: 20,
    border: '0.5px solid',
    cursor: isDone ? 'default' : 'pointer',
    background: selected.has(item) ? 'rgba(15,76,129,0.06)' : 'transparent',
    borderColor: selected.has(item) ? 'var(--accent)' : 'var(--color-border)',
    color: selected.has(item) ? 'var(--accent)' : 'var(--color-muted)',
    transition: 'all 0.1s',
    opacity: isDone ? 0.8 : 1,
  })

  if (isDone && compact) {
    return (
      <div style={{ padding: '4px 0', background: 'rgba(29,158,117,0.04)', borderRadius: 8 }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--green)', margin: '0 0 8px' }}>
          Intentions set for today
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from(selected).map(s => (
            <span key={s} style={{
              fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 400,
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(29,158,117,0.08)',
              border: '0.5px solid rgba(29,158,117,0.25)',
              color: 'var(--green)',
            }}>{s}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: isDone ? 'var(--green)' : 'var(--color-ink)', margin: 0 }}>
            {isDone ? "Today's intentions" : 'Before you trade today'}
          </p>
          {!isDone && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
              Set one rule you will not break today.
            </p>
          )}
        </div>
      )}
      {compact && !isDone && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', margin: '0 0 8px' }}>
          Set your focus for today:
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: isDone ? 0 : 10 }}>
        {INTENTIONS.map(item => (
          <button key={item} onClick={() => toggle(item)} style={chipStyle(item)}>
            {item}
          </button>
        ))}
      </div>
      {!isDone && (
        <button
          onClick={handleReady}
          disabled={selected.size === 0 || isSaving || isSaved}
          style={{
            height: 32,
            padding: '0 16px',
            borderRadius: 6,
            border: 'none',
            background: isSaved
              ? 'rgba(29,158,117,0.1)'
              : selected.size > 0
              ? 'var(--accent)'
              : 'var(--color-border)',
            color: isSaved
              ? 'var(--green)'
              : selected.size > 0
              ? 'var(--color-canvas)'
              : 'var(--color-muted)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 400,
            cursor: selected.size > 0 && !isSaving && !isSaved ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Begin session →'}
        </button>
      )}
    </div>
  )
}
