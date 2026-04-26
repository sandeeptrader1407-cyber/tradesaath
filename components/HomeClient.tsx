'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  type Variants,
} from 'framer-motion'

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
  const { scrollY } = useScroll()
  const cardY = useTransform(scrollY, [0, 600], [0, -50])

  return (
    <section style={{ background: 'var(--color-canvas)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 96px', position: 'relative', zIndex: 1 }}>
        <div className="hero-grid">
          {/* LEFT */}
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.div variants={item}>
              <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border-strong)', padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                For every trader &middot; every market &middot; everywhere
              </span>
            </motion.div>

            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 58, fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.1, marginTop: 20, marginBottom: 0 }}>
              You know your P&amp;L.
            </motion.h1>
            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 58, fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.1, marginTop: 4, marginBottom: 0 }}>
              Not <span style={{ color: 'var(--color-loss)' }}>why.</span>
            </motion.h1>

            <motion.p variants={item} className="hero-sub" style={{ fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 400, color: '#444441', lineHeight: 1.75, maxWidth: 480, marginTop: 20, marginBottom: 0 }}>
              Upload your broker statement and get a complete psychological analysis of your trading — patterns, discipline score, and exactly what to fix. Free.
            </motion.p>

            <motion.div variants={item} style={{ marginTop: 28 }}>
              <motion.a href="/upload" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="hero-cta"
                style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--color-ink)', color: 'var(--color-canvas)', height: 48, padding: '0 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
                Analyse my trades &rarr;
              </motion.a>
            </motion.div>

            <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', marginTop: 10, marginBottom: 0 }}>
              No account needed &middot; Zerodha, Fyers, Upstox, Angel One supported
            </motion.p>

            <motion.p variants={item} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', marginTop: 24, marginBottom: 0 }}>
              282 sessions &middot; 15 traders &middot; 64% free-to-paid
            </motion.p>
          </motion.div>

          {/* RIGHT — parallax card */}
          <motion.div className="hero-card-col" style={{ y: cardY }}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}>
            <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 16, padding: 28, boxShadow: '0 8px 48px rgba(26,31,46,0.08)' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 12px' }}>Your Score</p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  <svg viewBox="0 0 80 80" width={80} height={80}>
                    <circle cx={40} cy={40} r={35} fill="none" stroke="#F1EFE8" strokeWidth={6} />
                    <motion.circle cx={40} cy={40} r={35} fill="none" stroke="var(--color-profit)" strokeWidth={6} strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 35}
                      initial={{ pathLength: 0 }} animate={{ pathLength: 0.67 }}
                      transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
                      style={{ rotate: '-90deg', transformOrigin: '40px 40px' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1 }}>67</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-muted)' }}>/100</span>
                  </div>
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: '16px 0' }} />
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', margin: 0 }}>Top Issue</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-loss)', margin: '4px 0 2px' }}>Revenge Trading</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', margin: 0 }}>&minus;&#8377;36,214 across 106 trades</p>
              <hr style={{ border: 'none', borderTop: '0.5px solid var(--color-border)', margin: '16px 0' }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['52.8% win', '76 sessions', 'DQS 67'].map((label) => (
                  <span key={label} style={{ background: '#F1EFE8', borderRadius: 20, padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>{label}</span>
                ))}
              </div>
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-muted)', textAlign: 'center', marginTop: 10 }}>
              Real data from an active trader&apos;s account
            </p>
          </motion.div>
        </div>
      </div>

      <style>{`
        .hero-grid{display:grid;grid-template-columns:55fr 45fr;gap:64px;align-items:center}
        @media(max-width:768px){
          .hero-card-col{display:none}
          .hero-grid{grid-template-columns:1fr!important;gap:0!important}
          .hero-h1{font-size:40px!important}
          .hero-sub{font-size:15px!important}
          .hero-cta{display:flex!important;width:100%!important;justify-content:center!important;box-sizing:border-box}
        }
      `}</style>
    </section>
  )
}

// ─── STATS BAR ───────────────────────────────────────────────────────────────
function StatItem({ end, suffix = '', label }: { end: number; suffix?: string; label: string }) {
  const { count, ref } = useCountUp(end)
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 500, color: 'var(--color-canvas)', lineHeight: 1 }}>
        <span ref={ref}>{end >= 1000 ? count.toLocaleString('en-IN') : count}</span>{suffix}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(248,246,241,0.5)', marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}

