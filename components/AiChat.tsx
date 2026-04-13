'use client'

import { useState, useRef, useEffect } from 'react'
import { computeKPIs } from '@/lib/kpi/computeKPIs'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/* Quick suggestion chips per C9 chat response library */
const QUICK_PROMPTS: { label: string; prompt: string; tag: string; color: string }[] = [
  { label: 'Why do I keep revenge trading?', prompt: 'Why do I keep revenge trading? What triggers it and how do I break the cycle?', tag: 'PSYCH', color: 'var(--red)' },
  { label: 'How to fix my stop loss discipline?', prompt: 'How can I fix my stop loss discipline? What specific rules should I follow?', tag: 'RULES', color: 'var(--accent)' },
  { label: 'Am I overtrading?', prompt: 'Am I overtrading? Analyse my recent sessions and tell me the truth.', tag: 'AUDIT', color: 'var(--orange)' },
  { label: 'Best time to stop trading today?', prompt: 'When should I stop trading today? Give me a clear rule based on my behavior.', tag: 'RULES', color: 'var(--accent)' },
  { label: 'How to handle a losing streak?', prompt: 'How should I handle a losing streak? What does my data say about recovery?', tag: 'PSYCH', color: 'var(--red)' },
  // NEW V12 templates
  { label: 'Analyse my last 5 sessions for patterns', prompt: 'Analyse my last 5 sessions and identify the top 3 recurring patterns. For each, give me frequency, cost, and a concrete fix.', tag: 'PATTERN', color: 'var(--purple)' },
  { label: 'What\u2019s my trader personality?', prompt: 'Based on my trade history, what trader personality type am I (revenge trader, FOMO chaser, disciplined scalper, hope-holder, etc.)? Explain why and what I should optimize for.', tag: 'PROFILE', color: 'var(--gold)' },
  { label: 'I\u2019m trading LIVE right now \u2014 guide me', prompt: 'I am trading LIVE right now. Based on my history, what are the top 3 things I must watch out for in the next hour? Give me rapid-fire rules.', tag: 'LIVE', color: 'var(--blue)' },
]

/** Lightweight markdown to HTML for chat bubbles. Handles **bold**, *italic*, and `code`. */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,.08);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
}

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tradeContext, setTradeContext] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [patternCount, setPatternCount] = useState(0)
  const [memoryStats, setMemoryStats] = useState<{ pnl: number; avgDqs: number; topPattern: string | null }>({ pnl: 0, avgDqs: 0, topPattern: null })
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

        // Single source of truth: computeKPIs across ALL sessions (matches Dashboard + Saathi)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kpiSessions = sessions.map((s: any) => ({
          net_pnl: s.total_pnl || 0,
          win_rate: s.win_rate || 0,
          trade_count: s.trade_count || 0,
          win_count: s.win_count || 0,
          loss_count: s.loss_count || 0,
        }))
        const kpis = computeKPIs(kpiSessions)

        // Avg DQS across sessions that have a non-zero score
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dqsScores = sessions.map((s: any) => s.dqs_score || 0).filter((v: number) => v > 0)
        const avgDqs = dqsScores.length > 0 ? dqsScores.reduce((a: number, b: number) => a + b, 0) / dqsScores.length : 0

        // Collect patterns across ALL sessions
        const patterns: Record<string, number> = {}
        for (const sess of sessions) {
          const analysis = sess.analysis as { perTrade?: { tag: string }[] } | null
          if (analysis?.perTrade) {
            for (const pt of analysis.perTrade) {
              patterns[pt.tag] = (patterns[pt.tag] || 0) + 1
            }
          }
        }
        const patternEntries = Object.entries(patterns).sort((a, b) => b[1] - a[1])
        setPatternCount(patternEntries.length)
        setMemoryStats({
          pnl: kpis.totalPnl,
          avgDqs: Math.round(avgDqs),
          topPattern: patternEntries[0]?.[0] || null,
        })

        const ctx = `All ${sessions.length} sessions (all-time): Net P&L \u20B9${kpis.totalPnl.toLocaleString('en-IN')}, WR ${kpis.winRate}%, ${kpis.totalTrades} trades, Avg DQS ${Math.round(avgDqs)}/100. Top patterns: ${patternEntries.slice(0, 4).map(([tag, count]) => `${tag}(${count}x)`).join(', ')}.`
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
        {open ? '\u2715' : '\uD83D\uDCAC'}
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
                <div style={{ fontSize: 10, color: 'var(--accent)' }}>Online {'\u00B7'} Your Trading Saathi</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16 }}>{'\u2715'}</button>
          </div>

          {/* Coaching Memory Bar */}
          {sessionCount > 0 && (
            <div style={{
              padding: '8px 14px', borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(90deg, rgba(62,232,196,.06), rgba(91,141,239,.04))',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 9,
                color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 5,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
                Coaching Memory Active
              </div>
              <div style={{
                display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)',
              }}>
                <span><span style={{ color: 'var(--muted)' }}>SESSIONS</span> <strong style={{ color: 'var(--text)' }}>{sessionCount}</strong></span>
                <span style={{ color: 'var(--border)' }}>{'\u00B7'}</span>
                <span><span style={{ color: 'var(--muted)' }}>Gross P&amp;L</span> <strong style={{ color: memoryStats.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{(memoryStats.pnl > 0 ? '+' : memoryStats.pnl < 0 ? '-' : '') + '\u20B9' + Math.abs(memoryStats.pnl).toLocaleString('en-IN')}</strong></span>
                <span style={{ color: 'var(--border)' }}>{'\u00B7'}</span>
                <span><span style={{ color: 'var(--muted)' }}>DQS</span> <strong style={{ color: memoryStats.avgDqs >= 60 ? 'var(--green)' : memoryStats.avgDqs >= 40 ? 'var(--gold)' : 'var(--red)' }}>{memoryStats.avgDqs}</strong></span>
                <span style={{ color: 'var(--border)' }}>{'\u00B7'}</span>
                <span><span style={{ color: 'var(--muted)' }}>PATTERNS</span> <strong style={{ color: 'var(--text)' }}>{patternCount}</strong></span>
              </div>
              {memoryStats.topPattern && (
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 4 }}>
                  Top behaviour: <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{memoryStats.topPattern}</span>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{'\uD83C\uDFAF'}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Ask me anything about your trading</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>I analyse your patterns and give specific, actionable coaching</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p.label} onClick={() => sendMessage(p.prompt)} style={{
                      padding: '8px 12px', fontSize: 11, background: 'var(--s2)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text2)', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
                        background: 'rgba(255,255,255,.04)', color: p.color,
                        letterSpacing: '.05em', flexShrink: 0,
                      }}>{p.tag}</span>
                      <span style={{ flex: 1 }}>{p.label}</span>
                    </button>
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
                {m.role === 'assistant'
                  ? <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  : m.content}
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
