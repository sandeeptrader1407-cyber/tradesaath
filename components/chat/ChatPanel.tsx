'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

const SUGGESTIONS = [
  'Why did I lose money this month?',
  'What is my biggest mistake?',
  'Am I improving?',
  'What should I do differently tomorrow?',
  'Explain my revenge trading pattern',
]

const MAX_MESSAGES = 20

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    const lines = part.split('\n')
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ))
  })
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [msgCount, setMsgCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || msgCount >= MAX_MESSAGES) return

    const userMsg: Message = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setIsLoading(true)
    setMsgCount((c) => c + 1)

    try {
      const history = updated.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: history.slice(0, -1) }),
      })

      const data = await res.json()
      const reply = data.reply || data.message || data.error || 'Sorry, I could not respond.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed z-[200] flex flex-col rounded-2xl border shadow-2xl"
      style={{
        bottom: 24,
        right: 24,
        width: 400,
        height: 560,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 100px)',
        background: '#10141f',
        borderColor: 'var(--border)',
        animation: 'chatSlideUp 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-2xl border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\u{1F9E0}'}</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            TradeSaath AI
          </span>
          <span
            className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Pro
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text2)' }}
        >
          {'\u2715'}
        </button>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col gap-3 mt-4">
            <p className="text-xs text-center mb-2" style={{ color: 'var(--text2)' }}>
              Ask me anything about your trading patterns
            </p>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-left text-xs px-3 py-2.5 rounded-lg border transition-colors hover:bg-white/5"
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-1"
              style={{
                background: msg.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {msg.role === 'user' ? '\u{1F464}' : '\u{1F9E0}'}
            </div>
            <div
              className="max-w-[80%] rounded-xl px-3 py-2 text-[13px] leading-relaxed"
              style={{
                background:
                  msg.role === 'user'
                    ? 'rgba(99,102,241,0.15)'
                    : 'rgba(255,255,255,0.06)',
                color: 'var(--text)',
              }}
            >
              {renderContent(msg.content)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-1"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              {'\u{1F9E0}'}
            </div>
            <div
              className="rounded-xl px-4 py-3 flex gap-1.5"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="w-2 h-2 rounded-full bg-white/40 animate-[dotPulse_1.4s_ease-in-out_infinite]" />
              <span className="w-2 h-2 rounded-full bg-white/40 animate-[dotPulse_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="w-2 h-2 rounded-full bg-white/40 animate-[dotPulse_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
          </div>
        )}
      </div>

      {/* Rate limit notice */}
      {msgCount >= MAX_MESSAGES && (
        <div className="px-4 py-2 text-center text-[11px]" style={{ color: 'var(--text2)' }}>
          Message limit reached for this session. Refresh to start a new chat.
        </div>
      )}

      {/* Input Area */}
      <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Ask about your trades..."
            disabled={isLoading || msgCount >= MAX_MESSAGES}
            className="flex-1 px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors focus:border-[var(--accent)]"
            style={{
              background: '#151a28',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim() || msgCount >= MAX_MESSAGES}
            className="px-4 py-2.5 rounded-lg font-medium text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {'\u2192'}
          </button>
        </div>
      </div>

      {/* Inline CSS for animations */}
      <style jsx>{`
        @keyframes chatSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes dotPulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
