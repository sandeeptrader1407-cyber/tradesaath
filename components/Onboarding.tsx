'use client'

import { useState, useEffect } from 'react'

const steps = [
  {
    icon: '📂',
    title: 'Welcome to TradeSaath',
    desc: 'The AI-powered trading psychology engine that turns your trade data into personalised coaching, behavioral insights, and a clear improvement roadmap.',
  },
  {
    icon: '⚡',
    title: 'Upload Any Trade File',
    desc: 'PDF statements, CSV exports, Excel files, or screenshots. Any broker, any market — NSE, NYSE, Forex, Crypto. Auto-detected in seconds.',
  },
  {
    icon: '🧠',
    title: 'Get Personalised Insights',
    desc: 'AI-powered P&L analysis, per-trade psychology coaching, Vicious Cycle detection, and a personalised improvement roadmap. Start free — no login required.',
  },
]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('ts-onboarded')
    if (!seen) setVisible(true)
  }, [])

  function skip() {
    localStorage.setItem('ts-onboarded', '1')
    setVisible(false)
  }

  function next() {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      skip()
    }
  }

  if (!visible) return null

  const s = steps[step]

  return (
    <div className="ob-overlay">
      <div className="ob-card">
        <div className="ob-dots">
          {steps.map((_, i) => (
            <div key={i} className={`ob-dot${i === step ? ' on' : ''}`} />
          ))}
        </div>
        <div>
          <div className="ob-icon">{s.icon}</div>
          <div className="ob-title">{s.title}</div>
          <div className="ob-desc">{s.desc}</div>
        </div>
        <div className="ob-btns">
          <button className="btn btn-ghost btn-sm" onClick={skip}>Skip</button>
          <button className="btn btn-accent btn-sm" onClick={next}>
            {step < steps.length - 1 ? 'Next →' : 'Get Started →'}
          </button>
        </div>
      </div>
    </div>
  )
}
