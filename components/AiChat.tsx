'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/* Quick suggestion chips per C9 chat response library */
const QUICK_PROMPTS = [
  'Why do I keep revenge trading?',
  'How to fix my stop loss discipline?',
  'Am I overtrading?',
  'Best time to stop trading today?',
  'How to handle a losing streak?',
]

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tradeContext, setTradeContext] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [patternCount, setPatternCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Fetch trade context when chat opens
  useEffect(() => {
    if (!open || tradeContext) return
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => {
        const sessions = data.sessions || []
        if (sessions.length === 0) return
        setSessionCount(sessions.length)

        // Build context from recent sessions
        const recent = sessions.slice(0, 5)
        const totalPnl = recent.reduce((s: number, sess: { total_pnl?: number }) => s + (sess.total_pnl || 0), 0)
        const avgWr = recent.reduce((s: number, sess: { win_rate?: number }) => s + (sess.win_rate || 0), 0) / recent.length
        const avgDqs = recent.reduce((s: number, sess: { dqs_score?: number }) => s + (sess.dqs_score || 0), 0) / recent.length

        // Collect patterns across sessions
        const patterns: Record<string, number> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const sess of recent) {
          const analysis = sess.analysis as { perTrade?: { tag: string }[] } | null
          if (analysis?.perTrade) {
            for (const pt of analysis.perTrade) {
              patterns[pt.tag] = (patterns[pt.tag] || 0) + 1
            }
          }
        }
        const patternEntries = Object.entries(patterns).sort((a, b) => b[1] - a[1])
        setPatternCount(patternEntries.length)

        const ctx = `Last ${recent.length} sessions: Net P&L ₹${totalPnl.toLocaleString('en-IN')}, Avg WR ${Math.round(avgWr)}%, Avg DQS ${Math.round(avgDqs)}/100. Top patterns: ${patternEntries.slice(0, 4).map(([tag, count]) => `${tag}(${count}x)`).join(', ')}. Total ${sessions.length} sessions analyzed.`
        setTradeContext(ctx)
      })
      .catch(() => { /* silently fail */ })
  }, [open, tradeContext])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10),
          tradeContext: tradeContext || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date() }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Sorry, something went wrong. Try again.', timestamp: new Date() }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect. Check your internet and try again.', timestamp: new Date() }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* FAB Button */}
      <button
        className="ai-chat-fab"
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--blue))',
          color: 'var(--bg)',
          border: 'none', cursor: 'pointer', fontSize: 24,
          boxShadow: '0 4px 20px rgba(62,232,196,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .2s',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 999,
          width: 400, maxWidth: 'calc(100vw - 48px)', height: 560, maxHeight: 'calc(100vh - 140px)',
          background: 'var(--s1)', border: '1px solid var(--border)',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,.4)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>TradeSaath AI</div>
                <div style={{ fontSize: 10, color: 'var(--accent)' }}>Online · Trading Psychology Coach</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          {/* Coaching Memory Indicator */}
          {sessionCount > 0 && (
            <div style={{
              padding: '6px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--muted2)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
              TradeSaath remembers: {sessionCount} sessions analyzed, {patternCount} patterns detected
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Ask me anything about your trading</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>I analyse your patterns and give specific, actionable coaching</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p} onClick={() => sendMessage(p)} style={{
                      padding: '8px 12px', fontSize: 11, background: 'var(--s2)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text2)', cursor: 'pointer', textAlign: 'left',
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px', borderRadius: 12,
                background: m.role === 'user' ? 'var(--accent)' : 'var(--s2)',
                color: m.role === 'user' ? 'var(--bg)' : 'var(--text)',
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line',
              }}>
                {m.content}
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: 'var(--s2)', fontSize: 13, color: 'var(--muted)' }}>
                Thinking...
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8,
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
              placeholder="Ask about your trading patterns..."
              style={{
                flex: 1, padding: '8px 12px', fontSize: 13,
                background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                outline: 'none',
              }}
            />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} style={{
              padding: '8px 14px', background: 'var(--accent)', color: 'var(--bg)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, opacity: loading || !input.trim() ? 0.5 : 1,
            }}>Send</button>
          </div>
        </div>
      )}
    </>
  )
}
