'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView, type Variants } from 'framer-motion'

// ─── Shared animation variants ──────────────────────────────────────────────
const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
}
const VP = { once: true, margin: '-80px' } as const

// ─── Count-up hook ───────────────────────────────────────────────────────────
function useCountUp(end: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    let frame = 0
    const totalFrames = Math.round(duration / 16)
    const timer = setInterval(() => {
      frame++
      const progress = frame / totalFrames
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.min(Math.round(eased * end), end))
      if (frame >= totalFrames) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [inView, end, duration])

  return { count, ref }
}

// ─── Checklist row ───────────────────────────────────────────────────────────
function CheckRow({ children, light = false, amber = false }: { children: React.ReactNode; light?: boolean; amber?: boolean }) {
  const checkColor = light ? 'rgba(248,246,241,0.6)' : amber ? '#F59E0B' : 'var(--color-profit)'
  const textColor = light ? 'rgba(248,246,241,0.8)' : '#444441'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <span style={{ color: checkColor, fontSize: 14, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>&#10003;</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: textColor, lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ children, bg, style }: { children: React.ReactNode; bg?: string; style?: React.CSSProperties }) {
  return (
    <section style={{ background: bg ?? '#FFFFFF', ...style }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px' }}>
        {children}
      </div>
    </section>
  )
}

function SectionLabel({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: light ? 'rgba(248,246,241,0.4)' : 'var(--color-muted)', margin: 0 }}>
      {children}
    </p>
  )
}

function SectionTitle({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400, color: light ? '#F8F6F1' : 'var(--color-ink)', lineHeight: 1.1, marginTop: 12, marginBottom: 0 }}>
      {children}
    </h2>
  )
}

// ─── PRODUCT PREVIEW CARD ────────────────────────────────────────────────────
function ProductPreview() {
  const PATTERNS = [
    { label: 'Revenge trading', count: 3, cost: '-₹6,240', color: '#C0392B' },
    { label: 'Oversized position', count: 2, cost: '-₹3,180', color: '#B87B2B' },
    { label: 'Late entry', count: 4, cost: '-₹1,920', color: '#B87B2B' },
  ]
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 16, border: '0.5px solid #E5E2D9',
      boxShadow: '0 24px 80px rgba(26,31,46,0.10), 0 4px 16px rgba(26,31,46,0.06)',
      padding: '24px', maxWidth: 460, width: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#888780' }}>14 Mar 2025 &middot; BankNifty</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#C0392B', background: 'rgba(192,57,43,0.08)', padding: '2px 8px', borderRadius: 20 }}>-&#8377;9,420</span>
      </div>

      <div style={{ background: '#FAFAFA', border: '0.5px solid #E5E2D9', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888780', marginBottom: 8 }}>Decision Quality Score</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400, color: '#C0392B', lineHeight: 1 }}>41</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#888780' }}>/100 &middot; Grade D</span>
        </div>
        <div style={{ height: 6, background: '#EDE9E0', borderRadius: 3 }}>
          <div style={{ height: '100%', width: '41%', background: '#C0392B', borderRadius: 3 }} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#888780', marginBottom: 8 }}>Patterns found</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PATTERNS.map(p => (
            <div key={p.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', background: 'rgba(192,57,43,0.03)',
              borderLeft: `2px solid ${p.color}`, borderRadius: '0 6px 6px 0',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: '#1A1F2E' }}>{p.label}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#888780' }}>{p.count}&times; detected</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: p.color }}>{p.cost}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'rgba(15,76,129,0.04)', border: '0.5px solid rgba(15,76,129,0.15)', borderRadius: 8, padding: '12px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0F4C81', fontWeight: 500, marginBottom: 4 }}>Saathi says</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#3D4052', fontStyle: 'italic', lineHeight: 1.6 }}>Your revenge trading peaked after stop-outs before 11am. Set a 2-loss rule for the morning session.</div>
      </div>
    </div>
  )
}

