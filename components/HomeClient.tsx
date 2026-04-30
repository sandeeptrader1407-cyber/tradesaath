'use client'

import { useEffect, useRef, useState } from 'react'
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

// ─── Mouse parallax hook ─────────────────────────────────────────────────────
function useMouseParallax() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      setMouse({
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      })
    }
    const reset = () => setMouse({ x: 0, y: 0 })
    el.addEventListener('mousemove', handler)
    el.addEventListener('mouseleave', reset)
    return () => {
      el.removeEventListener('mousemove', handler)
      el.removeEventListener('mouseleave', reset)
    }
  }, [])

  return { mouse, ref }
}

// ─── Checklist row ───────────────────────────────────────────────────────────
function CheckRow({ children, amber = false }: { children: React.ReactNode; amber?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <span style={{ color: amber ? '#F59E0B' : '#16A34A', fontSize: 14, lineHeight: 1, paddingTop: 1, flexShrink: 0 }}>&#10003;</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400, color: '#64748B', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ children, bg, style }: { children: React.ReactNode; bg?: string; style?: React.CSSProperties }) {
  return (
    <section style={{ background: bg ?? '#F8FAFC', ...style }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px' }}>
        {children}
      </div>
    </section>
  )
}

function SectionLabel({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: light ? 'rgba(241,245,249,0.35)' : '#94A3B8', margin: 0 }}>
      {children}
    </p>
  )
}

function SectionTitle({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400, color: light ? '#F1F5F9' : '#0F172A', lineHeight: 1.1, marginTop: 12, marginBottom: 0 }}>
      {children}
    </h2>
  )
}

// ─── Particle canvas background ──────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let W = 0, H = 0

    const COLORS = [
      'rgba(245,158,11,',
      'rgba(244,63,94,',
      'rgba(16,185,129,',
      'rgba(99,102,241,',
      'rgba(248,246,241,',
    ]

    type Particle = {
      x: number; y: number
      vx: number; vy: number
      r: number; color: string
      opacity: number; phase: number
    }

    let particles: Particle[] = []

    function resize() {
      W = canvas!.width = canvas!.offsetWidth
      H = canvas!.height = canvas!.offsetHeight
    }

    function init() {
      resize()
      particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, W, H)

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 110) {
            const alpha = 0.08 * (1 - dist / 110)
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(99,102,241,${alpha.toFixed(3)})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
        const pulse = p.opacity + 0.15 * Math.sin(t * 0.0008 + p.phase)
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `${p.color}${Math.max(0.05, pulse).toFixed(2)})`
        ctx!.fill()
      })

      animId = requestAnimationFrame(draw)
    }

    init()
    animId = requestAnimationFrame(draw)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