function StatsBar() {
  const STATS = [
    { end: 282,  suffix: '',  label: 'Sessions Analysed' },
    { end: 5616, suffix: '',  label: 'Trades Processed' },
    { end: 9,    suffix: '',  label: 'Pro Traders' },
    { end: 64,   suffix: '%', label: 'Free-to-Paid' },
  ]
  return (
    <motion.section variants={container} initial="hidden" whileInView="visible" viewport={VP}
      style={{ background: 'var(--color-ink)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }} className="stats-row">
        {STATS.map((s, i) => (
          <div key={s.label} style={{ display: 'contents' }}>
            {i > 0 && <div className="stats-sep" style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />}
            <StatItem end={s.end} suffix={s.suffix} label={s.label} />
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
    { n: '01', title: 'Upload your statement', body: 'Zerodha, Fyers, Upstox, Angel One — PDF, CSV, or Excel. Auto-detected in under 10 seconds. Up to 40 files per session.' },
    { n: '02', title: 'AI reads the psychology', body: '10-stage vicious cycle breakdown, revenge trading detection, position sizing errors, and entry quality scoring — for every trade.' },
    { n: '03', title: 'Get your coaching plan', body: 'Discipline score, mistake cost in rupees, and a personalised fix for your top 3 patterns. Instantly.' },
  ]
  return (
    <Section bg="var(--color-canvas)">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div variants={item}><SectionLabel>The Process</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Thirty seconds.</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'var(--color-muted)', marginTop: 8, marginBottom: 0 }}>Upload once. Understand everything.</motion.p>
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

// ─── WHAT YOU GET ────────────────────────────────────────────────────────────
function WhatYouGet() {
  const CARDS = [
    { label: 'Discipline Score', metric: '67 / 100', metricColor: 'var(--color-ink)', showBar: true, body: 'Risk management, emotional control, position sizing, and entry quality — all quantified from your actual trades.' },
    { label: 'Total Mistake Cost', metric: '−₹36,214', metricColor: 'var(--color-loss)', showBar: false, body: 'Exactly how much revenge trading and oversized positions cost you — in rupees, calculated from every single trade.' },
    { label: 'Patterns Detected', metric: '666×', metricColor: '#854F0B', showBar: false, body: 'Revenge trading after losses, averaging down, oversized entries — detected, counted, and explained across all your sessions.' },
  ]
  return (
    <Section bg="var(--color-surface)">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div variants={item}><SectionLabel>The Output</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>What you actually get</SectionTitle></motion.div>
      </motion.div>
      <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        initial="hidden" whileInView="visible" viewport={VP}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}
        className="output-grid">
        {CARDS.map((c) => (
          <motion.div key={c.label} variants={item} whileHover={{ borderColor: 'var(--color-accent)' }} transition={{ duration: 0.2 }}
            style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: 12, padding: '28px 24px', boxShadow: '0 2px 12px rgba(26,31,46,0.04)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)', margin: 0 }}>{c.label}</p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 500, color: c.metricColor, marginTop: 12, lineHeight: 1 }}>{c.metric}</div>
            {c.showBar && (
              <div style={{ height: 3, background: '#F1EFE8', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} whileInView={{ width: '67%' }} viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  style={{ height: '100%', background: 'var(--color-profit)', borderRadius: 2 }} />
              </div>
            )}
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: 'var(--color-muted)', lineHeight: 1.65, marginTop: 16, marginBottom: 0 }}>{c.body}</p>
          </motion.div>
        ))}
      </motion.div>
      <style>{`@media(max-width:768px){.output-grid{grid-template-columns:1fr!important}}`}</style>
    </Section>
  )
}

// ─── SOCIAL PROOF ────────────────────────────────────────────────────────────
function SocialProof() {
  return (
    <section style={{ background: 'var(--color-canvas)', padding: '64px 24px 0' }}>
      <motion.div variants={item} initial="hidden" whileInView="visible" viewport={VP} style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ background: 'var(--color-surface)', borderLeft: '3px solid var(--color-accent)', borderRadius: '0 10px 10px 0', padding: '20px 24px', boxShadow: '0 2px 16px rgba(26,31,46,0.04)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#444441', lineHeight: 1.7, margin: 0 }}>
            Revenge Trading after losses (666&times;) &middot; Oversized position entries (111&times;) &middot; Averaging down on losing trades (178&times;)
          </p>
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-muted)', textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
          Actual patterns detected in a real trader&apos;s 76-session history
        </p>
      </motion.div>
    </section>
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
          Ready to understand your trading?
        </motion.h2>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'rgba(248,246,241,0.5)', marginTop: 16, marginBottom: 0 }}>
          Upload any broker file — results in 30 seconds.
        </motion.p>
        <motion.div variants={item} style={{ marginTop: 32 }}>
          <motion.a href="/upload" whileHover={{ scale: 1.03, background: '#FFFFFF' }} whileTap={{ scale: 0.98 }}
            className="final-cta-btn"
            style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-ink)', height: 52, padding: '0 36px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
            Analyse my trades &rarr;
          </motion.a>
        </motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'rgba(248,246,241,0.3)', marginTop: 14, marginBottom: 0 }}>
          No account needed &middot; Free forever
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
      <WhatYouGet />
      <SocialProof />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  )
}