// ─── HERO ────────────────────────────────────────────────────────────────────
function Hero() {
  const PROOF_STATS = [
    '4,200+ sessions analysed',
    '&#8377;2.1Cr in mistake costs found',
    'Avg 3.2 patterns per trader',
  ]

  return (
    <section style={{ background: '#FAFAFA', position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 80px', position: 'relative', zIndex: 1, width: '100%' }}>
        <div className="hero-grid">
          {/* LEFT */}
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.div variants={item}>
              <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E2E8F0', padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                For F&amp;O traders &middot; NSE &middot; BSE &middot; Any broker
              </span>
            </motion.div>

            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.1, marginTop: 20, marginBottom: 0 }}>
              Every Nifty trader
            </motion.h1>
            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.1, marginTop: 4, marginBottom: 0 }}>
              knows the feeling.
            </motion.h1>

            <motion.h2 variants={item} style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: '#E05252', lineHeight: 1.2, marginTop: 16, marginBottom: 0 }}>
              You just revenge traded again.
            </motion.h2>

            <motion.p variants={item} className="hero-sub" style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.75, maxWidth: 480, marginTop: 20, marginBottom: 0 }}>
              That one trade after a big loss. You knew it was wrong. You placed it anyway. TradeSaath finds every time this happened, tells you exactly what it cost, and gives you a plan to stop.
            </motion.p>

            <motion.div variants={item} style={{ marginTop: 28 }}>
              <motion.a href="/upload" whileHover={{ scale: 1.02, background: '#D97706' }} whileTap={{ scale: 0.98 }}
                className="hero-cta"
                style={{ display: 'inline-flex', alignItems: 'center', background: '#F59E0B', color: '#FFFFFF', height: 48, padding: '0 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
                See my patterns &rarr;
              </motion.a>
            </motion.div>

            <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', marginTop: 10, marginBottom: 0, opacity: 0.7 }}>
              No account needed &middot; Works with Zerodha, Upstox, Angel, and 20+ brokers &middot; Free
            </motion.p>

            <motion.div variants={item} style={{ marginTop: 24 }}>
              {PROOF_STATS.map((s, i) => (
                <div key={i}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)', opacity: 0.65 }} dangerouslySetInnerHTML={{ __html: s }} />
                  {i < PROOF_STATS.length - 1 && (
                    <div style={{ height: '0.5px', background: 'var(--color-border)', margin: '6px 0' }} />
                  )}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* RIGHT — product preview */}
          <motion.div className="hero-preview-col"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}>
            <ProductPreview />
          </motion.div>
        </div>
      </div>

      <style>{`
        .hero-grid{display:grid;grid-template-columns:55fr 45fr;gap:64px;align-items:center}
        .hero-preview-col{display:flex;justify-content:center;align-items:flex-start}
        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr!important;gap:40px!important}
          .hero-h1{font-size:40px!important}
          .hero-sub{font-size:15px!important}
          .hero-cta{display:flex!important;width:100%!important;justify-content:center!important;box-sizing:border-box}
          .hero-preview-col{display:none!important}
        }
      `}</style>
    </section>
  )
}

// ─── BROKER STRIP ────────────────────────────────────────────────────────────
function BrokerStrip() {
  const BROKERS = ['Zerodha', 'Upstox', 'Angel One', 'Groww', 'IIFL', 'Fyers', 'Motilal Oswal', '5Paisa', 'HDFC Sec', 'ICICI Direct', 'Sharekhan', 'Kotak', 'SBI Sec']
  return (
    <div style={{ background: '#FFFFFF', borderTop: '0.5px solid #E5E2D9', borderBottom: '0.5px solid #E5E2D9', padding: '14px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <span style={{ flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', whiteSpace: 'nowrap', paddingRight: 24 }}>Works with</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0 }}>
          {BROKERS.map(b => (
            <span key={b} style={{ flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: '#1A1F2E', whiteSpace: 'nowrap', opacity: 0.55 }}>{b}</span>
          ))}
          <span style={{ flexShrink: 0, fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: '#888780', whiteSpace: 'nowrap' }}>+20 more</span>
        </div>
      </div>
    </div>
  )
}

// ─── STATS BAR ───────────────────────────────────────────────────────────────
function StatItem({ end, prefix = '', suffix = '', label, color = 'var(--color-ink)' }: { end: number; prefix?: string; suffix?: string; label: string; color?: string }) {
  const { count, ref } = useCountUp(end)
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 500, color, lineHeight: 1 }}>
        {prefix}<span ref={ref}>{end >= 1000 ? count.toLocaleString('en-IN') : count}</span>{suffix}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)', marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}