// ─── 3D floating product cards ────────────────────────────────────────────────
function ProductCards({ mouse }: { mouse: { x: number; y: number } }) {
  const t = (depth: number) => ({
    transform: `
      perspective(900px)
      rotateY(${mouse.x * depth * 18}deg)
      rotateX(${-mouse.y * depth * 14}deg)
      translateZ(${depth * 30}px)
    `,
    transition: 'transform 0.12s ease-out',
  })

  return (
    <div style={{ position: 'relative', height: 380, width: '100%' }}>
      {/* Card 1 — DQS Score */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 200,
        background: 'rgba(15,23,42,0.92)', border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: '20px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.05)',
        ...t(0.4),
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)', marginBottom: 10 }}>Discipline Score</div>
        <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 12 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
            <circle cx="36" cy="36" r="28" fill="none" stroke="#F59E0B" strokeWidth="5"
              strokeDasharray={`${28 * 2 * Math.PI * 0.67} ${28 * 2 * Math.PI * 0.33}`}
              strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: '#F59E0B' }}>67</div>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'rgba(241,245,249,0.4)' }}>Above avg trader</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ l: 'Entry: 18%', c: '#F43F5E' }, { l: 'Exit: 91%', c: '#10B981' }].map(({ l, c }) => (
            <span key={l} style={{ fontFamily: 'var(--font-sans)', fontSize: 10, padding: '2px 7px', background: `${c}18`, color: c, border: `1px solid ${c}33`, borderRadius: 20 }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Card 2 — Patterns */}
      <div style={{
        position: 'absolute', top: 90, left: 0, width: 210,
        background: '#FFFFFF', border: '0.5px solid #E2E8F0',
        borderRadius: 14, padding: '20px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        ...t(0.7),
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 12 }}>Patterns found</div>
        {[
          { label: 'Revenge trading', pct: 78, count: '666×', color: '#DC2626' },
          { label: 'Oversized lots', pct: 45, count: '111×', color: '#F59E0B' },
          { label: 'Averaging down', pct: 55, count: '178×', color: '#F59E0B' },
        ].map(({ label, pct, count, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#64748B' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 52, height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, minWidth: 30 }}>{count}</span>
            </div>
          </div>
        ))}
        <div style={{ height: '0.5px', background: '#F1F5F9', margin: '12px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#94A3B8' }}>Monthly cost</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: '#DC2626' }}>&#8377;36,214</span>
        </div>
      </div>

      {/* Card 3 — Saathi recommendation */}
      <div style={{
        position: 'absolute', bottom: 0, right: 10, width: 220,
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 14, padding: '18px 20px',
        boxShadow: '0 8px 32px rgba(245,158,11,0.15), 0 0 0 0.5px rgba(245,158,11,0.1)',
        ...t(1.0),
      }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B45309', marginBottom: 10 }}>Saathi recommends</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#F1F5F9', lineHeight: 1.55 }}>
          Stop entries within <strong style={{ color: '#FCD34D', fontWeight: 500 }}>3 trades</strong> of a loss.
        </div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: '#34D399' }}>
          Saves ~&#8377;18,000/month
        </div>
      </div>
    </div>
  )
}

