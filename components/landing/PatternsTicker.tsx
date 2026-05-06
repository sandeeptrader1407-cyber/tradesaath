'use client'

import { useEffect, useRef } from 'react'

type Trend = 'up' | 'flat' | 'down'

interface Pattern {
  name: string
  count: number
  /** 0-100 */
  severity: number
  trend: Trend
}

const POOL: readonly Pattern[] = [
  { name: 'Revenge trading', count: 666, severity: 95, trend: 'up' },
  { name: 'Holding past target', count: 234, severity: 78, trend: 'down' },
  { name: 'Late exits', count: 178, severity: 70, trend: 'flat' },
  { name: 'Early exits', count: 156, severity: 65, trend: 'up' },
  { name: 'FOMO entries', count: 142, severity: 62, trend: 'up' },
  { name: 'Stop-loss moving', count: 112, severity: 58, trend: 'up' },
  { name: 'Oversized lots', count: 111, severity: 56, trend: 'up' },
  { name: 'Position stacking', count: 95, severity: 48, trend: 'flat' },
  { name: 'Overconfidence', count: 92, severity: 46, trend: 'up' },
  { name: 'Averaging down', count: 89, severity: 45, trend: 'up' },
  { name: 'Confirmation bias', count: 84, severity: 42, trend: 'down' },
  { name: 'Doubling on losers', count: 73, severity: 38, trend: 'up' },
  { name: 'Trade-away after win', count: 67, severity: 34, trend: 'flat' },
  { name: 'Panic exits', count: 67, severity: 34, trend: 'flat' },
  { name: 'Pre-market emotion', count: 51, severity: 26, trend: 'flat' },
  { name: 'Skip stop-loss', count: 45, severity: 22, trend: 'flat' },
  { name: 'Counter-trend forcing', count: 41, severity: 20, trend: 'up' },
  { name: 'News-day gambling', count: 38, severity: 18, trend: 'down' },
  { name: 'Spreading too thin', count: 38, severity: 18, trend: 'down' },
  { name: 'Anchoring bias', count: 28, severity: 14, trend: 'flat' },
] as const

const VISIBLE = 5
const ROW_HEIGHT = 40
const CYCLE_MS = 2800

function severityClass(sev: number): 'sev-low' | 'sev-med' | 'sev-high' | 'sev-sev' {
  if (sev >= 75) return 'sev-sev'
  if (sev >= 50) return 'sev-high'
  if (sev >= 30) return 'sev-med'
  return 'sev-low'
}

function trendArrow(t: Trend): string {
  return t === 'up' ? '↗' : t === 'down' ? '↘' : '→'
}

