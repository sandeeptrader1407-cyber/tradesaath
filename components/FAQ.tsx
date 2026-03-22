'use client'

import { useState } from 'react'

const faqs = [
  {
    q: 'What file formats are supported?',
    a: 'PDF trade statements, CSV exports, Excel files (XLSX/XLS), and screenshots (PNG/JPG). Any broker worldwide — we auto-detect the format. Upload up to 40 files per session.',
  },
  {
    q: 'What markets and currencies are supported?',
    a: 'All global markets: NSE, BSE, NYSE, NASDAQ, LSE, ASX, SGX, Forex (all pairs), Crypto (all exchanges), Commodities. Any currency is supported and auto-converted for comparison.',
  },
  {
    q: 'Is my data private?',
    a: 'Your trade data is processed securely and never sold to third parties. Free tier analysis runs client-side where possible. Paid tiers use encrypted server processing.',
  },
  {
    q: 'What is the Vicious Cycle?',
    a: 'The Vicious Cycle is our proprietary 8-stage framework: Disciplined Win → FOMO Re-entry → Against Trend → Hope & Hold → Averaging Down → Panic Exit → Revenge Trade → Decision Fatigue. Each trade is mapped to a stage.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes, cancel anytime from your account dashboard. No questions asked. Your journal data is retained for 90 days after cancellation.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function toggle(i: number) {
    setOpenIndex(openIndex === i ? null : i)
  }

  return (
    <section className="landing-sec" id="faq">
      <div className="wrap">
        <div className="sec-eyebrow" style={{ textAlign: 'center' }}>FAQ</div>
        <div className="sec-title" style={{ textAlign: 'center' }}>Common questions</div>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className={`faq-item${openIndex === i ? ' open' : ''}`}>
              <div className="faq-q" onClick={() => toggle(i)}>
                {f.q}
                <svg className="faq-arrow" viewBox="0 0 24 24" width={18} fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
