'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Note: 'use client' means we can't export metadata from this file.
// If SEO metadata is needed, move it to app/faq/layout.tsx in a follow-up.

type FAQ = {
  q: string
  a: string
  cat: 'getting-started' | 'pricing' | 'privacy' | 'trading' | 'account'
}

const CATEGORIES: { id: FAQ['cat']; label: string }[] = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'pricing',         label: 'Pricing'         },
  { id: 'privacy',         label: 'Privacy & data'  },
  { id: 'trading',         label: 'Trading'         },
  { id: 'account',         label: 'Account'         },
]

const FAQS: FAQ[] = [
  { cat: 'getting-started',
    q: 'How does TradeSaath work?',
    a: 'Upload your broker statement, we detect 14+ behavioral patterns in your trading, and you see exactly what each pattern costs you in rupees. You also get a specific plan to fix the top 3 issues — based on your actual trades, not generic advice.' },
  { cat: 'getting-started',
    q: 'Which brokers do you support?',
    a: 'All major Indian brokers — Zerodha, Upstox, Angel One, Groww, Fyers, IIFL, Motilal Oswal, 5Paisa, HDFC Securities, ICICI Direct, Kotak Neo, Sharekhan, SBI Securities, Dhan, and Paytm Money. Plus 15+ international brokers including Interactive Brokers, TD Ameritrade, Robinhood, and eToro. CSV, Excel, PDF, and image files all auto-detected.' },
  { cat: 'getting-started',
    q: 'How long does analysis take?',
    a: 'Under 30 seconds for most files. On the free tier, the first 3 trades get deep AI analysis. Pro analyses every trade in your file with full pattern detection, DQS scoring, and behavioral insights.' },
  { cat: 'pricing',
    q: 'What is free vs paid?',
    a: 'Free includes file upload, P&L and KPIs, Vicious Cycle detection, and 3 deep AI trade analyses. Pro at ₹799/month unlocks unlimited trade analysis, the Journal, your Trading Journey, the Saathi coach, the Discipline Score (DQS), behavioral insights, and AI coaching chat.' },
  { cat: 'pricing',
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from Settings — no future charges. We do not refund unused days on monthly plans. Annual plans are refunded pro-rata within the first 7 days.' },
  { cat: 'privacy',
    q: 'Is my trading data safe?',
    a: 'Files are processed on Vercel and stored on Supabase, encrypted at rest. We never share data with brokers, advertisers, or third parties. You can permanently delete your account and all associated data from Settings → Account at any time.' },
  { cat: 'privacy',
    q: 'Do you store my login credentials?',
    a: 'No. We never ask for your broker password and we do not auto-pull data from your account. You upload files manually — nothing is connected to your live trading account.' },
  { cat: 'trading',
    q: 'Will TradeSaath tell me what to trade?',
    a: 'No. We do not predict markets or suggest specific trades. We analyse how you trade — your discipline, your patterns, your psychological cost. You stay in control of every entry and exit.' },
  { cat: 'trading',
    q: 'Does this work for non-F&O traders?',
    a: 'Yes, but it is optimised for F&O (NSE/BSE Nifty and BankNifty). Equity, commodity, and crypto traders get core KPIs and most pattern detection, but some F&O-specific patterns (like expiry-day oversizing) will not trigger.' },
  { cat: 'account',
    q: 'How is this different from a trading journal app?',
    a: 'Journals make you write. TradeSaath reads your existing broker data and tells you what is actually happening. No daily logging required. Patterns like revenge trading, averaging down, and oversized lots are detected algorithmically across every trade — not just the ones you remembered to journal.' },
]

export default function FAQPage() {
  const [activeCat, setActiveCat] = useState<FAQ['cat']>('getting-started')
  const [openQ, setOpenQ] = useState<number | null>(null)

  const filtered = FAQS.filter(f => f.cat === activeCat)

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px 120px' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', margin: 0 }}>
            FAQ
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: '#0F172A', lineHeight: 1.1, marginTop: 14, marginBottom: 14, letterSpacing: '-0.02em' }}>
            Questions, answered.
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: '#64748B', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Everything traders ask before their first upload. Still not sure? Email us at sandeep.trader1407@gmail.com.
          </p>
        </motion.div>

        {/* Mobile category pills */}
        <div className="faq-mobile-pills" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => { setActiveCat(c.id); setOpenQ(null) }}
              style={{
                background: activeCat === c.id ? '#0F172A' : '#FFFFFF',
                color: activeCat === c.id ? '#F8FAFC' : '#64748B',
                border: `0.5px solid ${activeCat === c.id ? '#0F172A' : '#E2E8F0'}`,
                padding: '8px 14px',
                borderRadius: 20,
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="faq-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 64, alignItems: 'flex-start' }}>

          {/* Sticky sidebar */}
          <aside className="faq-sidebar" style={{ position: 'sticky', top: 120 }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 16, marginTop: 0 }}>
              Categories
            </p>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setActiveCat(c.id); setOpenQ(null) }}
                  style={{
                    background: activeCat === c.id ? '#FFFFFF' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: activeCat === c.id ? 500 : 400,
                    color: activeCat === c.id ? '#0F172A' : '#64748B',
                    borderLeft: `2px solid ${activeCat === c.id ? '#F59E0B' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Question list */}
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCat}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {filtered.map((f, i) => {
                  const isOpen = openQ === i
                  return (
                    <motion.div
                      key={f.q}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{
                        background: '#FFFFFF',
                        border: `0.5px solid ${isOpen ? '#FDE68A' : '#E2E8F0'}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                        boxShadow: isOpen ? '0 4px 16px rgba(245,158,11,0.06)' : '0 1px 2px rgba(15,23,42,0.02)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                    >
                      <button
                        onClick={() => setOpenQ(isOpen ? null : i)}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '20px 24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          textAlign: 'left',
                          fontFamily: 'var(--font-display)',
                          fontSize: 17,
                          fontWeight: 400,
                          color: '#0F172A',
                          letterSpacing: '-0.005em',
                        }}
                        aria-expanded={isOpen}
                      >
                        <span>{f.q}</span>
                        <motion.span
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                          style={{ flexShrink: 0, color: isOpen ? '#F59E0B' : '#94A3B8', fontSize: 18, lineHeight: 1, display: 'inline-block' }}
                        >
                          &#9662;
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="answer"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: '0 24px 22px', borderTop: '0.5px solid #F1F5F9', paddingTop: 18 }}>
                              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#475569', lineHeight: 1.75, margin: 0 }}>
                                {f.a}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>

            {/* Bottom CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ marginTop: 48, padding: '32px 28px', background: '#0F172A', borderRadius: 14, textAlign: 'center' }}
            >
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#F1F5F9', margin: 0, marginBottom: 6, letterSpacing: '-0.01em' }}>
                Still have a question?
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.5)', margin: 0, marginBottom: 20 }}>
                The fastest answer is in your trade file. Upload one and see.
              </p>
              <a
                href="/upload"
                style={{ display: 'inline-block', background: '#F59E0B', color: '#080C14', padding: '11px 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
              >
                Try it free &rarr;
              </a>
            </motion.div>
          </div>
        </div>
      </div>

      <style>{`
        .faq-mobile-pills { display: none; }
        @media (max-width: 768px) {
          .faq-layout { grid-template-columns: 1fr !important; gap: 0 !important; }
          .faq-sidebar { display: none !important; }
          .faq-mobile-pills { display: flex !important; }
        }
      `}</style>
    </main>
  )
}
