'use client'

import { useEffect, useState } from 'react'

interface Exchange {
  id: string
  label: string
  tz: string
  openMin: number
  closeMin: number
  cx: number
  cy: number
}

// Roughly ordered west-to-east; (cx, cy) are decorative placements around the
// wireframe globe, not a real map projection.
const EXCHANGES: readonly Exchange[] = [
  { id: 'NYSE', label: 'NYSE · New York',  tz: 'America/New_York',  openMin: 9 * 60 + 30, closeMin: 16 * 60,      cx: 37.8,  cy: 115.5 },
  { id: 'LSE',  label: 'LSE · London',     tz: 'Europe/London',     openMin: 8 * 60,      closeMin: 16 * 60 + 30, cx: 115.5, cy: 37.8 },
  { id: 'NSE',  label: 'NSE · Mumbai',     tz: 'Asia/Kolkata',      openMin: 9 * 60 + 15, closeMin: 15 * 60 + 30, cx: 225,   cy: 47.4 },
  { id: 'SGX',  label: 'SGX · Singapore',  tz: 'Asia/Singapore',    openMin: 9 * 60,      closeMin: 17 * 60,      cx: 282.2, cy: 115.5 },
  { id: 'TSE',  label: 'TSE · Tokyo',      tz: 'Asia/Tokyo',        openMin: 9 * 60,      closeMin: 15 * 60,      cx: 282.2, cy: 204.5 },
  { id: 'ASX',  label: 'ASX · Sydney',     tz: 'Australia/Sydney',  openMin: 10 * 60,     closeMin: 16 * 60,      cx: 204.5, cy: 282.2 },
] as const

const MERIDIANS: readonly { values: string; keyTimes: string; fallbackRx: number }[] = [
  { values: '4;130;4',            keyTimes: '0;0.5;1',           fallbackRx: 40 },
  { values: '130;4;130',          keyTimes: '0;0.5;1',           fallbackRx: 90 },
  { values: '4;90;130;90;4',      keyTimes: '0;0.25;0.5;0.75;1', fallbackRx: 65 },
  { values: '130;90;4;90;130',    keyTimes: '0;0.25;0.5;0.75;1', fallbackRx: 110 },
] as const

function localState(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  const days: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0
  return { minutes: hour * 60 + parseInt(get('minute'), 10), weekday: days[get('weekday')] ?? 0 }
}

// Public holidays are not modelled — an exchange marked "open" here may be
// closed for a local holiday. This is a live-hours indicator only.
function isExchangeOpen(ex: Exchange, now: Date): boolean {
  const { minutes, weekday } = localState(ex.tz, now)
  if (weekday < 1 || weekday > 5) return false
  return minutes >= ex.openMin && minutes < ex.closeMin
}

