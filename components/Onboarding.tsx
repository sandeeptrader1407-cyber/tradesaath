'use client'

import { useState, useEffect } from 'react'

const steps = [
  {
    icon: '👊',
    title: 'You\u2019re Not Alone',
    desc: 'Every trader struggles with the same patterns \u2014 FOMO, revenge trades, averaging down. TradeSaath understands these patterns because it was built by traders who\u2019ve been there. Upload your trades, and we\u2019ll show you what\u2019s really happening.',
  },
  {
    icon: '🟠',
    title: 'A Saathi, Not a Scorecard',
    desc: 'We won\u2019t just show you red and green numbers. For every trade, you\u2019ll get honest, specific coaching \u2014 what worked, what didn\u2019t, and exactly what to do differently next time.',
  },
  {
    icon: '💪',
    title: 'Small Wins, Real Progress',
    desc: 'We track your growth through milestones, not just P&L. Did you follow your rules today? Did you avoid revenge trading? Those wins matter more than any single trade. Start with a free analysis \u2014 no login needed.',
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