// ─── HERO ────────────────────────────────────────────────────────────────────
function Hero() {
  const { mouse, ref: heroRef } = useMouseParallax()

  const PROOF_STATS = [
    '4,200+ sessions analysed',
    '&#8377;2.1Cr in mistake costs found',
    'Avg 3.2 patterns per trader',
  ]

  return (
    <section
      ref={heroRef}
      style={{ background: '#080C14', position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center' }}
    >
      <ParticleCanvas />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 80% at 30% 50%, transparent 40%, rgba(8,12,20,0.7) 100%)' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 80px', position: 'relative', zIndex: 2, width: '100%' }}>
        <div className="hero-grid">
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.div variants={item}>
              <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.45)' }}>
                For F&amp;O traders &middot; NSE &middot; BSE &middot; Any broker
              </span>
            </motion.div>

            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 68, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.0, letterSpacing: '-0.025em', marginTop: 24, marginBottom: 0 }}>
              Every Nifty trader
            </motion.h1>
            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 68, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.0, letterSpacing: '-0.025em', marginTop: 4, marginBottom: 0 }}>
              knows the feeling.
            </motion.h1>

            <motion.h2 variants={item} style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 400, color: '#F43F5E', lineHeight: 1.15, letterSpacing: '-0.02em', marginTop: 14, marginBottom: 0 }}>
              You just revenge traded again.
            </motion.h2>

            <motion.p variants={item} className="hero-sub" style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'rgba(241,245,249,0.58)', lineHeight: 1.8, maxWidth: 460, marginTop: 22, marginBottom: 0 }}>
              That trade after the big loss. You knew it was wrong.
              You placed it anyway. TradeSaath finds every time this
              happened, tells you exactly what it cost, and gives you
              a plan to stop.
            </motion.p>

            <motion.div variants={item} style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
              <motion.a href="/upload" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="hero-cta"
                style={{ display: 'inline-flex', alignItems: 'center', background: '#F59E0B', color: '#080C14', height: 50, padding: '0 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
                Analyse my trades &rarr;
              </motion.a>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(241,245,249,0.32)' }}>
                Free &middot; No account needed
              </span>
            </motion.div>

            <motion.div variants={item} style={{ marginTop: 32 }}>
              {PROOF_STATS.map((s, i) => (
                <div key={i}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(241,245,249,0.35)' }} dangerouslySetInnerHTML={{ __html: s }} />
                  {i < PROOF_STATS.length - 1 && (
                    <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.07)', margin: '7px 0' }} />
                  )}
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div className="hero-globe-col"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}>
            <ProductCards mouse={mouse} />
          </motion.div>
        </div>
      </div>

      <style>{`
        .hero-grid { display: grid; grid-template-columns: 55fr 45fr; gap: 64px; align-items: center; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .hero-h1 { font-size: 42px !important; }
          .hero-sub { font-size: 15px !important; }
          .hero-cta { display: flex !important; width: 100% !important; justify-content: center !important; box-sizing: border-box; }
          .hero-globe-col { display: none !important; }
        }
      `}</style>
    </section>
  )
}

// ─── BROKER STRIP ────────────────────────────────────────────────────────────
function BrokerStrip() {
  const ITEMS = [
    { name: 'Zerodha',             region: 'IN' },
    { name: 'Upstox',              region: 'IN' },
    { name: 'Angel One',           region: 'IN' },
    { name: 'Groww',               region: 'IN' },
    { name: 'Fyers',               region: 'IN' },
    { name: 'IIFL',                region: 'IN' },
    { name: 'Motilal Oswal',       region: 'IN' },
    { name: '5Paisa',              region: 'IN' },
    { name: 'HDFC Sec',            region: 'IN' },
    { name: 'ICICI Direct',        region: 'IN' },
    { name: 'Kotak Neo',           region: 'IN' },
    { name: 'Sharekhan',           region: 'IN' },
    { name: 'SBI Sec',             region: 'IN' },
    { name: 'Dhan',                region: 'IN' },
    { name: 'Paytm Money',         region: 'IN' },
    { name: 'Interactive Brokers', region: 'GL' },
    { name: 'TD Ameritrade',       region: 'GL' },
    { name: 'Robinhood',           region: 'GL' },
    { name: 'eToro',               region: 'GL' },
    { name: 'Saxo Bank',           region: 'GL' },
    { name: 'XTB',                 region: 'GL' },
    { name: 'IG Markets',          region: 'GL' },
    { name: 'Webull',              region: 'GL' },
    { name: 'Tastytrade',          region: 'GL' },
    { name: 'Alpaca',              region: 'GL' },
    { name: 'Oanda',               region: 'GL' },
    { name: 'Plus500',             region: 'GL' },
    { name: 'Capital.com',         region: 'GL' },
    { name: 'Binance',             region: 'GL' },
    { name: 'Coinbase',            region: 'GL' },
  ]

  const DOUBLED = [...ITEMS, ...ITEMS]

  return (
    <div style={{
      background: '#080C14',
      borderTop: '0.5px solid rgba(255,255,255,0.07)',
      borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      padding: '12px 0',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Left fade */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, zIndex: 2,
        background: 'linear-gradient(to right, #080C14 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      {/* Right fade */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, zIndex: 2,
        background: 'linear-gradient(to left, #080C14 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Label */}
      <div style={{
        position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
        fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'rgba(241,245,249,0.22)',
        zIndex: 3, whiteSpace: 'nowrap',
      }}>
        Works with
      </div>

      {/* Scrolling track */}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 110 }}>
        <div className="broker-marquee" style={{ display: 'flex', alignItems: 'center', gap: 0, willChange: 'transform' }}>
          {DOUBLED.map((item, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '0 18px',
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                whiteSpace: 'nowrap',
                color: item.region === 'IN' ? 'rgba(241,245,249,0.55)' : 'rgba(241,245,249,0.35)',
                borderRight: '0.5px solid rgba(255,255,255,0.06)',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color =
                  item.region === 'IN' ? '#F59E0B' : 'rgba(241,245,249,0.6)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color =
                  item.region === 'IN' ? 'rgba(241,245,249,0.55)' : 'rgba(241,245,249,0.35)'
              }}
            >
              {item.name}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .broker-marquee {
          animation: marquee-scroll 40s linear infinite;
        }
        .broker-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

// ─── STATS BAR ───────────────────────────────────────────────────────────────
function StatItem({ end, prefix = '', suffix = '', label, color = '#F1F5F9' }: { end: number; prefix?: string; suffix?: string; label: string; color?: string }) {
  const { count, ref } = useCountUp(end)
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 500, color, lineHeight: 1 }}>
        {prefix}<span ref={ref}>{end >= 1000 ? count.toLocaleString('en-IN') : count}</span>{suffix}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)', marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}

function StatsBar() {
  const STATS = [
    { end: 4200, prefix: '',   suffix: '+',   label: 'Sessions Analysed',       color: '#F59E0B' },
    { end: 284,  prefix: '₹', suffix: 'Cr',  label: 'Mistake Cost Found',      color: '#F43F5E' },
    { end: 20,   prefix: '',   suffix: '+',   label: 'Brokers Supported',       color: '#10B981' },
    { end: 3,    prefix: '',   suffix: '.2×', label: 'Avg Patterns Per Trader', color: '#F1F5F9' },
  ]
  return (
    <motion.section variants={container} initial="hidden" whileInView="visible" viewport={VP}
      style={{ background: '#0D1421', padding: '40px 24px', borderTop: '0.5px solid rgba(255,255,255,0.07)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center' }} className="stats-row">
        {STATS.map((s, i) => (
          <div key={s.label} style={{ display: 'contents' }}>
            {i > 0 && <div className="stats-sep" style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />}
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

// ─── PRODUCT SCREENSHOT ──────────────────────────────────────────────────────
function ProductScreenshot() {
  return (
    <section style={{
      background: '#080C14',
      padding: '96px 24px',
      overflow: 'hidden',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(241,245,249,0.35)', marginBottom: 12,
          }}>
            The product
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 44,
            fontWeight: 400, color: '#F1F5F9', lineHeight: 1.1,
            letterSpacing: '-0.025em', marginBottom: 14,
          }}>
            This is what you see after<br />uploading your first session.
          </h2>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 15,
            color: 'rgba(241,245,249,0.5)', maxWidth: 480,
            margin: '0 auto', lineHeight: 1.75,
          }}>
            Your score. Your patterns. Your cost. Your plan.
            All from one file upload.
          </p>
        </div>

        {/* Browser frame */}
        <div style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: '0.5px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        }}>
          {/* Browser chrome bar */}
          <div style={{
            background: '#111827',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}>
            {/* Traffic lights */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['#F43F5E', '#F59E0B', '#10B981'] as const).map((c, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
              ))}
            </div>
            {/* URL bar */}
            <div style={{
              flex: 1, maxWidth: 320, margin: '0 auto',
              background: '#1E2936', borderRadius: 5,
              padding: '4px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'rgba(241,245,249,0.3)',
            }}>
              tradesaath.com/dashboard
            </div>
          </div>

          {/* Screenshot */}
          <div style={{ background: '#F5F3EE', lineHeight: 0 }}>
            <img
              src="/screenshots/dashboard-preview.png"
              alt="TradeSaath dashboard showing discipline score, pattern analysis and monthly P&L"
              style={{ width: '100%', display: 'block', objectFit: 'cover' }}
              onError={e => {
                const el = e.currentTarget as HTMLImageElement
                el.style.display = 'none'
                const fallback = el.nextSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            {/* Fallback placeholder */}
            <div style={{
              display: 'none',
              height: 400,
              background: '#F5F3EE',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: '#94A3B8', textAlign: 'center', lineHeight: 1.6,
              }}>
                Add your dashboard screenshot to<br />
                public/screenshots/dashboard-preview.png
              </div>
            </div>
          </div>
        </div>

        {/* Caption row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
          marginTop: 28,
          flexWrap: 'wrap',
        }}>
          {[
            { n: 'Discipline Score', d: 'Your trading psychology, scored 0-100' },
            { n: 'Pattern Cost', d: 'Exact rupee cost of each bad habit' },
            { n: 'Coaching Plan', d: 'Specific fix for your weakest area' },
          ].map(({ n, d }) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                fontWeight: 500, color: '#F1F5F9', marginBottom: 3,
              }}>{n}</div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 12,
                color: 'rgba(241,245,249,0.38)',
              }}>{d}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
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
    <Section bg="#F8FAFC">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div variants={item}><SectionLabel>How it works</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Upload once. Know everything.</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: '#64748B', marginTop: 8, marginBottom: 0 }}>
          Supports Zerodha, Upstox, Angel One, Groww, and 20+ others.
        </motion.p>
      </motion.div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, #E2E8F0 20%, #E2E8F0 80%, transparent)', zIndex: 0, pointerEvents: 'none' }} />
        <motion.div variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          initial="hidden" whileInView="visible" viewport={VP}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative', zIndex: 1 }}
          className="steps-grid">
          {STEPS.map((s) => (
            <motion.div key={s.n} variants={item} whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(15,23,42,0.10)' }} transition={{ duration: 0.2 }}
              style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 12, padding: '28px 24px', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#F1F5F9', color: '#94A3B8', padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>{s.n}</span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: '#0F172A', marginTop: 16, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, color: '#64748B', lineHeight: 1.7, margin: 0 }}>{s.body}</p>
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
      color: '#F1F5F9',
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
          <motion.div variants={item} initial="hidden" whileInView="visible" viewport={VP} className="bento-item-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '36px 32px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 500, color: INSIGHTS[0].color, lineHeight: 1, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: INSIGHTS[0].number }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(241,245,249,0.35)', marginBottom: 20, lineHeight: 1.5 }}>{INSIGHTS[0].label}</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.5)', lineHeight: 1.7, margin: 0 }}>{INSIGHTS[0].body}</p>
          </motion.div>

          <motion.div variants={item} initial="hidden" whileInView="visible" viewport={VP} className="bento-item-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '32px 28px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, color: INSIGHTS[1].color, lineHeight: 1, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: INSIGHTS[1].number }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(241,245,249,0.35)', marginBottom: 16, lineHeight: 1.5 }}>{INSIGHTS[1].label}</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.5)', lineHeight: 1.7, margin: 0 }}>{INSIGHTS[1].body}</p>
          </motion.div>

          <motion.div variants={item} initial="hidden" whileInView="visible" viewport={VP} className="bento-item-3"
            style={{ background: 'rgba(255,165,0,0.06)', border: '0.5px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '32px 28px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, color: INSIGHTS[2].color, lineHeight: 1, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: INSIGHTS[2].number }} />
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(241,245,249,0.35)', marginBottom: 16, lineHeight: 1.5 }}>{INSIGHTS[2].label}</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.5)', lineHeight: 1.7, margin: 0 }}>{INSIGHTS[2].body}</p>
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

// ─── TRADER QUOTES ───────────────────────────────────────────────────────────
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
    <section style={{ background: '#0D1421' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 96px' }}>
        <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56, paddingTop: 80 }}>
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: q.findingColor, lineHeight: 1.3, marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: q.finding }} />
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 400, color: 'rgba(241,245,249,0.62)', lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 16px', flex: 1 }}>
                &ldquo;{q.quote}&rdquo;
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'rgba(241,245,249,0.32)', margin: 0 }}>
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
    <Section bg="#F8FAFC">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 48 }}>
        <motion.div variants={item}><SectionLabel>Pricing</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Simple pricing</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: '#64748B', marginTop: 8, marginBottom: 0 }}>Start free. No card required.</motion.p>
      </motion.div>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="pricing-grid">
        {/* Free */}
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={VP} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 16, padding: '32px 28px' }}>
          <span style={{ display: 'inline-block', background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>FREE</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: '#0F172A', marginTop: 16, lineHeight: 1 }}>&#8377;0</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20 }}>Free forever</p>
          <hr style={{ border: 'none', borderTop: '0.5px solid #E2E8F0', marginBottom: 20 }} />
          <CheckRow>Upload any broker file</CheckRow>
          <CheckRow>Instant P&amp;L + KPIs</CheckRow>
          <CheckRow>Vicious Cycle detection</CheckRow>
          <CheckRow>3 trade deep analyses</CheckRow>
          <motion.a href="/upload" whileHover={{ background: '#F8FAFC' }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, border: '0.5px solid #CBD5E1', background: 'transparent', color: '#0F172A', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', marginTop: 24, cursor: 'pointer' }}>
            Start free &rarr;
          </motion.a>
        </motion.div>

        {/* Pro */}
        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={VP} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="pricing-pro-card"
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: '32px 28px', boxShadow: '0 8px 32px rgba(245,158,11,0.10)' }}>
          <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500 }}>Pro Monthly</span>
          <div className="pricing-pro-price" style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: '#0F172A', marginTop: 16, lineHeight: 1 }}>&#8377;799</div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20 }}>/month</p>
          <hr style={{ border: 'none', borderTop: '0.5px solid #FDE68A', marginBottom: 20 }} />
          <CheckRow amber>Everything in Free</CheckRow>
          <CheckRow amber>All trades analysed (unlimited)</CheckRow>
          <CheckRow amber>Journal + Journey + Saathi coach</CheckRow>
          <CheckRow amber>DQS score + behavioral insights</CheckRow>
          <CheckRow amber>AI coaching chat</CheckRow>
          <motion.a href="/pricing" whileHover={{ scale: 1.02, background: '#D97706' }} whileTap={{ scale: 0.98 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 8, background: '#F59E0B', color: '#080C14', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', marginTop: 24, cursor: 'pointer', border: 'none' }}>
            Get Pro &rarr;
          </motion.a>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>Most traders upgrade after their first session.</p>
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
    <section style={{ background: '#080C14', padding: '120px 24px', overflow: 'hidden', position: 'relative', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.02) 39px,rgba(255,255,255,0.02) 40px)' }}>
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <style>{`
          @media(max-width:768px){
            .final-cta-h{font-size:36px!important}
            .final-cta-btn{display:flex!important;width:100%!important;max-width:360px!important;margin-left:auto!important;margin-right:auto!important;justify-content:center!important;box-sizing:border-box}
          }
        `}</style>
        <motion.h2 variants={item} className="final-cta-h" style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.1, margin: 0, letterSpacing: '-0.025em' }}>
          Your next trade is already decided.
        </motion.h2>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'rgba(241,245,249,0.45)', marginTop: 16, marginBottom: 0 }}>
          By habits you don&apos;t know you have. Find them now.
        </motion.p>
        <motion.div variants={item} style={{ marginTop: 32 }}>
          <motion.a href="/upload" whileHover={{ scale: 1.03, background: '#D97706' }} whileTap={{ scale: 0.98 }}
            className="final-cta-btn"
            style={{ display: 'inline-flex', alignItems: 'center', background: '#F59E0B', color: '#080C14', height: 52, padding: '0 36px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
            Analyse my trades &rarr;
          </motion.a>
        </motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 400, color: 'rgba(241,245,249,0.28)', marginTop: 14, marginBottom: 0 }}>
          Free to start &middot; Any broker &middot; 30 seconds
        </motion.p>
      </motion.div>
    </section>
  )
}

// ─── ROOT EXPORT ─────────────────────────────────────────────────────────────
export default function HomeClient() {
  return (
    <div id="page-home">
      <Hero />
      <BrokerStrip />
      <ProductScreenshot />
      <StatsBar />
      <HowItWorks />
      <WhatTradersDiscover />
      <TraderQuotes />
      <Pricing />
      <FinalCTA />
    </div>
  )
}
