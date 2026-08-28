'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

/**
 * Land mask: world coastlines rasterised from Natural Earth 110m, 240x120
 * cells at 1.5deg, packed 1 bit per cell. Copied verbatim from
 * design/hero-reference.html — do not regenerate.
 */
const MASK_B64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//8////44AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPx/n/////AAAA/AAYAAAAfAAAAAAAAAAAAAAAAEO3v4f////+AAAPgAAAAAAAAcAAAAAAAAAAAAAADAAAfgP////+AAAHAAAAAAAAAMAAAAAAAAAAAAAAA9jjCAAP///+AAAAAAAAHgAAP/8AAPAAAAAAAAAAcAAAAAAD///8AAAAAAAAYAAD//gAAAAAAAAAAAAAe6zs/AAB///4AAAAAAABgDA/////wGAAAAwAEAAAI/wM//AAf4AH///////xwHf/////z/+AAAAB//wPI/+sEP4A///wAAAAf8AACHf////////8B8P4AAAAAPPIZ+H/gAD////8AAOcgEQAAAAAAAAAAAE/AAAAAAAAB+AfAAf////4AAHAAAgAAAAAAAAAAA54AAAAAAAALwG/gH/4H//wOB4AAAAAAAAAAAAAAAAAf///////Ng+AP4ADAAA/n////////////////+AD///////8COMAHwAAAAD/P///////////////v8AD/7/////4APwABgAAAAH/P//////////////wfAAA+AH////4APzAAAAAAAD/D/////////////JhgAAAFAAf///8AH/gAAAAAIAOD////////////4AHAAAAQAAP////wH/gAAAAAMBuP////////////wAPgAACAAAH////+f/8AAAAAWAhf////////////AAPAAAAAAAT////+f/+AAAAA3H//////////////+AOAAAAAAAB/////f/8AAAAAHn//////////////+AIAAAAAAAB//////8wAAAAAMf//////////////9AAAAAAAAAA//////2HAAAAAF///////////////4AAAAAAAAAAf/////+AgAAAAD///////////////4AAAAAAAAAAf//////wAAAAAB///yfx/////////wAAAAAAAAAAf/////yAAAAAAB/z/gPj/////////jAAAAAAAAAAf/////gAAAAAA/wY/gDx////////8HAAAAAAAAAAf/////AAAAAAA/gGfnn4////////wAAAAAAAAAAAf////+AAAAAAA/ACY//4///////1gGAAAAAAAAAAP////8AAAAAAA/ACM//4///////hwEAAAAAAAAAAH////4AAAAAAAOLgA//////////4wcAAAAAAAAAAH////4AAAAAAAN/gDC/////////wz8AAAAAAAAAAB////wAAAAAAAf/gAA/////////wDgAAAAAAAAAAA////AAAAAAAA//8YB/////////4EAAAAAAAAAAAAX///AAAAAAAA///f//////////4AAAAAAAAAAAAAX/5BAAAAAAAB//////z///////4AAAAAAAAAAAAAb/gBAAAAAAAH////8/5///////4AAAAAAAAAAAAAF/gBoAAAAAAP////+/4f//////wAAAAAAAAAAAAAE/gAAAAAAAAP////+f8wH/////gAAAAAAAAAAAAAAfgAAAAAAAAf/////P/4D/////IAAAAAAAAAAAAAAPgAQAAAAAAf/////v/8D/+f/4AAAAAAAAAAAAAAAPgwOAAAAAAf/////n/4Af8P+AAAAAAAAAAAAAAAAHxwAwAAAAAf/////n/wAfwH+wAAAAAAAAAAAAAAAB/gAAAAAAAf/////z/gAfgH+AMAAAAAAAAAAAAAAAT8AAAAAAAf/////z+AAfAF/AIAAAAAAAAAAAAAAAB+AAAAAAAf/////94AAOAB/gIAAAAAAAAAAAAAAAAMAAAAAAAf//////AAAOAA/gCAAAAAAAAAAAAAAAAEBQAAAAAP/////+MAAGAAHAFAAAAAAAAAAAAAAAACDfgAAAAH//////8AAGAACAAAAAAAAAAAAAAAAAABP/wAAAAH//////4AABABgADAAAAAAAAAAAAAAAAAP/4AAAAD//////4AABAAQABAAAAAAAAAAAAAAAAAP//gAAAA/H////wAAAACYBgAAAAAAAAAAAAAAAAAH//wAAAAAA////wAAAADYDAAAAAAAAAAAAAAAAAAP//wAAAAAA////gAAAABoPgAAAAAAAAAAAAAAAAAf//4AAAAAA///+AAAAAA4fuQAAAAAAAAAAAAAAAA///+AAAAAA///8AAAAAAYfASAAAAAAAAAAAAAAAA////AAAAAA///4AAAAAAcfYBYAAAAAAAAAAAAAAA////8AAAAAf//4AAAAAAOCEh/AAAAAAAAAAAAAAA/////AAAAAP//wAAAAAAGAAAPgAAAAAAAAAAAAAA/////gAAAAP//wAAAAAADIABPwIAAAAAAAAAAAAAf////gAAAAH//wAAAAAAAOAAPYCAAAAAAAAAAAAAP////AAAAAH//4AAAAAAAACAAMAAAAAAAAAAAAAAP///+AAAAAH//4AAAAAAAAAAAAAAAAAAAAAAAAAAH///+AAAAAH//4AAAAAAAAAHhAAAAAAAAAAAAAAAH///8AAAAAP//4IAAAAAAAAvjAAAAAAAAAAAAAAAD///8AAAAAP//4cAAAAAAAB/jgAAAAAAAAAAAAAAA///8AAAAAP//h4AAAAAAAD/7gAAAAAAAAAAAAAAAf//8AAAAAP//B4AAAAAAAH//wAAAAAAAAAAAAAAAf//4AAAAAH/+AwAAAAAAAf//4AQAAAAAAAAAAAAAf//4AAAAAH//BwAAAAAAB///8AIAAAAAAAAAAAAAf//gAAAAAD//BwAAAAAAD///+AAAAAAAAAAAAAAAf/8AAAAAAD/+BgAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAA//4AAAAAAB/4AAAAAAAAB////AAAAAAAAAAAAAAA//wAAAAAAA/wAAAAAAAAB////AAAAAAAAAAAAAAA//gAAAAAAA/gAAAAAAAAB/h//AAAAAAAAAAAAAAA//AAAAAAAA+AAAAAAAAAB+Av+AAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAP8AAQAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAH8AAIAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAADQAAOAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAIAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAwAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAADwAACAefH/gAAAAAAAAAAAAAAAAEAAAAAAAAAAAB//8B///////4AAAAAAAAAAAAAAA/AAAAAAAAAAH///8P////////8AAAAAAAAAAAAAB3gAAAAATf//////8//////////+AAAAAAAAAAAgAHgAAAAH////////////////////AAAAAAAB4B////gAAAAP///////////////////4AAAAD////////4AAAAD////////////////////gAAALP///////8AAAAD/////////////////////gAABj////////wAAHg//////////////////////4AAAAD///////8AQ/AB////////////////////+AAAAB//////////AGP//////////////////////AAAAA///////////////////////////////////8AAD//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const MW = 240
const MH = 120
const MSTEP = 1.5

