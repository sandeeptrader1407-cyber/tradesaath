'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  motion,
  useInView,
  type Variants,
} from 'framer-motion'

const TradingGlobe = dynamic(() => import('./home/TradingGlobe'), {
  ssr: false,
  loading: () => <div style={{ height: 400 }} />,
})

// ─── Shared animation variants ──────────────────────────────────────────────
const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
  },
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
function CheckRow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <span style={{ color: 'var(--color-profit)', fontSize: 14, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>&#10003;</span>
      <span style={{
        fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
        color: light ? 'rgba(248,246,241,0.8)' : '#444441', lineHeight: 1.5,
      }}>{children}</span>
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ children, bg, style }: { children: React.ReactNode; bg?: string; style?: React.CSSProperties }) {
  return (
    <section style={{ background: bg ?? 'var(--color-canvas)', ...style }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px' }}>
        {children}
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)', margin: 0 }}>
      {children}
    </p>
  )
}

function SectionTitle({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400, color: light ? 'var(--color-canvas)' : 'var(--color-ink)', lineHeight: 1.1, marginTop: 12, marginBottom: 0 }}>
      {children}
    </h2>
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
    <section style={{ background: 'var(--color-ink)', position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 80px', position: 'relative', zIndex: 1, width: '100%' }}>
        <div className="hero-grid">
          {/* LEFT */}
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.div variants={item}>
              <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(248,246,241,0.6)' }}>
                For F&amp;O traders &middot; NSE &middot; BSE &middot; Any broker
              </span>
            </motion.div>

            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 400, color: '#F8F6F1', lineHeight: 1.1, marginTop: 20, marginBottom: 0 }}>
              Every Nifty trader
            </motion.h1>
            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 400, color: '#F8F6F1', lineHeight: 1.1, marginTop: 4, marginBottom: 0 }}>
              knows the feeling.
            </motion.h1>

            <motion.h2 variants={item} style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: '#E05252', lineHeight: 1.2, marginTop: 16, marginBottom: 0 }}>
              You just revenge traded again.
            </motion.h2>

            <motion.p variants={item} className="hero-sub" style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 400, color: 'rgba(248,246,241,0.65)', lineHeight: 1.75, maxWidth: 480, marginTop: 20, marginBottom: 0 }}>
              That one trade after a big loss. You knew it was wrong. You placed it anyway. TradeSaath finds every time this happened, tells you exactly what it cost, and gives you a plan to stop.
            </motion.p>

            <motion.div variants={item} style={{ marginTop: 28 }}>
              <motion.a href="/upload" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="hero-cta"
                style={{ display: 'inline-flex', alignItems: 'center', background: '#F8F6F1', color: '#1A1F2E', height: 48, padding: '0 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
                See my patterns &rarr;
              </motion.a>
            </motion.div>

            <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'rgba(248,246,241,0.4)', marginTop: 10, marginBottom: 0 }}>
              No account needed &middot; Works with Zerodha, Upstox, Angel, and 20+ brokers &middot; Free
            </motion.p>

            <motion.div variants={item} style={{ marginTop: 24 }}>
              {PROOF_STATS.map((s, i) => (
                <div key={i}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(248,246,241,0.35)' }} dangerouslySetInnerHTML={{ __html: s }} />
                  {i < PROOF_STATS.length - 1 && (
                    <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
                  )}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* RIGHT — globe */}
          <motion.div className="hero-globe-col"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}>
            <TradingGlobe />
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(248,246,241,0.5)' }}>
                47 traders analysed today
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        .hero-grid{display:grid;grid-template-columns:55fr 45fr;gap:64px;align-items:center}
        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr!important;gap:40px!important}
          .hero-h1{font-size:40px!important}
          .hero-sub{font-size:15px!important}
          .hero-cta{display:flex!important;width:100%!important;justify-content:center!important;box-sizing:border-box}
        }
      `}</style>
    </section>
  )
}

// ─── STATS BAR ───────────────────────────────────────────────────────────────
function StatItem({ end, prefix = '', suffix = '', label }: { end: number; prefix?: string; suffix?: string; label: string }) {
  const { count, ref } = useCountUp(end)
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1 }}>
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
    { end: 4200, prefix: '',   suffix: '+',    label: 'Sessions Analysed' },
    { end: 284,  prefix: '₹', suffix: 'Cr',   label: 'Mistake Cost Found' },
    { end: 20,   prefix: '',   suffix: '+',    label: 'Brokers Supported' },
    { end: 3,    prefix: '',   suffix: '.2×',  label: 'Avg Patterns Per Trader' },
  ]
  return (
    <motion.section variants={container} initial="hidden" whileInView="visible" viewport={VP}
      style={{ background: 'var(--color-canvas)', padding: '40px 24px', borderTop: '0.5px solid var(--color-border)', borderBottom: '0.5px solid var(--color-border)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }} className="stats-row">
        {STATS.map((s, i) => (
          <div key={s.label} style={{ display: 'contents' }}>
            {i > 0 && <div className="stats-sep" style={{ width: 1, height: 40, background: 'var(--color-border)', flexShrink: 0 }} />}
            <StatItem end={s.end} prefix={s.prefix} suffix={s.suffix} label={s.label} />
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
    <Section bg="var(--color-canvas)">
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
              style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '28px 24px', boxShadow: '0 2px 12px rgba(26,31,46,0.04)' }}>
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

// ─── WHAT TRADERS DISCOVER ───────────────────────────────────────────────────
function WhatTradersDiscover() {
  const INSIGHTS = [
    {
      number: '&#8377;36,214',
      label: 'average monthly mistake cost',
      color: 'var(--color-loss)',
      body: 'Most traders don\'t realise how much revenge trading actually costs until they see it added up. This is usually the first shock.',
    },
    {
      number: '666&#215;',
      label: 'patterns detected in one trader\'s 76 sessions',
      color: '#854F0B',
      body: 'Revenge trading, averaging down, oversized positions. Every instance logged with the exact trade and the exact cost to your account.',
    },
    {
      number: '67 / 100',
      label: 'discipline score, with a detailed breakdown',
      color: 'var(--color-ink)',
      body: 'Entry quality, risk management, emotional control, position sizing. All scored. The weakest area becomes your coaching priority.',
    },
  ]

  return (
    <Section bg="var(--color-surface)">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ marginBottom: 48 }}>
        <motion.div variants={item}><SectionLabel>The Output</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>What traders discover</SectionTitle></motion.div>
      </motion.div>
      <style>{`@media(max-width:768px){.insight-row{flex-direction:column!important;gap:20px!important}}`}</style>
      {INSIGHTS.map((ins, i) => (
        <motion.div key={i} variants={item} initial="hidden" whileInView="visible" viewport={VP}>
          {i > 0 && <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: '40px 0' }} />}
          <div className="insight-row" style={{ display: 'flex', gap: 64, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, minWidth: 180 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 500, color: ins.color, lineHeight: 1 }} dangerouslySetInnerHTML={{ __html: ins.number }} />
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-muted)', marginTop: 8, lineHeight: 1.5 }}>{ins.label}</div>
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.7, margin: 0, flex: 1 }}>{ins.body}</p>
          </div>
        </motion.div>
      ))}
    </Section>
  )
}

// ─── TRADER QUOTES ───────────────────────────────────────────────────────────
function TraderQuotes() {
  const QUOTES = [
    {
      finding: '&#8377;44,000 in revenge trades',
      findingColor: 'var(--color-loss)',
      quote: 'I knew I was doing it. Seeing the exact number every session made it impossible to ignore.',
      attribution: 'Nifty options trader · 3 months of data',
    },
    {
      finding: '23% of entries were oversized',
      findingColor: '#C07B2A',
      quote: 'I thought I was managing risk well. The position sizing score said otherwise.',
      attribution: 'BankNifty trader · Weekly expiry focus',
    },
    {
      finding: 'Discipline score: 41 to 68 in 8 weeks',
      findingColor: 'var(--color-profit)',
      quote: 'The coaching plan was specific to my patterns. Not generic trading advice.',
      attribution: 'Equity + F&O trader · 140 sessions analysed',
    },
  ]

  return (
    <Section bg="var(--color-canvas)">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div variants={item}><SectionLabel>Traders</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>What they found</SectionTitle></motion.div>
      </motion.div>
      <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        initial="hidden" whileInView="visible" viewport={VP}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}
        className="quotes-grid">
        {QUOTES.map((q, i) => (
          <motion.div key={i} variants={item}
            style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '28px 24px', boxShadow: '0 2px 12px rgba(26,31,46,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: q.findingColor, lineHeight: 1.2, marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: q.finding }} />
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 16px', flex: 1 }}>
              &ldquo;{q.quote}&rdquo;
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', margin: 0, opacity: 0.65 }}>
              {q.attribution}
            </p>
          </motion.div>
        ))}
      </motion.div>
      <style>{`@media(max-width:768px){.quotes-grid{grid-template-columns:1fr!important}}`}</style>
    </Section>
  )
}

// ─── PRICING ─────────────────────────────────────────────────────────────────
function Pricing() {
  return (
    <Section bg="var(--color-surface)">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 48 }}>
        <motion.div variants={item}><SectionLabel>Pricing</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Simple pricing</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'var(--color-muted)', marginTop: 8, marginBottom: 0 }}>Start free. No card required.</motion.p>
      </motion.div>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="pricing-grid">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={VP} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ background: 'var(--color-canvas)', border: '0.5px solid var(--color-border)', borderRadius: 16, padding: '32px 28px' }}>
          <span style={{ display: 'inline-block', background: '#EAF3DE', color: '#3B6D11', border: '1px solid #97C459', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>FREE</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: 'var(--color-ink)', marginTop: 16, lineHeight: 1 }}>&#8377;0</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-muted)', marginTop: 4, marginBottom: 20 }}>forever</p>
          <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', marginBottom: 20 }} />
          <CheckRow>Upload any broker file</CheckRow>
          <CheckRow>Instant P&amp;L + KPIs</CheckRow>
          <CheckRow>Vicious Cycle detection</CheckRow>
          <CheckRow>3 trade deep analyses</CheckRow>
          <motion.a href="/upload" whileHover={{ background: 'var(--s2)' }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, border: '1px solid var(--color-border-strong)', background: 'transparent', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', marginTop: 24, cursor: 'pointer' }}>
            Start free &rarr;
          </motion.a>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={VP} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="pricing-pro-card"
          style={{ background: 'var(--color-ink)', borderRadius: 16, padding: '32px 28px', boxShadow: '0 16px 64px rgba(26,31,46,0.2)' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', color: 'var(--color-canvas)', border: '1px solid rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>Pro Monthly</span>
          <div className="pricing-pro-price" style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: 'var(--color-canvas)', marginTop: 16, lineHeight: 1 }}>&#8377;799</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(248,246,241,0.5)', marginTop: 4, marginBottom: 20 }}>/month</p>
          <hr style={{ border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.1)', marginBottom: 20 }} />
          <CheckRow light>Everything in Free</CheckRow>
          <CheckRow light>All trades analysed (unlimited)</CheckRow>
          <CheckRow light>Journal + Journey + Saathi coach</CheckRow>
          <CheckRow light>DQS score + behavioral insights</CheckRow>
          <CheckRow light>AI coaching chat</CheckRow>
          <motion.a href="/pricing" whileHover={{ scale: 1.02, background: '#FFFFFF' }} whileTap={{ scale: 0.98 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, background: 'var(--color-canvas)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', marginTop: 24, cursor: 'pointer' }}>
            Get Pro &rarr;
          </motion.a>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'rgba(248,246,241,0.4)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>Most traders upgrade after their first session.</p>
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
    <section style={{ background: 'var(--color-ink)', padding: '120px 24px', overflow: 'hidden', position: 'relative', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.03) 39px,rgba(255,255,255,0.03) 40px)' }}>
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <style>{`
          @media(max-width:768px){
            .final-cta-h{font-size:36px!important}
            .final-cta-btn{display:flex!important;width:100%!important;max-width:360px!important;margin-left:auto!important;margin-right:auto!important;justify-content:center!important;box-sizing:border-box}
          }
        `}</style>
        <motion.h2 variants={item} className="final-cta-h" style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: 'var(--color-canvas)', lineHeight: 1.15, margin: 0 }}>
          Your next trade is already decided.
        </motion.h2>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'rgba(248,246,241,0.5)', marginTop: 16, marginBottom: 0 }}>
          By habits you don&apos;t know you have. Find them now.
        </motion.p>
        <motion.div variants={item} style={{ marginTop: 32 }}>
          <motion.a href="/upload" whileHover={{ scale: 1.03, background: '#FFFFFF' }} whileTap={{ scale: 0.98 }}
            className="final-cta-btn"
            style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)', height: 52, padding: '0 36px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
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
    <footer style={{ background: '#111318', padding: '32px 24px' }}>
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