function StatsBar() {
  const STATS = [
    { end: 4200, prefix: '',   suffix: '+',   label: 'Sessions Analysed',      color: '#F59E0B' },
    { end: 284,  prefix: '₹', suffix: 'Cr',  label: 'Mistake Cost Found',     color: '#C0392B' },
    { end: 20,   prefix: '',   suffix: '+',   label: 'Brokers Supported',      color: '#1D9E75' },
    { end: 3,    prefix: '',   suffix: '.2×', label: 'Avg Patterns Per Trader', color: 'var(--color-ink)' },
  ]
  return (
    <motion.section variants={container} initial="hidden" whileInView="visible" viewport={VP}
      style={{ background: '#FFFFFF', padding: '40px 24px', borderTop: '0.5px solid var(--color-border)', borderBottom: '0.5px solid var(--color-border)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }} className="stats-row">
        {STATS.map((s, i) => (
          <div key={s.label} style={{ display: 'contents' }}>
            {i > 0 && <div className="stats-sep" style={{ width: 1, height: 40, background: 'var(--color-border)', flexShrink: 0 }} />}
            <StatItem end={s.end} prefix={s.prefix} suffix={s.suffix} label={s.label} color={s.color} />
          </div>
        ))}
      </div>
      <style>{`
        .stats-row{flex-wrap:wrap;gap:0}
        @media(max-width:768px){
          .stats-row{display:grid!important;grid-template-columns:1fr 1fr;gap:32px 0}
          .stats-sep{display:none!important}
        }
      `}</style>
    </motion.section>
  )
}

// ─── HOW IT WORKS ────────────────────────────────────────────────────────────
function HowItWorks() {
  const STEPS = [
    {
      n: '01',
      title: 'Drop your statement',
      body: 'PDF, CSV, or Excel from any Indian or global broker. Zerodha TradeBook, Upstox P&L, Angel One report. Detected automatically. Takes under 10 seconds.',
    },
    {
      n: '02',
      title: 'We find the psychology',
      body: 'Revenge trading after stop-outs. Averaging down on Nifty positions. Oversized F&O lots on expiry day. Every pattern tagged, counted, and costed.',
    },
    {
      n: '03',
      title: 'You get the plan',
      body: 'Your Discipline Score out of 100. Your top 3 patterns by cost. A specific fix for each one. Not generic advice. Based on your actual trades.',
    },
  ]
  return (
    <Section bg="#FAFAFA">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div variants={item}><SectionLabel>How it works</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Upload once. Know everything.</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'var(--color-muted)', marginTop: 8, marginBottom: 0 }}>
          Supports Zerodha, Upstox, Angel One, Groww, and 20+ others.
        </motion.p>
      </motion.div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, var(--color-border) 20%, var(--color-border) 80%, transparent)', zIndex: 0, pointerEvents: 'none' }} />
        <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden" whileInView="visible" viewport={VP}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative', zIndex: 1 }}
          className="steps-grid">
          {STEPS.map((s) => (
            <motion.div key={s.n} variants={item} whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(26,31,46,0.08)' }} transition={{ duration: 0.2 }}
              style={{ background: '#FFFFFF', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '28px 24px', boxShadow: '0 2px 12px rgba(26,31,46,0.04)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: '#F1EFE8', color: 'var(--color-muted)', padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>{s.n}</span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: 'var(--color-ink)', marginTop: 16, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.65, margin: 0 }}>{s.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
      <style>{`@media(max-width:768px){.steps-grid{grid-template-columns:1fr!important}}`}</style>
    </Section>
  )
}

// ─── WHAT TRADERS DISCOVER (DARK BENTO) ─────────────────────────────────────
function WhatTradersDiscover() {
  const INSIGHTS = [
    {
      number: '&#8377;36,214',
      label: 'average monthly mistake cost',
      color: '#FF6B6B',
      body: 'Most traders don\'t realise how much revenge trading actually costs until they see it added up. This is usually the first shock.',
    },
    {
      number: '666&#215;',
      label: 'patterns detected in one trader\'s 76 sessions',
      color: '#FBBF24',
      body: 'Revenge trading, averaging down, oversized positions. Every instance logged with the exact trade and the exact cost to your account.',
    },
    {
      number: '67 / 100',
      label: 'discipline score, with a detailed breakdown',
      color: '#F8F6F1',
      body: 'Entry quality, risk management, emotional control, position sizing. All scored. The weakest area becomes your coaching priority.',
    },
  ]

  return (
    <section style={{ background: '#080C14' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px 80px' }}>
        <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ marginBottom: 56 }}>
          <motion.div variants={item}><SectionLabel light>The Output</SectionLabel></motion.div>
          <motion.div variants={item}><SectionTitle light>What traders discover</SectionTitle></motion.div>
        </motion.div>

        <div className="bento-grid">
          <motion.div
            variants={item} initial="hidden" whileInView="visible" viewport={VP}
            className="bento-item-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '36px 32px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 500, color: INSIGHTS[0].color, lineHeight: 1, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: INSIGHTS[0].number }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(248,246,241,0.5)', marginBottom: 20, lineHeight: 1.5 }}>{INSIGHTS[0].label}</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, color: 'rgba(248,246,241,0.6)', lineHeight: 1.7, margin: 0 }}>{INSIGHTS[0].body}</p>
          </motion.div>

          <motion.div
            variants={item} initial="hidden" whileInView="visible" viewport={VP}
            className="bento-item-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '32px 28px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, color: INSIGHTS[1].color, lineHeight: 1, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: INSIGHTS[1].number }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(248,246,241,0.5)', marginBottom: 16, lineHeight: 1.5 }}>{INSIGHTS[1].label}</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, color: 'rgba(248,246,241,0.6)', lineHeight: 1.7, margin: 0 }}>{INSIGHTS[1].body}</p>
          </motion.div>

          <motion.div
            variants={item} initial="hidden" whileInView="visible" viewport={VP}
            className="bento-item-3"
            style={{ background: 'rgba(255,165,0,0.06)', border: '0.5px solid rgba(251,191,36,0.2)', borderRadius: 16, padding: '32px 28px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, color: INSIGHTS[2].color, lineHeight: 1, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: INSIGHTS[2].number }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(248,246,241,0.5)', marginBottom: 16, lineHeight: 1.5 }}>{INSIGHTS[2].label}</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, color: 'rgba(248,246,241,0.6)', lineHeight: 1.7, margin: 0 }}>{INSIGHTS[2].body}</p>
          </motion.div>
        </div>

        <style>{`
          .bento-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:16px}
          .bento-item-1{grid-column:1;grid-row:1/3;min-height:400px}
          .bento-item-2{grid-column:2;grid-row:1}
          .bento-item-3{grid-column:2;grid-row:2}
          @media(max-width:768px){
            .bento-grid{grid-template-columns:1fr!important}
            .bento-item-1,.bento-item-2,.bento-item-3{grid-column:1!important;grid-row:auto!important;min-height:auto!important}
          }
        `}</style>
      </div>
    </section>
  )
}

// ─── TRADER QUOTES (DARK) ────────────────────────────────────────────────────
function TraderQuotes() {
  const QUOTES = [
    {
      finding: '&#8377;44,000 in revenge trades',
      findingColor: '#FF6B6B',
      quote: 'I knew I was doing it. Seeing the exact number every session made it impossible to ignore.',
      attribution: 'Nifty options trader · 3 months of data',
    },
    {
      finding: '23% of entries were oversized',
      findingColor: '#FBBF24',
      quote: 'I thought I was managing risk well. The position sizing score said otherwise.',
      attribution: 'BankNifty trader · Weekly expiry focus',
    },
    {
      finding: 'Discipline score: 41 to 68 in 8 weeks',
      findingColor: '#34D399',
      quote: 'The coaching plan was specific to my patterns. Not generic trading advice.',
      attribution: 'Equity + F&O trader · 140 sessions analysed',
    },
  ]

  return (
    <section style={{ background: '#080C14' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 96px' }}>
        <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
          <motion.div variants={item}><SectionLabel light>Traders</SectionLabel></motion.div>
          <motion.div variants={item}><SectionTitle light>What they found</SectionTitle></motion.div>
        </motion.div>
        <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden" whileInView="visible" viewport={VP}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}
          className="quotes-grid">
          {QUOTES.map((q, i) => (
            <motion.div key={i} variants={item}
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color: q.findingColor, lineHeight: 1.3, marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: q.finding }} />
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, color: 'rgba(248,246,241,0.65)', lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 16px', flex: 1 }}>
                &ldquo;{q.quote}&rdquo;
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'rgba(248,246,241,0.35)', margin: 0 }}>
                {q.attribution}
              </p>
            </motion.div>
          ))}
        </motion.div>
        <style>{`@media(max-width:768px){.quotes-grid{grid-template-columns:1fr!important}}`}</style>
      </div>
    </section>
  )
}