interface Exchange {
  code: string
  city: string
  tz: string
  lat: number
  lon: number
  open: number
  close: number
}

const EXCHANGES: readonly Exchange[] = [
  { code: 'NSE',  city: 'Mumbai',    tz: 'Asia/Kolkata',     lat: 19.08,  lon: 72.88,  open: 555, close: 930 },
  { code: 'SGX',  city: 'Singapore', tz: 'Asia/Singapore',   lat: 1.29,   lon: 103.85, open: 540, close: 1020 },
  { code: 'TSE',  city: 'Tokyo',     tz: 'Asia/Tokyo',       lat: 35.68,  lon: 139.69, open: 540, close: 900 },
  { code: 'ASX',  city: 'Sydney',    tz: 'Australia/Sydney', lat: -33.87, lon: 151.21, open: 600, close: 960 },
  { code: 'LSE',  city: 'London',    tz: 'Europe/London',    lat: 51.51,  lon: -0.13,  open: 480, close: 990 },
  { code: 'NYSE', city: 'New York',  tz: 'America/New_York', lat: 40.71,  lon: -74.01, open: 570, close: 960 },
] as const

function localState(tz: string, now: Date): { m: number; w: number } {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(now)
  const g = (t: string): string => p.find((x) => x.type === t)?.value ?? '0'
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  let h = parseInt(g('hour'), 10)
  if (h === 24) h = 0
  return { m: h * 60 + parseInt(g('minute'), 10), w: days[g('weekday')] ?? 0 }
}

// Public holidays are not modelled — an exchange marked "open" here may be
// closed for a local holiday. This is a live-hours indicator only.
function isOpen(e: Exchange, now: Date): boolean {
  const { m, w } = localState(e.tz, now)
  return w !== 0 && w !== 6 && m >= e.open && m < e.close
}