export default function PatternsTicker() {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const activeIdxRef = useRef<number>(VISIBLE + 1)
  const cyclingRef = useRef<boolean>(false)

  // Build a row element imperatively (mirrors the reference HTML).
  const buildRow = (p: Pattern): HTMLDivElement => {
    const sevCls = severityClass(p.severity)
    const row = document.createElement('div')
    row.className = 'ts-pattern-row'
    row.innerHTML = `
      <div class="ts-pattern-line">
        <span class="ts-pattern-dot ts-${sevCls}"></span>
        <span class="ts-pattern-name">${p.name}</span>
        <span class="ts-pattern-count ts-${sevCls}" data-target="${p.count}">×${p.count}</span>
        <span class="ts-pattern-trend ts-${p.trend}">${trendArrow(p.trend)}</span>
      </div>
      <div class="ts-pattern-bar">
        <div class="ts-pattern-bar-fill ts-${sevCls}" data-fill="${p.severity}"></div>
      </div>
    `
    return row
  }

  const animateCount = (el: HTMLElement, target: number, duration = 600): void => {
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = '×' + Math.round(target * eased)
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    // Honour OS-level reduced-motion preference (CWV / a11y).
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Initial population: 5 visible + 1 staged offscreen
    track.innerHTML = ''
    for (let i = 0; i < VISIBLE + 1; i++) {
      track.appendChild(buildRow(POOL[i]))
    }
    activeIdxRef.current = VISIBLE + 1

    // Reduced-motion path: paint final state immediately, no rAF, no setInterval.
    if (prefersReducedMotion) {
      const rows = track.querySelectorAll<HTMLDivElement>('.ts-pattern-row')
      rows.forEach((row, i) => {
        if (i >= VISIBLE) return
        const fill = row.querySelector<HTMLDivElement>('.ts-pattern-bar-fill')
        const countEl = row.querySelector<HTMLElement>('.ts-pattern-count')
        if (fill) {
          const sev = parseFloat(fill.dataset.fill ?? '0')
          fill.style.transform = `scaleX(${sev / 100})`
        }
        if (countEl) {
          const target = parseInt(countEl.dataset.target ?? '0', 10)
          countEl.textContent = '×' + target
        }
      })
      return // skip cycle setup entirely
    }

    // Initial reveal: bar fills + count animations on visible rows
    const initialRevealTimeout = window.setTimeout(() => {
      const rows = track.querySelectorAll<HTMLDivElement>('.ts-pattern-row')
      rows.forEach((row, i) => {
        if (i >= VISIBLE) return
        const fill = row.querySelector<HTMLDivElement>('.ts-pattern-bar-fill')
        const countEl = row.querySelector<HTMLElement>('.ts-pattern-count')
        if (fill) {
          const sev = parseFloat(fill.dataset.fill ?? '0')
          window.setTimeout(() => {
            fill.style.transform = `scaleX(${sev / 100})`
          }, 100 + i * 80)
        }
        if (countEl) {
          const target = parseInt(countEl.dataset.target ?? '0', 10)
          window.setTimeout(() => animateCount(countEl, target, 600), 100 + i * 80)
        }
      })
    }, 300)

    const cycle = (): void => {
      if (cyclingRef.current) return
      cyclingRef.current = true

      track.style.transition = 'transform 0.55s cubic-bezier(0.65, 0, 0.35, 1)'
      track.style.transform = `translateY(-${ROW_HEIGHT}px)`

      window.setTimeout(() => {
        const oldRow = track.firstChild
        if (oldRow) track.removeChild(oldRow)

        const next = POOL[activeIdxRef.current % POOL.length]
        track.appendChild(buildRow(next))
        activeIdxRef.current = activeIdxRef.current + 1

        track.style.transition = 'none'
        track.style.transform = 'translateY(0)'
        // Force reflow so the next transition takes effect.
        void track.offsetHeight
        track.style.transition = ''

        const rows = track.querySelectorAll<HTMLDivElement>('.ts-pattern-row')
        const justRevealed = rows[VISIBLE - 1]
        if (justRevealed) {
          justRevealed.classList.add('ts-flash')
          const fill = justRevealed.querySelector<HTMLDivElement>('.ts-pattern-bar-fill')
          if (fill) {
            const sev = parseFloat(fill.dataset.fill ?? '0')
            requestAnimationFrame(() => {
              fill.style.transform = `scaleX(${sev / 100})`
            })
          }
          const countEl = justRevealed.querySelector<HTMLElement>('.ts-pattern-count')
          if (countEl) {
            const target = parseInt(countEl.dataset.target ?? '0', 10)
            animateCount(countEl, target, 700)
          }
          window.setTimeout(() => justRevealed.classList.remove('ts-flash'), 1300)
        }

        cyclingRef.current = false
      }, 560)
    }

    const startCycleTimeout = window.setTimeout(() => {
      const id = window.setInterval(cycle, CYCLE_MS)
      // store id on element for cleanup
      track.dataset.intervalId = String(id)
    }, 1500)

    return () => {
      window.clearTimeout(initialRevealTimeout)
      window.clearTimeout(startCycleTimeout)
      const id = track.dataset.intervalId
      if (id) window.clearInterval(parseInt(id, 10))
    }
  }, [])

  return (
    <div className="ts-patterns-card">
      <div className="ts-scan-line" aria-hidden="true" />

      <div className="ts-patterns-head">
        <span className="ts-patterns-label">Patterns Found</span>
        <span className="ts-patterns-live">Live</span>
      </div>

      <div className="ts-patterns-meta">
        <span className="ts-pulse-dot" /> Analysing <span className="ts-patterns-total">5,616</span> trades · 147 patterns
      </div>

      <div className="ts-patterns-window">
        <div className="ts-patterns-track" ref={trackRef} />
        <div className="ts-refresh-progress">
          <div className="ts-refresh-progress-fill" />
        </div>
      </div>

      <div className="ts-patterns-dqs">
        <div className="ts-dqs-row">
          <span className="ts-dqs-lab">DQS</span>
          <div className="ts-dqs-value">
            <span className="ts-dqs-num">
              67<span className="ts-dqs-denom">/100</span>
            </span>
            <span className="ts-dqs-trend">↘ −4 wk</span>
          </div>
        </div>
        <div className="ts-dqs-spark">
          <svg width="100%" height="100%" viewBox="0 0 200 18" preserveAspectRatio="none">
            <path d="M 0,3 L 25,5 L 50,4 L 75,7 L 100,8 L 125,7 L 150,11 L 175,13 L 200,15" fill="none" stroke="#f05d6c" strokeWidth="1.5" />
            <circle cx="200" cy="15" r="2.5" fill="#f05d6c" />
          </svg>
        </div>
      </div>

      <style jsx>{`
        .ts-patterns-card {
          position: absolute;
          right: 18px;
          top: 18px;
          background: linear-gradient(180deg, rgba(8, 12, 22, 0.94), rgba(12, 19, 34, 0.96));
          backdrop-filter: blur(14px);
          border: 1px solid rgba(240, 93, 108, 0.22);
          border-radius: 16px;
          padding: 0;
          width: 294px;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(240, 93, 108, 0.06) inset;
          overflow: hidden;
          font-family: var(--font-sans);
        }
        .ts-patterns-card::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(240, 93, 108, 0.4) 50%, transparent 100%);
        }
        .ts-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 1.5px;
          top: -2px;
          background: linear-gradient(90deg, transparent 0%, rgba(255, 122, 0, 0.5) 30%, rgba(255, 122, 0, 0.9) 50%, rgba(255, 122, 0, 0.5) 70%, transparent 100%);
          box-shadow: 0 0 12px rgba(255, 122, 0, 0.6), 0 0 4px rgba(255, 122, 0, 0.8);
          animation: ts-scanSweep 9s ease-in-out infinite;
          z-index: 3;
          pointer-events: none;
        }
        @keyframes ts-scanSweep {
          0%, 8% { top: -2px; opacity: 0; }
          10% { top: -2px; opacity: 1; }
          35% { top: calc(100% + 2px); opacity: 1; }
          37%, 100% { top: calc(100% + 2px); opacity: 0; }
        }
        .ts-patterns-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px 10px;
          border-bottom: 1px solid #1f2a44;
          position: relative;
        }
        .ts-patterns-label {
          font-size: 10px;
          letter-spacing: 0.18em;
          color: #8a93a8;
          text-transform: uppercase;
          font-weight: 500;
        }
        .ts-patterns-live {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #f05d6c;
          text-transform: uppercase;
          font-family: var(--font-mono);
        }
        .ts-patterns-live::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 99px;
          background: #f05d6c;
          box-shadow: 0 0 0 0 rgba(240, 93, 108, 0.6);
          animation: ts-livePulse 1.4s ease-in-out infinite;
        }
        @keyframes ts-livePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240, 93, 108, 0.6); }
          50% { box-shadow: 0 0 0 5px rgba(240, 93, 108, 0); }
        }
        .ts-patterns-meta {
          padding: 8px 16px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: #8a93a8;
          letter-spacing: 0.04em;
          border-bottom: 1px dashed #1f2a44;
        }
        .ts-patterns-total {
          color: #fff;
          font-size: 11px;
          font-weight: 500;
        }
        .ts-pulse-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 99px;
          background: #36d399;
          margin-right: 5px;
          vertical-align: middle;
          animation: ts-greenPulse 2s ease-in-out infinite;
        }
        @keyframes ts-greenPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        .ts-patterns-window {
          position: relative;
          height: 200px;
          overflow: hidden;
          padding: 8px 0;
        }
        .ts-patterns-track {
          display: flex;
          flex-direction: column;
          transition: transform 0.55s cubic-bezier(0.65, 0, 0.35, 1);
        }
        .ts-refresh-progress {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 6px;
          height: 1.5px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 99px;
          overflow: hidden;
        }
        .ts-refresh-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, rgba(255, 122, 0, 0.4), rgba(255, 122, 0, 0.7));
          transform-origin: left center;
          animation: ts-refreshFill 2.8s linear infinite;
        }
        @keyframes ts-refreshFill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        .ts-patterns-dqs {
          padding: 10px 16px 14px;
          border-top: 1px solid #1f2a44;
          background: linear-gradient(180deg, transparent, rgba(240, 93, 108, 0.04));
        }
        .ts-dqs-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ts-dqs-lab {
          font-size: 10px;
          color: #8a93a8;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }
        .ts-dqs-value {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .ts-dqs-num {
          font-family: var(--font-mono);
          font-size: 22px;
          color: #36d399;
          font-weight: 500;
        }
        .ts-dqs-denom {
          font-size: 11px;
          color: #8a93a8;
          font-weight: 400;
        }
        .ts-dqs-trend {
          font-size: 10px;
          color: #f05d6c;
          font-family: var(--font-mono);
        }
        .ts-dqs-spark {
          margin-top: 6px;
          height: 18px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ts-scan-line { animation: none; }
          .ts-patterns-live::before { animation: none; }
          .ts-pulse-dot { animation: none; }
          .ts-refresh-progress-fill { animation: none; }
        }
      `}</style>
      <style jsx global>{`
        .ts-pattern-row {
          padding: 7px 16px 9px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          position: relative;
          flex-shrink: 0;
          height: 40px;
          transition: background 0.3s ease;
        }
        .ts-pattern-row.ts-flash::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(54, 211, 153, 0.12), transparent);
          animation: ts-flashFade 1.2s ease-out forwards;
          pointer-events: none;
        }
        @keyframes ts-flashFade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ts-pattern-row.ts-flash::before { animation: none; }
          .ts-patterns-track { transition: none !important; }
        }
        .ts-pattern-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: #dde1ea;
          font-family: var(--font-sans);
        }
        .ts-pattern-dot {
          width: 7px;
          height: 7px;
          border-radius: 99px;
          flex-shrink: 0;
          box-shadow: 0 0 6px currentColor;
        }
        .ts-pattern-dot.ts-sev-low { background: #fbbf24; color: #fbbf24; }
        .ts-pattern-dot.ts-sev-med { background: #f59e0b; color: #f59e0b; }
        .ts-pattern-dot.ts-sev-high { background: #fb7c5c; color: #fb7c5c; }
        .ts-pattern-dot.ts-sev-sev { background: #f05d6c; color: #f05d6c; }
        .ts-pattern-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ts-pattern-count {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }
        .ts-pattern-count.ts-sev-low { color: #fbbf24; }
        .ts-pattern-count.ts-sev-med { color: #f59e0b; }
        .ts-pattern-count.ts-sev-high { color: #fb7c5c; }
        .ts-pattern-count.ts-sev-sev { color: #f05d6c; }
        .ts-pattern-trend {
          font-family: var(--font-mono);
          font-size: 11px;
          flex-shrink: 0;
          width: 14px;
          text-align: center;
        }
        .ts-pattern-trend.ts-up { color: #f05d6c; }
        .ts-pattern-trend.ts-flat { color: #8a93a8; }
        .ts-pattern-trend.ts-down { color: #36d399; }
        .ts-pattern-bar {
          height: 2px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.05);
          margin-left: 15px;
          overflow: hidden;
        }
        .ts-pattern-bar-fill {
          height: 100%;
          border-radius: 99px;
          transform-origin: left center;
          transform: scaleX(0);
          transition: transform 0.8s cubic-bezier(0.65, 0, 0.35, 1);
        }
        .ts-pattern-bar-fill.ts-sev-low { background: linear-gradient(90deg, #fbbf24, rgba(251, 191, 36, 0.4)); }
        .ts-pattern-bar-fill.ts-sev-med { background: linear-gradient(90deg, #f59e0b, rgba(245, 158, 11, 0.4)); }
        .ts-pattern-bar-fill.ts-sev-high { background: linear-gradient(90deg, #fb7c5c, rgba(251, 124, 92, 0.4)); }
        .ts-pattern-bar-fill.ts-sev-sev { background: linear-gradient(90deg, #f05d6c, rgba(240, 93, 108, 0.4)); }
      `}</style>
    </div>
  )
}