// ─── PRICING ─────────────────────────────────────────────────────────────────
function Pricing() {
  return (
    <Section bg="#FFFFFF">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 48 }}>
        <motion.div variants={item}><SectionLabel>Pricing</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Simple pricing</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'var(--color-muted)', marginTop: 8, marginBottom: 0 }}>Start free. No card required.</motion.p>
      </motion.div>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="pricing-grid">
        {/* Free card */}
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={VP} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ background: '#FAFAFA', border: '0.5px solid var(--color-border)', borderRadius: 16, padding: '32px 28px' }}>
          <span style={{ display: 'inline-block', background: '#EAF3DE', color: '#3B6D11', border: '1px solid #97C459', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>FREE</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: 'var(--color-ink)', marginTop: 16, lineHeight: 1 }}>&#8377;0</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-muted)', marginTop: 4, marginBottom: 20 }}>forever</p>
          <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', marginBottom: 20 }} />
          <CheckRow>Upload any broker file</CheckRow>
          <CheckRow>Instant P&amp;L + KPIs</CheckRow>
          <CheckRow>Vicious Cycle detection</CheckRow>
          <CheckRow>3 trade deep analyses</CheckRow>
          <motion.a href="/upload" whileHover={{ background: '#EEECE5' }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, border: '1px solid var(--color-border-strong)', background: 'transparent', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', marginTop: 24, cursor: 'pointer' }}>
            Start free &rarr;
          </motion.a>
        </motion.div>

        {/* Pro card — amber */}
        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={VP} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="pricing-pro-card"
          style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 16, padding: '32px 28px', boxShadow: '0 8px 32px rgba(245,158,11,0.10)' }}>
          <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>Pro Monthly</span>
          <div className="pricing-pro-price" style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: 'var(--color-ink)', marginTop: 16, lineHeight: 1 }}>&#8377;799</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-muted)', marginTop: 4, marginBottom: 20 }}>/month</p>
          <hr style={{ border: 'none', borderTop: '0.5px solid #FDE68A', marginBottom: 20 }} />
          <CheckRow amber>Everything in Free</CheckRow>
          <CheckRow amber>All trades analysed (unlimited)</CheckRow>
          <CheckRow amber>Journal + Journey + Saathi coach</CheckRow>
          <CheckRow amber>DQS score + behavioral insights</CheckRow>
          <CheckRow amber>AI coaching chat</CheckRow>
          <motion.a href="/pricing" whileHover={{ scale: 1.02, background: '#D97706' }} whileTap={{ scale: 0.98 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, background: '#F59E0B', color: '#FFFFFF', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', marginTop: 24, cursor: 'pointer' }}>
            Get Pro &rarr;
          </motion.a>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-muted)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>Most traders upgrade after their first session.</p>
        </motion.div>
      </div>
      <style>{`
        @media(max-width:768px){
          .pricing-grid{grid-template-columns:1fr!important}
          .pricing-pro-card{order:-1!important}
          .pricing-pro-price{font-size:44px!important}
        }
      `}</style>
    </Section>
  )
}

