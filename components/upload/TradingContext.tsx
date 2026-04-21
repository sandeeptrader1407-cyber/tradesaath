'use client'

import { useUploadStore, type TradingContext as TradingContextType } from '@/lib/uploadStore'

interface Question {
  key: keyof TradingContextType
  label: string
  options: string[]
  type: 'select' | 'textarea'
}

const QUESTIONS: Question[] = [
  {
    key: 'experience',
    label: 'Experience level',
    type: 'select',
    options: [
      'Beginner (under 1 year)',
      'Intermediate (1–3 years)',
      'Experienced (3–7 years)',
      'Professional (7+ years)',
    ],
  },
  {
    key: 'capital',
    label: 'Total trading capital',
    type: 'select',
    options: [
      'Under ₹50,000',
      '₹50K–₹2L',
      '₹2L–₹10L',
      '₹10L–₹50L',
      'Above ₹50L',
    ],
  },
  {
    key: 'mood',
    label: 'Your mood going in',
    type: 'select',
    options: [
      'Confident & focused',
      'Neutral/calm',
      'Anxious or stressed',
      'Frustrated from yesterday',
      'Overexcited/FOMO',
      'Tired or distracted',
    ],
  },
  {
    key: 'marketView',
    label: 'Market view that day',
    type: 'select',
    options: [
      'Bullish',
      'Bearish',
      'Neutral/rangebound',
      'Volatile/event/news day',
      'Expiry/settlement day',
      'No view — reactive trading',
    ],
  },
  {
    key: 'stopLoss',
    label: 'Stop loss rules',
    type: 'select',
    options: [
      'Strict — always set before entry',
      'Mental SL only',
      'Set SL but moved/removed it',
      'No SL defined',
    ],
  },
  {
    key: 'strategy',
    label: 'Strategy intention',
    type: 'select',
    options: [
      'Breakout/momentum',
      'Reversal/mean reversion',
      'Trend following',
      'Scalping/quick trades',
      'Swing/positional',
      'No defined strategy',
    ],
  },
  {
    key: 'plan',
    label: 'Pre-market plan',
    type: 'select',
    options: [
      'Full plan — clear levels & rules',
      'Loose plan, no hard rules',
      'Had a plan, abandoned it',
      'No plan — traded by feel',
    ],
  },
  {
    key: 'notes',
    label: 'Special notes',
    type: 'textarea',
    options: [],
  },
]

export default function TradingContext() {
  const context = useUploadStore((s) => s.context)
  const setContext = useUploadStore((s) => s.setContext)

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: 'var(--s1)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-base font-semibold"
          style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}
        >
          Trading Context
        </h3>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          optional · makes analysis sharper
        </span>
      </div>

      {/* Questions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUESTIONS.map((q) => {
          if (q.type === 'textarea') {
            return (
              <div key={q.key} className="md:col-span-2">
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text2)' }}
                >
                  {q.label}
                </label>
                <textarea
                  value={context[q.key]}
                  onChange={(e) => setContext(q.key, e.target.value)}
                  placeholder="e.g. First day trading a new strategy, large event day, had overnight position, trying different position sizing…"
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none transition-colors"
                  style={{
                    background: 'var(--s2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                />
              </div>
            )
          }

          return (
            <div key={q.key}>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text2)' }}
              >
                {q.label}
              </label>
              <select
                value={context[q.key]}
                onChange={(e) => setContext(q.key, e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors appearance-none cursor-pointer"
                style={{
                  background: 'var(--s2)',
                  border: '1px solid var(--border)',
                  color: context[q.key] ? 'var(--text)' : 'var(--muted)',
                  fontFamily: "'Outfit', sans-serif",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23546380' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 6.646a.5.5 0 0 1 .708 0L8 9.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: '32px',
                }}
              >
                <option value="">Select…</option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