export default function GlobalMarkets() {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mql.matches)

    const recompute = (): void => {
      const now = new Date()
      const next = new Set<string>()
      for (const ex of EXCHANGES) {
        if (isExchangeOpen(ex, now)) next.add(ex.id)
      }
      setOpenIds(next)
    }
    recompute()
    const interval = window.setInterval(recompute, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="ts-gm">
      <div className="ts-container">
        <div className="ts-gm-grid">
          <div>
            <span className="ts-gm-pill">
              <span className="ts-gm-pill-dot" />
              GLOBAL COVERAGE
            </span>
            <h2 className="ts-gm-h2">Every market, right now.</h2>
            <p className="ts-gm-p">
              NSE options at 10am IST, NYSE futures into the close, crypto at 3am — TradeSaath reads the same
              patterns wherever and whenever you trade.
            </p>

            <ul className="ts-gm-list">
              {EXCHANGES.map((ex) => {
                const open = openIds.has(ex.id)
                return (
                  <li key={ex.id}>
                    <span className={open ? 'ts-gm-listdot ts-gm-listdot-open' : 'ts-gm-listdot'} />
                    <span className="ts-gm-listlabel">{ex.label}</span>
                    <span className={open ? 'ts-gm-liststatus ts-gm-liststatus-open' : 'ts-gm-liststatus'}>
                      {open ? 'Open now' : 'Closed'}
                    </span>
                  </li>
                )
              })}
            </ul>

            <span className="ts-gm-crypto-pill">
              <span className="ts-gm-listdot ts-gm-listdot-open" />
              Crypto · 24/7
            </span>
          </div>

          <div className="ts-gm-globe-wrap" aria-hidden="true">
            <svg className="ts-gm-globe" viewBox="0 0 320 320">
              <circle cx="160" cy="160" r="130" fill="none" stroke="var(--ts-line)" />
              <ellipse cx="160" cy="90"  rx="120" ry="20" fill="none" stroke="var(--ts-line)" strokeOpacity="0.5" />
              <ellipse cx="160" cy="160" rx="130" ry="34" fill="none" stroke="var(--ts-line)" strokeOpacity="0.5" />
              <ellipse cx="160" cy="230" rx="120" ry="20" fill="none" stroke="var(--ts-line)" strokeOpacity="0.5" />

              {MERIDIANS.map((m, i) => (
                <ellipse
                  key={i}
                  cx="160"
                  cy="160"
                  ry="130"
                  rx={m.fallbackRx}
                  fill="none"
                  stroke="var(--ts-mute)"
                  strokeOpacity="0.4"
                >
                  {!reduceMotion && (
                    <animate
                      attributeName="rx"
                      values={m.values}
                      keyTimes={m.keyTimes}
                      dur="18s"
                      repeatCount="indefinite"
                    />
                  )}
                </ellipse>
              ))}

              {EXCHANGES.map((ex) => {
                const open = openIds.has(ex.id)
                return (
                  <g key={ex.id}>
                    {open && !reduceMotion && (
                      <circle cx={ex.cx} cy={ex.cy} r="4" className="ts-gm-node-ping" />
                    )}
                    <circle
                      cx={ex.cx}
                      cy={ex.cy}
                      r="4"
                      className={open ? 'ts-gm-node ts-gm-node-open' : 'ts-gm-node'}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ts-gm {
          background: var(--ts-void);
          color: var(--ts-ink);
          padding: 120px 0;
          font-family: var(--font-sans);
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .ts-gm-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
        }
        .ts-gm-pill {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid var(--ts-line);
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ts-mute);
          margin-bottom: 24px;
        }
        .ts-gm-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: var(--ts-signal);
          box-shadow: 0 0 0 4px rgba(232, 121, 43, 0.15);
        }
        .ts-gm-h2 {
          font-family: var(--font-display);
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 48px;
          color: #fff;
        }
        .ts-gm-p {
          margin-top: 18px;
          color: var(--ts-mute);
          font-size: 16px;
          line-height: 1.6;
          max-width: 480px;
        }
        .ts-gm-list {
          list-style: none;
          padding: 0;
          margin: 32px 0 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ts-gm-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid var(--ts-line);
          font-size: 13.5px;
        }
        .ts-gm-listdot {
          width: 7px;
          height: 7px;
          border-radius: 99px;
          background: var(--ts-mute);
          flex-shrink: 0;
        }
        .ts-gm-listdot-open {
          background: var(--ts-signal);
          box-shadow: 0 0 6px rgba(232, 121, 43, 0.7);
        }
        .ts-gm-listlabel {
          flex: 1;
          color: var(--ts-ink);
        }
        .ts-gm-liststatus {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--ts-mute);
        }
        .ts-gm-liststatus-open {
          color: var(--ts-signal);
        }
        .ts-gm-crypto-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--ts-mute);
          letter-spacing: 0.04em;
        }
        .ts-gm-globe-wrap {
          display: flex;
          justify-content: center;
        }
        .ts-gm-globe {
          width: 100%;
          max-width: 400px;
        }
        :global(.ts-gm-node) {
          fill: var(--ts-mute);
          transition: fill 0.3s ease;
        }
        :global(.ts-gm-node-open) {
          fill: var(--ts-signal);
        }
        :global(.ts-gm-node-ping) {
          fill: none;
          stroke: var(--ts-signal);
          stroke-width: 1.5;
          transform-origin: center;
          animation: ts-gm-pulse 2s ease-out infinite;
        }
        @keyframes ts-gm-pulse {
          0% { r: 4; opacity: 0.8; }
          100% { r: 15; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.ts-gm-node-ping) { animation: none; opacity: 0; }
        }
        @media (max-width: 880px) {
          .ts-gm { padding: 60px 0; }
          .ts-gm-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .ts-gm-h2 { font-size: 34px; }
          .ts-gm-globe-wrap { order: -1; }
          .ts-gm-globe { max-width: 260px; }
        }
      `}</style>
    </section>
  )
}