// ─── FINAL CTA ───────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{ background: '#0F172A', padding: '120px 24px', overflow: 'hidden', position: 'relative', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.02) 39px,rgba(255,255,255,0.02) 40px)' }}>
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <style>{`
          @media(max-width:768px){
            .final-cta-h{font-size:36px!important}
            .final-cta-btn{display:flex!important;width:100%!important;max-width:360px!important;margin-left:auto!important;margin-right:auto!important;justify-content:center!important;box-sizing:border-box}
          }
        `}</style>
        <motion.h2 variants={item} className="final-cta-h" style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: '#F8F6F1', lineHeight: 1.15, margin: 0 }}>
          Your next trade is already decided.
        </motion.h2>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'rgba(248,246,241,0.5)', marginTop: 16, marginBottom: 0 }}>
          By habits you don&apos;t know you have. Find them now.
        </motion.p>
        <motion.div variants={item} style={{ marginTop: 32 }}>
          <motion.a href="/upload" whileHover={{ scale: 1.03, background: '#D97706' }} whileTap={{ scale: 0.98 }}
            className="final-cta-btn"
            style={{ display: 'inline-flex', alignItems: 'center', background: '#F59E0B', color: '#FFFFFF', height: 52, padding: '0 36px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
            Analyse my trades &rarr;
          </motion.a>
        </motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'rgba(248,246,241,0.3)', marginTop: 14, marginBottom: 0 }}>
          Free to start &middot; Any broker &middot; 30 seconds
        </motion.p>
      </motion.div>
    </section>
  )
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#080C14', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(248,246,241,0.3)', margin: 0 }}>
          TradeSaath &copy; 2026 &nbsp;&middot;&nbsp;
          <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link>
          &nbsp;&middot;&nbsp;
          <Link href="/faq" style={{ color: 'inherit', textDecoration: 'none' }}>FAQ</Link>
        </p>
      </div>
    </footer>
  )
}

// ─── ROOT EXPORT ─────────────────────────────────────────────────────────────
export default function HomeClient() {
  return (
    <div id="page-home">
      <Hero />
      <BrokerStrip />
      <StatsBar />
      <HowItWorks />
      <WhatTradersDiscover />
      <TraderQuotes />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  )
}