export default function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const marketsRef = useRef<HTMLDivElement | null>(null)
  const clockRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return

    // Decode the packed land mask (1 bit per 1.5deg cell) — client-only,
    // never during SSR.
    const bin = atob(MASK_B64)
    const maskBytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) maskBytes[i] = bin.charCodeAt(i)
    const isLand = (lat: number, lon: number): boolean => {
      const r = Math.floor((90 - lat) / MSTEP)
      const c = Math.floor((lon + 180) / MSTEP)
      if (r < 0 || r >= MH || c < 0 || c >= MW) return false
      const i = r * MW + c
      return ((maskBytes[i >> 3] >> (7 - (i & 7))) & 1) === 1
    }

    const R = 340
    const CX = 500
    const CY = 500
    const TILT = (-20 * Math.PI) / 180

    // Land dots, sampled from the mask.
    const DOTS: Array<[number, number]> = []
    for (let lat = -84; lat <= 84; lat += 2.4) {
      const circ = Math.cos((lat * Math.PI) / 180)
      const steps = Math.max(8, Math.round(150 * circ))
      for (let i = 0; i < steps; i++) {
        const lon = -180 + i * (360 / steps)
        if (isLand(lat, lon)) DOTS.push([lat, lon])
      }
    }

    function project(lat: number, lon: number, spin: number) {
      const la = (lat * Math.PI) / 180
      const lo = ((lon + spin) * Math.PI) / 180
      const x = Math.cos(la) * Math.sin(lo)
      const y = Math.sin(la)
      const z = Math.cos(la) * Math.cos(lo)
      const yy = y * Math.cos(TILT) - z * Math.sin(TILT)
      const zz = y * Math.sin(TILT) + z * Math.cos(TILT)
      return { x: CX + R * x, y: CY - R * yy, z: zz }
    }

    // Crypto orbit: a ring inclined to the globe's axis — 24/7, tied to no city.
    const ORBIT_R = 1.24
    const INC = (62 * Math.PI) / 180
    function orbitPoint(theta: number, spin: number) {
      const bx = Math.cos(theta)
      const by = 0
      const bz = Math.sin(theta)
      const y1 = by * Math.cos(INC) - bz * Math.sin(INC)
      const z1 = by * Math.sin(INC) + bz * Math.cos(INC)
      const s = (spin * Math.PI) / 180
      const x2 = bx * Math.cos(s) + z1 * Math.sin(s)
      const z2 = -bx * Math.sin(s) + z1 * Math.cos(s)
      const y3 = y1 * Math.cos(TILT) - z2 * Math.sin(TILT)
      const z3 = y1 * Math.sin(TILT) + z2 * Math.cos(TILT)
      return { x: CX + R * ORBIT_R * x2, y: CY - R * ORBIT_R * y3, z: z3 }
    }
    const occluded = (p: { x: number; y: number; z: number }): boolean =>
      p.z < 0 && Math.hypot(p.x - CX, p.y - CY) < R

    let spin = 0
    let openSet = new Set<string>()
    let last = performance.now()
    let rafId = 0

    function draw(t: number): void {
      const dt = Math.min(64, t - last)
      last = t
      spin = (spin + dt * 0.004) % 360
      ctx!.clearRect(0, 0, cv!.width, cv!.height)

      ctx!.beginPath()
      ctx!.arc(CX, CY, R, 0, Math.PI * 2)
      ctx!.fillStyle = '#FBFBF9'
      ctx!.fill()
      ctx!.strokeStyle = '#E0E1DC'
      ctx!.lineWidth = 1.2
      ctx!.stroke()

      // Crypto orbit behind the globe.
      for (let pass = 0; pass < 2; pass++) {
        ctx!.beginPath()
        let started = false
        for (let a = 0; a <= 360; a += 2) {
          const p = orbitPoint((a * Math.PI) / 180, spin * 0.55)
          const behind = occluded(p)
          if ((pass === 0) !== behind) {
            started = false
            continue
          }
          if (!started) {
            ctx!.moveTo(p.x, p.y)
            started = true
          } else ctx!.lineTo(p.x, p.y)
        }
        ctx!.strokeStyle = pass === 0 ? 'rgba(23,122,68,.15)' : 'rgba(23,122,68,.62)'
        ctx!.lineWidth = pass === 0 ? 1.4 : 2
        ctx!.stroke()
        if (pass === 0) {
          // Land dots drawn between the two orbit passes so the ring wraps the globe.
          for (const [lat, lon] of DOTS) {
            const p = project(lat, lon, spin)
            if (p.z <= 0.02) continue
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, 1.9, 0, Math.PI * 2)
            ctx!.fillStyle = 'rgba(10,15,28,' + (0.16 + p.z * 0.46) + ')'
            ctx!.fill()
          }
          for (const e of EXCHANGES) {
            const p = project(e.lat, e.lon, spin)
            if (p.z <= 0.04) continue
            const live = openSet.has(e.code)
            const fade = Math.min(1, p.z * 1.7)
            if (live) {
              const pulse = 0.5 + 0.5 * Math.sin(t / 560)
              ctx!.beginPath()
              ctx!.arc(p.x, p.y, 9 + pulse * 17, 0, Math.PI * 2)
              ctx!.strokeStyle = 'rgba(232,121,43,' + (1 - pulse) * 0.5 * fade + ')'
              ctx!.lineWidth = 2
              ctx!.stroke()
            }
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, live ? 7 : 4.5, 0, Math.PI * 2)
            ctx!.fillStyle = live ? 'rgba(232,121,43,' + fade + ')' : 'rgba(120,127,145,' + fade * 0.7 + ')'
            ctx!.fill()
            if (p.z > 0.42) {
              ctx!.font = '500 21px "IBM Plex Mono", monospace'
              ctx!.fillStyle = live ? 'rgba(10,15,28,' + fade + ')' : 'rgba(112,119,137,' + fade * 0.85 + ')'
              ctx!.fillText(e.code, p.x + 14, p.y + 7)
            }
          }
        }
      }
      // The crypto marker itself, always live.
      const cp = orbitPoint((t / 2600) % (Math.PI * 2), spin * 0.55)
      if (!occluded(cp)) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 500)
        ctx!.beginPath()
        ctx!.arc(cp.x, cp.y, 7 + pulse * 13, 0, Math.PI * 2)
        ctx!.strokeStyle = 'rgba(23,122,68,' + (1 - pulse) * 0.42 + ')'
        ctx!.lineWidth = 2
        ctx!.stroke()
        ctx!.beginPath()
        ctx!.arc(cp.x, cp.y, 6.5, 0, Math.PI * 2)
        ctx!.fillStyle = '#177A44'
        ctx!.fill()
        ctx!.font = '500 20px "IBM Plex Mono", monospace'
        ctx!.fillStyle = 'rgba(23,122,68,.95)'
        ctx!.fillText('CRYPTO 24/7', cp.x + 15, cp.y + 6)
      }
      rafId = requestAnimationFrame(draw)
    }

    function refresh(): void {
      const now = new Date()
      openSet = new Set(EXCHANGES.filter((e) => isOpen(e, now)).map((e) => e.code))
      if (marketsRef.current) {
        marketsRef.current.innerHTML =
          EXCHANGES.map((e) => {
            const live = openSet.has(e.code)
            const { m } = localState(e.tz, now)
            const hh = String(Math.floor(m / 60)).padStart(2, '0')
            const mm = String(m % 60).padStart(2, '0')
            return (
              '<div class="gm-row' + (live ? ' open' : '') + '"><span class="code">' + e.code +
              '</span><span class="city">' + e.city + '</span><span class="st">' +
              (live ? 'open' : hh + ':' + mm) + '</span></div>'
            )
          }).join('') +
          '<div class="gm-row crypto"><span class="code">CRYPTO</span><span class="city">global</span><span class="st">24/7</span></div>'
      }
      if (clockRef.current) {
        clockRef.current.textContent =
          (openSet.size ? openSet.size + ' OPEN' : 'EQUITIES CLOSED') + ' · CRYPTO LIVE'
      }
    }

    refresh()
    const intervalId = window.setInterval(refresh, 30_000)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <section className="ts-hero">
      <div className="ts-container">
        <div className="hero">
          <div>
            <span className="label">Behavioural analysis · every market</span>
            <h1>
              Your strategy was fine.
              <br />
              Your <em>behaviour</em> wasn&apos;t.
            </h1>
            <p className="lede">
              TradeSaath reads your tradebook from any broker — equities, F&amp;O, forex or crypto — finds the
              decisions that cost you money, and prices each one.
            </p>
            <div className="does">
              <div className="do">
                <span className="i">01</span>
                <span className="t">Reads your file</span>
                <span className="d">Any broker, any market. Columns, currency and instrument type detected automatically.</span>
              </div>
              <div className="do">
                <span className="i">02</span>
                <span className="t">Names the pattern</span>
                <span className="d">Revenge entries, oversizing after a loss, cutting winners early — found in your own timestamps.</span>
              </div>
              <div className="do">
                <span className="i">03</span>
                <span className="t">Prices the damage</span>
                <span className="d">What each behaviour cost, and what the same trades would have returned without it.</span>
              </div>
            </div>
            <div className="cta">
              <Link href="/upload" className="hero-btn hero-btn-primary">Analyse my trades</Link>
              <Link href="/results" className="hero-quiet">See a real report</Link>
            </div>
          </div>

          <div className="globe-wrap" id="markets">
            <canvas
              ref={canvasRef}
              id="globe"
              width={1000}
              height={1000}
              role="img"
              aria-label="Rotating world map globe showing exchanges and which markets are open"
            />
            <div className="globe-meta">
              <div className="gm-head">
                <span className="label">World markets</span>
                <span className="label" ref={clockRef}>—</span>
              </div>
              <div className="gm-grid" ref={marketsRef} />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ts-hero {
          background: var(--void);
        }
        .ts-container {
          max-width: 1220px;
          margin: 0 auto;
        }
        .label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--mute);
        }
        .hero {
          padding: calc(var(--nav-h) + var(--inst-h) + 16px) 28px 80px;
          display: grid;
          grid-template-columns: 1fr 500px;
          gap: 52px;
          align-items: center;
        }
        h1 {
          font-family: var(--font-display);
          font-weight: 300;
          color: var(--ink);
          font-size: clamp(35px, 4.4vw, 53px);
          line-height: 1.08;
          letter-spacing: -0.018em;
          margin: 17px 0 0;
        }
        h1 em {
          font-style: normal;
          color: var(--ts-signal-dk);
        }
        .lede {
          margin-top: 20px;
          color: var(--mute);
          font-size: 16.5px;
          line-height: 1.62;
          max-width: 470px;
        }
        .does {
          margin-top: 30px;
          border-top: 1px solid var(--line);
        }
        .do {
          display: flex;
          gap: 16px;
          padding: 13px 0;
          border-bottom: 1px solid var(--line-soft);
          align-items: baseline;
        }
        .do .i {
          font-family: var(--font-mono);
          font-size: 9.5px;
          color: var(--dim);
          width: 20px;
          flex-shrink: 0;
        }
        .do .t {
          font-size: 14.5px;
          color: var(--ink);
          width: 148px;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }
        .do .d {
          font-size: 13.5px;
          color: #4a5060;
          line-height: 1.55;
        }
        .cta {
          margin-top: 28px;
          display: flex;
          gap: 22px;
          align-items: center;
          flex-wrap: wrap;
        }
        :global(.hero-btn) {
          display: inline-block;
          padding: 10px 19px;
          border-radius: 5px;
          font-size: 13.5px;
          font-weight: 450;
          letter-spacing: -0.005em;
          border: 1px solid transparent;
        }
        :global(.hero-btn-primary) {
          background: var(--signal);
          color: #16202e;
        }
        :global(.hero-btn-primary:hover) {
          background: #f08839;
        }
        :global(.hero-quiet) {
          font-size: 13.5px;
          color: var(--mute);
          border-bottom: 1px solid var(--line);
          padding-bottom: 2px;
        }
        :global(.hero-quiet:hover) {
          color: var(--ink);
          border-color: var(--mute);
        }
        :global(.hero-btn:focus-visible),
        :global(.hero-quiet:focus-visible) {
          outline: 2px solid var(--ts-signal-dk);
          outline-offset: 3px;
          border-radius: 4px;
        }
        .globe-wrap {
          position: relative;
        }
        #globe {
          width: 100%;
          height: auto;
          display: block;
        }
        .globe-meta {
          margin-top: 14px;
          border-top: 1px solid var(--line);
          padding-top: 13px;
        }
        .gm-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 7px;
        }
        .gm-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 22px;
        }
        .gm-grid :global(.gm-row) {
          display: flex;
          align-items: baseline;
          gap: 9px;
          padding: 4px 0;
          font-family: var(--font-mono);
          font-size: 11px;
        }
        .gm-grid :global(.code) {
          color: var(--mute);
          width: 50px;
        }
        .gm-grid :global(.city) {
          color: var(--dim);
          flex: 1;
        }
        .gm-grid :global(.st) {
          color: var(--dim);
        }
        .gm-grid :global(.gm-row.open .code),
        .gm-grid :global(.gm-row.open .st) {
          color: var(--signal);
        }
        .gm-grid :global(.gm-row.crypto .code),
        .gm-grid :global(.gm-row.crypto .st) {
          color: var(--profit);
        }
        @media (max-width: 960px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 40px;
            padding-top: calc(var(--nav-h) + var(--inst-h) + 12px);
          }
          .globe-wrap {
            max-width: 420px;
            margin: 0 auto;
            width: 100%;
          }
          .do {
            flex-wrap: wrap;
            gap: 6px;
          }
          .do .t {
            width: auto;
          }
        }
      `}</style>
    </section>
  )
}
