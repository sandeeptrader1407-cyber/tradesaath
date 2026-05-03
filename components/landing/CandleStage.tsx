'use client'

import { useEffect, useMemo, useRef } from 'react'
import PatternsTicker from './PatternsTicker'

const W = 600
const H = 360
const N = 22
const GAP = 4
const CANDLE_WIDTH = (W - GAP * (N + 1)) / N

// Story-driven price moves: a quiet build, a panic, a long drawdown, a tepid recovery.
const STORY: readonly number[] = [
  +12, +8, +14, -4, +10, +18, -22, -28, -34, -40, -28, -18, -24, -30, -22, -10, -14, -8, -12, -6, -4, -2,
] as const

const MISTAKE_INDICES = new Set<number>([8, 9, 10])

interface CandlePoint {
  x: number
  y: number
}

/**
 * Builds the SVG fragment string deterministically (no per-mount randomness for layout) but
 * applies a small randomized wick noise for organic feel. Computed once per mount.
 */
function buildCandlesSVG(): { svg: string; closes: CandlePoint[] } {
  let frag = ''
  // Faint baseline grid line
  frag += `<line x1="0" y1="${H / 2 - 30}" x2="${W}" y2="${H / 2 - 30}" stroke="rgba(255,255,255,0.04)" stroke-width="1" stroke-dasharray="3 4" />`

  let price = H / 2 - 60
  const closes: CandlePoint[] = []

  for (let i = 0; i < N; i++) {
    const open = price
    const change = STORY[i] ?? (Math.random() - 0.5) * 10
    const close = Math.max(40, Math.min(H - 40, open - change))
    const hi = Math.min(open, close) - Math.random() * 8 - 3
    const lo = Math.max(open, close) + Math.random() * 8 + 3
    const x = GAP + i * (CANDLE_WIDTH + GAP)
    const cx = x + CANDLE_WIDTH / 2
    const up = close < open
    const isMistake = MISTAKE_INDICES.has(i)
    const color = up ? '#36d399' : '#f05d6c'
    const wickColor = isMistake ? '#ff3344' : color
    const wickOpacity = isMistake ? 0.9 : 0.55
    const bodyOpacity = up ? 0.85 : 0.78

    frag += `<line x1="${cx}" y1="${hi}" x2="${cx}" y2="${lo}" stroke="${wickColor}" stroke-opacity="${wickOpacity}" stroke-width="1.2" />`

    const top = Math.min(open, close)
    const bot = Math.max(open, close)
    frag += `<rect x="${x}" y="${top}" width="${CANDLE_WIDTH}" height="${Math.max(2, bot - top)}" fill="${color}" fill-opacity="${bodyOpacity}" rx="1.5">`
    frag += `<animate attributeName="opacity" values="0;1" dur="0.4s" begin="${i * 0.07}s" fill="freeze" />`
    frag += `</rect>`

    closes.push({ x: cx, y: close })
    price = close
  }

  // Drawdown trace line
  const linePath = closes.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ')
  frag += `<path d="${linePath}" fill="none" stroke="#f05d6c" stroke-width="1.6" stroke-opacity="0.85" stroke-dasharray="800" stroke-dashoffset="800">`
  frag += `<animate attributeName="stroke-dashoffset" from="800" to="0" dur="2.4s" begin="1.4s" fill="freeze" />`
  frag += `</path>`

  // Drawdown shaded area below the trace
  const last = closes[closes.length - 1]
  const first = closes[0]
  const areaPath = `${linePath} L ${last.x},${H} L ${first.x},${H} Z`
  frag += `<defs><linearGradient id="ts-ddGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f05d6c" stop-opacity="0.18"/><stop offset="100%" stop-color="#f05d6c" stop-opacity="0"/></linearGradient></defs>`
  frag += `<path d="${areaPath}" fill="url(#ts-ddGrad)" opacity="0">`
  frag += `<animate attributeName="opacity" values="0;1" dur="0.8s" begin="3s" fill="freeze" />`
  frag += `</path>`

  return { svg: frag, closes }
}

export default function CandleStage() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  // Compute the SVG fragment once per mount. useMemo so it doesn't recompute on re-renders.
  const built = useMemo(buildCandlesSVG, [])

  useEffect(() => {
    const el = svgRef.current
    if (el) el.innerHTML = built.svg
  }, [built])

  return (
    <div className="ts-candle-stage">
      <svg ref={svgRef} className="ts-candles" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />

      <div className="ts-price-axis">
        <span>$2,400</span>
        <span>$2,300</span>
        <span>$2,200</span>
        <span>$2,100</span>
        <span>$2,000</span>
      </div>

      <div className="ts-x-axis">
        <span>09:15</span>
        <span>11:00</span>
        <span>13:00</span>
        <span>15:30</span>
      </div>

      <PatternsTicker />

      <style jsx>{`
        .ts-candle-stage {
          position: relative;
          border: 1px solid #1f2a44;
          background: linear-gradient(180deg, #0e1830, #0a1126);
          border-radius: 18px;
          padding: 18px 18px 22px;
          height: 430px;
          overflow: hidden;
          box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.6);
          font-family: var(--font-dm-sans);
        }
        .ts-candle-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 60%, rgba(240, 93, 108, 0.06));
          pointer-events: none;
        }
        .ts-candles {
          width: calc(100% - 36px);
          height: calc(100% - 30px);
          position: absolute;
          left: 18px;
          top: 18px;
          bottom: 30px;
        }
        .ts-price-axis {
          position: absolute;
          right: 8px;
          top: 14px;
          bottom: 14px;
          width: 32px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: var(--font-dm-mono);
          font-size: 9px;
          color: #8a93a8;
          text-align: right;
          letter-spacing: 0.04em;
          opacity: 0.6;
        }
        .ts-x-axis {
          position: absolute;
          left: 18px;
          right: 60px;
          bottom: 6px;
          display: flex;
          justify-content: space-between;
          font-family: var(--font-dm-mono);
          font-size: 9px;
          color: #8a93a8;
          letter-spacing: 0.04em;
          opacity: 0.55;
        }
        @media (max-width: 880px) {
          .ts-candle-stage {
            height: auto;
            padding-bottom: 18px;
          }
        }
      `}</style>
    </div>
  )
}
