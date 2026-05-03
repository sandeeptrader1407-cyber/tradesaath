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
function Section({ children, bg, style, id }: { children: React.ReactNode; bg?: string; style?: React.CSSProperties; id?: string }) {
  return (
    <section id={id} style={{ background: bg ?? '#F8FAFC', ...style }}>
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
    'Mistake costs uncovered in every session',
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
                F&amp;O &middot; Equity &middot; Crypto &middot; NSE &middot; BSE &middot; SPX &middot; FTSE &middot; Any broker
              </span>
            </motion.div>

            <motion.h1 variants={item} className="hero-h1" style={{ fontFamily: 'var(--font-display)', fontSize: 68, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.0, letterSpacing: '-0.025em', marginTop: 24, marginBottom: 0 }}>
              Every options trader
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
    { end: 30,   prefix: '',   suffix: '+',   label: 'Markets Covered',         color: '#F43F5E' },
    { end: 30,   prefix: '',   suffix: '+',   label: 'Brokers Supported',       color: '#10B981' },
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

// ─── Interactive product demo ─────────────────────────────────────────────────
function ProductDemo() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'journey' | 'saathi'>('dashboard')
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'journal',   label: 'Journal'   },
    { id: 'journey',   label: 'Journey'   },
    { id: 'saathi',    label: 'Saathi'    },
  ] as const

  const EQUITY = [-4200, 2100, -1800, 6400, -800, 3200, 8100, -2400, 1600, 9200, -600, 4800, 11200, -1200, 7600]
  const maxVal = Math.max(...EQUITY.map(Math.abs))

  const SESSIONS = [
    { date: '2 Apr',  trades: 14, wr: 57, pnl:  3240, dqs: 72 },
    { date: '28 Mar', trades:  9, wr: 44, pnl: -1820, dqs: 41 },
    { date: '25 Mar', trades: 18, wr: 61, pnl:  5180, dqs: 68 },
    { date: '21 Mar', trades: 11, wr: 36, pnl: -4210, dqs: 29 },
    { date: '18 Mar', trades:  7, wr: 71, pnl:  2640, dqs: 81 },
  ]

  const PATTERNS = [
    { name: 'Revenge trading', count: 666, cost: 36214, pct: 78, color: '#F43F5E' },
    { name: 'Averaging down',  count: 178, cost: 12800, pct: 55, color: '#F59E0B' },
    { name: 'Oversized lots',  count: 111, cost: 9400,  pct: 44, color: '#F59E0B' },
    { name: 'Late exit',       count: 84,  cost: 6200,  pct: 33, color: '#94A3B8' },
  ]

  const JOURNEY_CHAPTERS = [
    { week: 'Week 1', score: 41, color: '#F43F5E', text: 'The data did not lie. Revenge trading was costing more each week than the profitable trades were making. The pattern had a name now.' },
    { week: 'Week 4', score: 54, color: '#F59E0B', text: 'The pre-session checklist changed something. Knowing that every entry would be tagged made the bad trades feel different before they happened.' },
    { week: 'Week 8', score: 68, color: '#10B981', text: 'Still not perfect. But the discipline score does not lie either. 68 is not a number you can fake — it comes from 140 sessions of actual data.' },
  ]

  const dqsCircle = (score: number, size: number, strokeW: number) => {
    const r = (size - strokeW) / 2
    const circ = 2 * Math.PI * r
    const fill = (score / 100) * circ
    const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F43F5E'
    return { r, circ, fill, color }
  }

  const TAB_HINTS: Record<typeof activeTab, string> = {
    dashboard: 'Now exploring · Dashboard',
    journal:   'Now exploring · Journal',
    journey:   'Now exploring · Journey',
    saathi:    'Now exploring · Saathi',
  }

  const TAB_CAPTIONS: Record<typeof activeTab, { title: string; sub: string }> = {
    dashboard: { title: 'Your dashboard', sub: 'Score, top issue, and pre-session focus — at a glance.' },
    journal:   { title: 'Your journal',   sub: 'Every session captured. Patterns, costs, and DQS, written from your data.' },
    journey:   { title: 'Your journey',   sub: 'Watch discipline build week over week. Eight weeks shown here.' },
    saathi:    { title: 'Your Saathi',    sub: 'AI coaching that knows your patterns by their rupee cost.' },
  }

  return (
    <section id="features" style={{ background: '#080C14', padding: '96px 24px', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)', marginBottom: 12 }}>
            The product
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 14 }}>
            Everything you get after<br />your first upload.
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'rgba(241,245,249,0.5)', maxWidth: 460, margin: '0 auto', lineHeight: 1.75 }}>
            Click each tab to explore the four tools that come with every TradeSaath account.
          </p>
        </div>

        {/* Interactive badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(245,158,11,0.10)',
            border: '0.5px solid rgba(245,158,11,0.35)',
            borderRadius: 20,
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 500,
            color: '#FCD34D',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#F59E0B',
              boxShadow: '0 0 0 0 rgba(245,158,11,0.7)',
              animation: 'demo-pulse 1.8s cubic-bezier(0.4,0,0.6,1) infinite',
            }} />
            Interactive — click to explore
          </div>
        </div>

        {/* Browser frame */}
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 120px rgba(0,0,0,0.5)' }}>

          {/* Browser chrome */}
          <div style={{ background: '#111827', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {(['#F43F5E', '#F59E0B', '#10B981'] as const).map((c, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{ flex: 1, maxWidth: 360, margin: '0 auto', background: '#1E2936', borderRadius: 5, padding: '4px 14px', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'rgba(245,158,11,0.7)', textAlign: 'center', letterSpacing: '0.04em' }}>
              {TAB_HINTS[activeTab]}
            </div>
          </div>

          {/* App navbar inside frame */}
          <div style={{ background: '#FAFAFA', borderBottom: '0.5px solid #E2E8F0', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: '#0F172A', padding: '12px 0' }}>TradeSaath</span>
            <div style={{ display: 'flex', gap: 0 }}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '14px 16px', fontFamily: 'var(--font-sans)', fontSize: 13,
                    fontWeight: activeTab === tab.id ? 500 : 400,
                    color: activeTab === tab.id ? '#0F172A' : '#94A3B8',
                    borderBottom: activeTab === tab.id ? '3px solid #F59E0B' : '2px solid transparent',
                    boxShadow: activeTab === tab.id ? '0 4px 12px -6px rgba(245,158,11,0.6)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A1F2E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F8F6F1', flexShrink: 0 }}>SA</div>
          </div>

          {/* Tab content */}
          <div style={{ background: '#F5F3EE', minHeight: 520 }}>

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#0F172A', marginBottom: 4 }}>Your Dashboard</h1>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94A3B8' }}>76 sessions · 5,616 trades · Last session: 2 Apr</p>
                  </div>
                  <div style={{ background: '#1A1F2E', color: '#F8F6F1', padding: '8px 16px', borderRadius: 7, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500 }}>New Analysis</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                  {/* Score card */}
                  <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '18px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 14 }}>YOUR SCORE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {(() => {
                        const { r, circ, fill, color } = dqsCircle(67, 72, 5)
                        return (
                          <svg width="72" height="72" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
                            <circle cx="36" cy="36" r={r} fill="none" stroke="#F1EFE8" strokeWidth="5" />
                            <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
                              strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
                            <text x="36" y="40" textAnchor="middle" style={{ transform: 'rotate(90deg) translate(0,-72px)', fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 500, fill: color }}>67</text>
                          </svg>
                        )
                      })()}
                      <div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#10B981', marginBottom: 4 }}>Above profitable avg</div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#94A3B8' }}>Weakest: <span style={{ color: '#DC2626' }}>Entry Quality 18%</span></div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: '#F59E0B', marginTop: 4 }}>Fix in Saathi →</div>
                      </div>
                    </div>
                  </div>
                  {/* Top Issue card */}
                  <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8' }}>TOP ISSUE</div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, padding: '2px 7px', background: 'rgba(244,63,94,0.08)', color: '#DC2626', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 20 }}>Worsening</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#DC2626', marginBottom: 6 }}>Revenge Trading</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#64748B', marginBottom: 8 }}>Cost you −₹36,214 this month (106 trades)</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 3 }}>YOUR TRIGGER</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#374151' }}>After losses — within 1-3 trades</div>
                  </div>
                  {/* Pre-session card */}
                  <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '18px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 10 }}>PRE-SESSION</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#64748B', marginBottom: 10 }}>Set your focus for today:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {['No revenge entries', 'Stop at 10:30 AM', 'Max 8 trades', 'Fixed 20 lots'].map((chip, i) => (
                        <span key={chip} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, padding: '4px 10px', border: `1px solid ${i === 0 ? '#F59E0B' : '#E2E8F0'}`, background: i === 0 ? '#FFFBEB' : '#FFFFFF', color: i === 0 ? '#B45309' : '#64748B', borderRadius: 20 }}>{chip}</span>
                      ))}
                    </div>
                    <div style={{ width: '100%', padding: '8px 12px', background: '#1A1F2E', color: '#F8F6F1', borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, textAlign: 'center' }}>Begin session →</div>
                  </div>
                </div>
                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {[
                    { label: 'THIS MONTH P&L', val: '+₹1,236',  sub: 'Improving vs last month', c: '#10B981' },
                    { label: 'WIN RATE',        val: '52.8%',    sub: '+2.6% vs last month',   c: '#10B981' },
                    { label: 'BEST DAY P&L',   val: '+₹14,229', sub: 'on 21 Feb · 7 trades',  c: '#94A3B8' },
                    { label: 'DISCIPLINE',     val: '67',        sub: 'Above avg profitable',  c: '#10B981' },
                  ].map(({ label, val, sub, c }) => (
                    <div key={label} style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: '#0F172A', marginBottom: 4 }}>{val}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: c }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* JOURNAL */}
            {activeTab === 'journal' && (
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 24 }}>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#0F172A', marginBottom: 4 }}>Journal</h1>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94A3B8' }}>Every session, reviewed. Every pattern, logged.</p>
                </div>
                {/* Equity bars */}
                <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '18px 20px', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 14 }}>SESSION PERFORMANCE</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                    {EQUITY.map((v, i) => {
                      const h = Math.max(4, (Math.abs(v) / maxVal) * 72)
                      const isPos = v >= 0
                      return (
                        <div key={i}
                          onMouseEnter={() => setHoveredBar(i)}
                          onMouseLeave={() => setHoveredBar(null)}
                          style={{
                            flex: 1, height: h, borderRadius: '3px 3px 0 0',
                            background: hoveredBar === i ? (isPos ? '#16A34A' : '#DC2626') : (isPos ? '#10B981' : '#F43F5E'),
                            opacity: hoveredBar !== null && hoveredBar !== i ? 0.5 : 1,
                            cursor: 'pointer', transition: 'all 0.12s',
                            alignSelf: isPos ? 'flex-end' : 'flex-start',
                          }}
                          title={`Session ${i + 1}: ${v >= 0 ? '+' : ''}₹${v.toLocaleString('en-IN')}`}
                        />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94A3B8' }}>
                    <span>Feb</span><span>Mar</span><span>Apr</span>
                  </div>
                </div>
                {/* Session list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SESSIONS.map((s, i) => {
                    const { color } = dqsCircle(s.dqs, 32, 3)
                    const isLucky = s.pnl > 0 && s.dqs < 50
                    const isBest = i === 0
                    return (
                      <div key={i} style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94A3B8', minWidth: 40 }}>{s.date}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#374151' }}>{s.trades} trades</span>
                          <span style={{ color: '#D3D1C7', margin: '0 6px' }}>·</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94A3B8' }}>{s.wr}% WR</span>
                          <span style={{ color: '#D3D1C7', margin: '0 6px' }}>·</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94A3B8' }}>DQS <span style={{ color }}>{s.dqs}</span></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isBest && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, padding: '2px 7px', background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20 }}>Best</span>}
                          {isLucky && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, padding: '2px 7px', background: 'rgba(192,123,42,0.1)', color: '#C07B2A', border: '1px solid rgba(192,123,42,0.3)', borderRadius: 20 }}>Review</span>}
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: s.pnl >= 0 ? '#10B981' : '#DC2626' }}>
                            {s.pnl >= 0 ? '+' : ''}₹{Math.abs(s.pnl).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* JOURNEY */}
            {activeTab === 'journey' && (
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 28 }}>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#0F172A', marginBottom: 4 }}>Journey</h1>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94A3B8' }}>The story only your trades can tell.</p>
                </div>
                {/* Score timeline bars */}
                <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 16 }}>DISCIPLINE SCORE OVER TIME</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 8 }}>
                    {[41, 44, 47, 54, 51, 58, 61, 68].map((score, i) => {
                      const { color } = dqsCircle(score, 32, 3)
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color }}>{score}</div>
                          <div style={{ width: '100%', height: (score / 100) * 60, background: color, borderRadius: '3px 3px 0 0', opacity: 0.85 }} />
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94A3B8' }}>
                    <span>Week 1</span><span>Week 8</span>
                  </div>
                </div>
                {/* Story chapters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {JOURNEY_CHAPTERS.map(({ week, score, color, text }) => (
                    <div key={week} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color, lineHeight: 1 }}>{score}</div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{week}</div>
                      </div>
                      <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', flex: 1 }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SAATHI */}
            {activeTab === 'saathi' && (
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 24 }}>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#0F172A', marginBottom: 4 }}>Saathi</h1>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94A3B8' }}>Your trading companion. Always on. Always learning.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* Chat */}
                  <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 340 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 4 }}>COACHING CHAT</div>
                    {[
                      { role: 'saathi', text: 'Reviewed 76 sessions and 5,616 trades. Your revenge trading cost ₹36,214 last month. Want to work on a plan to reduce it?' },
                      { role: 'user',   text: 'Yes — what should I actually do differently?' },
                      { role: 'saathi', text: 'Your data shows 78% of revenge trades happen within 3 entries of a loss. Try this: after any losing trade, write down one reason before your next entry. That 30-second pause breaks the emotional loop.' },
                    ].map((msg, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, maxWidth: '88%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? '#1A1F2E' : '#F8FAFC', border: msg.role === 'user' ? 'none' : '0.5px solid #E2E8F0' }}>
                        {msg.role === 'saathi' && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: '#F59E0B', marginBottom: 4 }}>Saathi</div>}
                        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: msg.role === 'user' ? '#F8F6F1' : '#374151', lineHeight: 1.6, margin: 0 }}>{msg.text}</p>
                      </div>
                    ))}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, background: '#F8FAFC', border: '0.5px solid #E2E8F0', borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94A3B8' }}>Ask Saathi anything...</div>
                      <div style={{ background: '#F59E0B', color: '#080C14', padding: '8px 14px', borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500 }}>Send</div>
                    </div>
                  </div>
                  {/* Patterns + plan */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '16px' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 12 }}>YOUR PATTERNS (COST RANK)</div>
                      {PATTERNS.map(p => (
                        <div key={p.name} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#374151' }}>{p.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: p.color }}>−₹{p.cost.toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ height: 3, background: '#F1EFE8', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: 2 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B45309', marginBottom: 8 }}>THIS WEEK&apos;S PLAN</div>
                      {['No entries within 3 trades of a stop-out', 'Write one sentence before each entry', 'Max 8 trades per session'].map((rule, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: '#F59E0B', flexShrink: 0, fontSize: 12, marginTop: 1 }}>&#10003;</span>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{rule}</span>
                        </div>
              ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Dynamic caption */}
        <div style={{ textAlign: 'center', marginTop: 32, minHeight: 56 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 400,
            color: '#F1F5F9',
            marginBottom: 6,
            letterSpacing: '-0.01em',
            transition: 'opacity 0.25s',
          }}>
            {TAB_CAPTIONS[activeTab].title}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            color: 'rgba(241,245,249,0.5)',
            maxWidth: 480,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            {TAB_CAPTIONS[activeTab].sub}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes demo-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
      `}</style>
    </section>
  )
}

// ─── HOW IT WORKS ────────────────────────────────────────────────────────────
function HowItWorks() {
  const STEPS = [
    {
      n: '01',
      title: 'Drop your statement',
      body: 'PDF, CSV, or Excel from any broker — Zerodha, Interactive Brokers, TD Ameritrade, Upstox, Robinhood, and 25 others. Detected automatically. Takes under 10 seconds.',
    },
    {
      n: '02',
      title: 'We find the psychology',
      body: 'Revenge trading after stop-outs. Averaging down on losing positions. Oversized contracts on expiry day. Every pattern tagged, counted, and costed.',
    },
    {
      n: '03',
      title: 'You get the plan',
      body: 'Your Discipline Score out of 100. Your top 3 patterns by cost. A specific fix for each one. Not generic advice. Based on your actual trades.',
    },
  ]
  return (
    <Section bg="#F8FAFC" id="how">
      <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div variants={item}><SectionLabel>How it works</SectionLabel></motion.div>
        <motion.div variants={item}><SectionTitle>Upload once. Know everything.</SectionTitle></motion.div>
        <motion.p variants={item} style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: '#64748B', marginTop: 8, marginBottom: 0 }}>
          Supports 30+ brokers across India, US, UK, Singapore, and the EU.
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

// ─── TRADERS JOURNEY ─────────────────────────────────────────────
function TradersJourney() {
  const STORIES = [
    {
      flag: '🇮🇳',
      market: 'Nifty Options · Mumbai',
      moment: 'The number nobody wants to see.',
      quote: 'I thought I was revenge trading once in a while. The data said 106 times — in a single month. That number changed everything.',
      finding: '₹36,214',
      findingLabel: 'lost to revenge trades in one month',
      findingColor: '#F43F5E',
      week: 'Week 1',
      dqs: 41,
      dqsColor: '#F43F5E',
    },
    {
      flag: '🇸🇬',
      market: 'SGX Nifty · Singapore',
      moment: 'Profitable, but not for the right reasons.',
      quote: 'My win rate looked fine. Then I saw that 31% of my profitable trades were lucky exits — I had held past my target by accident.',
      finding: '31%',
      findingLabel: 'of wins were undisciplined holds',
      findingColor: '#F59E0B',
      week: 'Week 3',
      dqs: 54,
      dqsColor: '#F59E0B',
    },
    {
      flag: '🇬🇧',
      market: 'FTSE Options · London',
      moment: 'The pattern had a name. And a price tag.',
      quote: 'Averaging down. I knew I did it. I did not know it was responsible for 68% of my total losses. Seeing the cost per pattern was the clearest thing I had ever read about my trading.',
      finding: '68%',
      findingLabel: 'of total losses from one pattern',
      findingColor: '#F59E0B',
      week: 'Week 5',
      dqs: 58,
      dqsColor: '#F59E0B',
    },
    {
      flag: '🇺🇸',
      market: 'SPX Options · New York',
      moment: 'The pre-session plan actually worked.',
      quote: 'Three rules. Write them before open. Follow them. My discipline score went from 44 to 71 in six weeks. Not because I became a better analyst — because I stopped making the same mistakes.',
      finding: '44 → 71',
      findingLabel: 'discipline score in 6 weeks',
      findingColor: '#10B981',
      week: 'Week 6',
      dqs: 71,
      dqsColor: '#10B981',
    },
    {
      flag: '🇦🇪',
      market: 'Crypto + Equity · Dubai',
      moment: 'The moment the journal started writing itself.',
      quote: 'Every session has a story now. Not just P&L — the trigger, the pattern, the cost, the lesson. I used to journal manually and give up after a week. This does it automatically from the file.',
      finding: '140',
      findingLabel: 'sessions with automated coaching notes',
      findingColor: '#818CF8',
      week: 'Week 8',
      dqs: 79,
      dqsColor: '#10B981',
    },
  ]

  return (
    <section style={{ background: '#080C14', padding: '96px 0 112px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <motion.div variants={container} initial="hidden" whileInView="visible" viewport={VP} style={{ marginBottom: 80 }}>
          <motion.div variants={item}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(241,245,249,0.35)', marginBottom: 16 }}>
              Traders worldwide
            </div>
          </motion.div>
          <motion.div variants={item}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.1, letterSpacing: '-0.025em', maxWidth: 640, margin: 0 }}>
              Five traders.<br />Five countries.<br />One pattern.
            </h2>
          </motion.div>
          <motion.div variants={item}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'rgba(241,245,249,0.45)', marginTop: 20, lineHeight: 1.75, maxWidth: 520 }}>
              The market is different. The currency is different. The psychology is identical.
            </p>
          </motion.div>
        </motion.div>

        {/* Journey timeline */}
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: '0.5px', background: 'linear-gradient(to bottom, rgba(245,158,11,0.6), rgba(245,158,11,0.1))' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STORIES.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                style={{ display: 'flex', gap: 40, alignItems: 'flex-start', paddingBottom: i < STORIES.length - 1 ? 64 : 0 }}
              >
                {/* Timeline dot */}
                <div style={{ flexShrink: 0, position: 'relative', zIndex: 1, marginTop: 6 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0D1421', border: `1.5px solid ${s.dqsColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {s.flag}
                  </div>
                </div>

                {/* Content card */}
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
                  {/* Accent line */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: s.dqsColor, opacity: 0.5, borderRadius: '3px 0 0 3px' }} />

                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'rgba(241,245,249,0.4)', letterSpacing: '0.06em' }}>{s.market}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(241,245,249,0.2)', padding: '2px 8px', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 20 }}>{s.week}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 10px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dqsColor }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.dqsColor }}>DQS {s.dqs}</span>
                    </div>
                  </div>

                  {/* Moment title */}
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#F1F5F9', lineHeight: 1.3, marginBottom: 16, letterSpacing: '-0.01em' }}>
                    {s.moment}
                  </h3>

                  {/* Quote */}
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'rgba(241,245,249,0.6)', lineHeight: 1.75, margin: '0 0 24px' }}>
                    &ldquo;{s.quote}&rdquo;
                  </p>

                  {/* Finding */}
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: s.findingColor, lineHeight: 1 }}>{s.finding}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(241,245,249,0.35)' }}>{s.findingLabel}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ marginTop: 80, textAlign: 'center', borderTop: '0.5px solid rgba(255,255,255,0.07)', paddingTop: 56 }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, color: 'rgba(241,245,249,0.7)', marginBottom: 8, fontStyle: 'italic' }}>
            Your number is waiting in your trade file.
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.35)', marginBottom: 32 }}>
            Upload once. See everything.
          </p>
          <a href="/upload" style={{ display: 'inline-block', background: '#F59E0B', color: '#080C14', padding: '12px 32px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none', letterSpacing: '0.01em' }}>
            Start free — upload your trades
          </a>
        </motion.div>

      </div>

      <style>{`
        @media(max-width:768px){
          .journey-card-inner{padding:20px 18px!important}
        }
      `}</style>
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
      <ProductDemo />
      <StatsBar />
      <HowItWorks />
      <TradersJourney />
      <Pricing />
      <FinalCTA />
    </div>
  )
}
