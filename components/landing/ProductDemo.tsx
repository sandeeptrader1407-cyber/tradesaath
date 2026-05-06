'use client'

import { useEffect, useRef, useState } from 'react'
import { useCurrency, type Currency } from '@/lib/contexts/CurrencyContext'

type TabId = 'dashboard' | 'journal' | 'journey' | 'saathi'

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'journal', label: 'Journal' },
  { id: 'journey', label: 'Journey' },
  { id: 'saathi', label: 'Saathi' },
] as const

const TAB_LABEL: Record<TabId, string> = {
  dashboard: 'Dashboard',
  journal: 'Journal',
  journey: 'Journey',
  saathi: 'Saathi',
}

interface CurrencyMap {
  USD: string
  EUR: string
  GBP: string
  INR: string
}

const STAT_THIS_MONTH: CurrencyMap = { USD: '+$148', EUR: '+€135', GBP: '+£117', INR: '+₹12,300' }
const STAT_BEST_DAY: CurrencyMap = { USD: '+$1,720', EUR: '+€1,560', GBP: '+£1,360', INR: '+₹1,42,500' }
const STAT_NET: CurrencyMap = { USD: '+$3,840', EUR: '+€3,490', GBP: '+£3,030', INR: '+₹3,18,000' }

interface JournalRow {
  time: string
  symbol: string
  side: 'BUY' | 'SHORT'
  pnl: CurrencyMap
  pnlPositive: boolean
  tag: string
  tagKind: 'good' | 'warn'
}

const JOURNAL_ROWS: readonly JournalRow[] = [
  { time: '09:18', symbol: 'AAPL', side: 'BUY', pnl: { USD: '+$42.10', EUR: '+€38.20', GBP: '+£33.20', INR: '+₹3,490' }, pnlPositive: true, tag: 'Win', tagKind: 'good' },
  { time: '10:04', symbol: 'BTCUSDT', side: 'SHORT', pnl: { USD: '−$118.50', EUR: '−€107.50', GBP: '−£93.50', INR: '−₹9,820' }, pnlPositive: false, tag: 'Revenge', tagKind: 'warn' },
  { time: '11:27', symbol: 'EURUSD', side: 'BUY', pnl: { USD: '+$28.30', EUR: '+€25.70', GBP: '+£22.30', INR: '+₹2,346' }, pnlPositive: true, tag: 'Disciplined', tagKind: 'good' },
  { time: '13:45', symbol: 'TSLA', side: 'BUY', pnl: { USD: '−$96.00', EUR: '−€87.10', GBP: '−£75.80', INR: '−₹7,956' }, pnlPositive: false, tag: 'FOMO', tagKind: 'warn' },
  { time: '14:52', symbol: 'ES', side: 'SHORT', pnl: { USD: '+$210.00', EUR: '+€190.50', GBP: '+£165.80', INR: '+₹17,400' }, pnlPositive: true, tag: 'Plan-followed', tagKind: 'good' },
] as const

const JOURNEY_RISK_COST: CurrencyMap = { USD: '$1,840', EUR: '€1,670', GBP: '£1,460', INR: '₹1,52,500' }
const SAATHI_LEAK_COST: CurrencyMap = { USD: '$642', EUR: '€582', GBP: '£506', INR: '₹53,200' }

const KPI_SPARK_PATHS = {
  thisMonth: 'M 0,16 L 12,15 L 24,17 L 36,12 L 48,10 L 60,7 L 72,5 L 80,3',
  winRate: 'M 0,12 L 12,14 L 24,11 L 36,13 L 48,10 L 60,11 L 72,8 L 80,7',
  bestDay: 'M 0,18 L 12,17 L 24,16 L 36,14 L 48,15 L 60,11 L 72,4 L 80,9',
  discipline: 'M 0,16 L 12,14 L 24,13 L 36,11 L 48,10 L 60,8 L 72,7 L 80,6',
} as const

const EQUITY_DATA: readonly number[] = [
  0, 80, 140, 80, 240, 360, 290, 510, 620, 740, 600, 880,
  1020, 1180, 1300, 1180, 1480, 1620, 1900, 2080, 2300, 2640, 2900, 3840,
] as const

function buildEquityCurve(): string {
  const W = 600
  const H = 150
  const pad = 10
  const max = Math.max(...EQUITY_DATA)
  const min = 0
  const points = EQUITY_DATA.map((v, i) => ({
    x: pad + (i / (EQUITY_DATA.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - min) / (max - min)) * (H - pad * 2),
  }))
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ')
  const last = points[points.length - 1]
  const first = points[0]
  const areaPath = `${linePath} L ${last.x},${H - pad} L ${first.x},${H - pad} Z`
  return `
    <defs>
      <linearGradient id="ts-eqGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#36d399" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#36d399" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#e7e8ea" stroke-dasharray="3 4"/>
    <path d="${areaPath}" fill="url(#ts-eqGrad)"/>
    <path d="${linePath}" fill="none" stroke="#36d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2000" stroke-dashoffset="2000">
      <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="2s" fill="freeze" />
    </path>
    <circle cx="${last.x}" cy="${last.y}" r="4" fill="#36d399" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="2s" fill="freeze"/>
    </circle>
  `
}

function readCurrency<T>(map: Record<Currency, T>, currency: Currency): T {
  return map[currency]
}

export default function ProductDemo() {
  const { currency } = useCurrency()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  const demoRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const tapRingRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Array<HTMLLIElement | null>>([])
  const equityRef = useRef<SVGSVGElement | null>(null)
  // Tracks whether the user has clicked a tab; lives in a ref because the
  // auto-tour effect needs to read its latest value without re-binding.
  const userInteractedRef = useRef<boolean>(false)

  // Inject the equity curve SVG when the dashboard tab becomes visible.
  useEffect(() => {
    if (activeTab !== 'dashboard') return
    const el = equityRef.current
    if (el) el.innerHTML = buildEquityCurve()
  }, [activeTab])

  // Auto-tour cursor
  useEffect(() => {
    const demoEl = demoRef.current
    if (!demoEl) return

    let tour = 0
    // window.setTimeout returns number (DOM); typed explicitly to avoid Node's
    // NodeJS.Timeout type leaking through ReturnType<typeof setTimeout>.
    let tourTimer: number | null = null
    let unmounted = false

    const moveCursorToTab = (idx: number): void => {
      const tab = tabRefs.current[idx]
      const cursor = cursorRef.current
      const tapRing = tapRingRef.current
      if (!tab || !cursor || !tapRing) return
      const r = tab.getBoundingClientRect()
      const wrap = demoEl.getBoundingClientRect()
      const x = r.left - wrap.left + r.width / 2 - 8
      const y = r.top - wrap.top + r.height / 2 + 4
      cursor.style.left = `${x}px`
      cursor.style.top = `${y}px`
      tapRing.style.left = `${x - 9}px`
      tapRing.style.top = `${y - 9}px`
    }

    const tap = (idx: number): void => {
      moveCursorToTab(idx)
      window.setTimeout(() => {
        if (unmounted || userInteractedRef.current) return
        const cursor = cursorRef.current
        const tapRing = tapRingRef.current
        if (!cursor || !tapRing) return
        cursor.classList.add('ts-cursor-tap')
        tapRing.classList.remove('ts-tap-ring-fire')
        // Force reflow to restart animation
        void tapRing.offsetWidth
        tapRing.classList.add('ts-tap-ring-fire')
        window.setTimeout(() => {
          if (unmounted || userInteractedRef.current) return
          setActiveTab(TABS[idx].id)
          cursor.classList.remove('ts-cursor-tap')
        }, 280)
      }, 1100)
    }

    const startTour = (): void => {
      if (unmounted || userInteractedRef.current) return
      const cursor = cursorRef.current
      if (cursor) cursor.style.opacity = '1'
      tap(tour % TABS.length)
      tour++
      tourTimer = window.setTimeout(startTour, 3200)
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !unmounted && !userInteractedRef.current) {
            startTour()
            io.disconnect()
          }
        })
      },
      { threshold: 0.4 }
    )
    io.observe(demoEl)

    return () => {
      unmounted = true
      if (tourTimer) window.clearTimeout(tourTimer)
      io.disconnect()
    }
  }, [])

  const handleTabClick = (tab: TabId): void => {
    userInteractedRef.current = true
    setActiveTab(tab)
    const cursor = cursorRef.current
    const tapRing = tapRingRef.current
    if (cursor) cursor.style.opacity = '0'
    if (tapRing) tapRing.style.opacity = '0'
  }

  return (
    <section className="ts-product" id="features">
      <div className="ts-container">
        <div className="ts-product-head">
          <span className="ts-pill">
            <span className="ts-pill-dot" />
            THE PRODUCT
          </span>
          <h2 className="ts-product-h2">
            Everything you get
            <br />
            after your first upload.
          </h2>
          <p className="ts-product-sub">Click any tab — the cursor will show you around if you wait.</p>
          <div className="ts-demo-nudge">
            <span className="ts-demo-nudge-dot" />
            Interactive — try the tabs
          </div>
        </div>

        <div className="ts-demo" ref={demoRef}>
          <div className="ts-titlebar">
            <div className="ts-lights">
              <span className="ts-light ts-light-r" />
              <span className="ts-light ts-light-y" />
              <span className="ts-light ts-light-g" />
            </div>
            <div className="ts-title-label">
              Now exploring · <span>{TAB_LABEL[activeTab]}</span>
            </div>
          </div>

          <div className="ts-tabs">
            <div className="ts-brand">
              <span className="ts-brand-mark" />
              TradeSaath
            </div>
            <ol>
              {TABS.map((t, i) => (
                <li
                  key={t.id}
                  ref={(el) => { tabRefs.current[i] = el }}
                  className={activeTab === t.id ? 'ts-active' : ''}
                  onClick={() => handleTabClick(t.id)}
                >
                  {t.label}
                </li>
              ))}
            </ol>
            <div className="ts-avatar">SA</div>
            <div className="ts-cursor" ref={cursorRef} aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M6 4 L6 22 L11 18 L14 26 L17 25 L14 17 L21 16 Z" fill="#fff" stroke="#0c1322" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ts-tap-ring" ref={tapRingRef} aria-hidden="true" />
          </div>

          {activeTab === 'dashboard' && (
            <div className="ts-panel">
              <div className="ts-panel-head">
                <div>
                  <div className="ts-panel-h">Your dashboard</div>
                  <div className="ts-panel-sub">Score, top issue, and pre-session focus — at a glance.</div>
                </div>
                <a className="ts-btn ts-btn-dark ts-btn-compact">+ New analysis</a>
              </div>

              <div className="ts-kpi-grid">
                <div className="ts-kpi">
                  <div className="ts-kpi-lab">This month P&amp;L</div>
                  <div className="ts-kpi-val ts-mint">{readCurrency(STAT_THIS_MONTH, currency)}</div>
                  <div className="ts-kpi-delta">Improving vs last month</div>
                  <div className="ts-mini-spark">
                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                      <path d={KPI_SPARK_PATHS.thisMonth} fill="none" stroke="#36d399" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="ts-kpi">
                  <div className="ts-kpi-lab">Win rate</div>
                  <div className="ts-kpi-val">52.8%</div>
                  <div className="ts-kpi-delta">+2.6% vs last month</div>
                  <div className="ts-mini-spark">
                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                      <path d={KPI_SPARK_PATHS.winRate} fill="none" stroke="#7a8093" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="ts-kpi">
                  <div className="ts-kpi-lab">Best day P&amp;L</div>
                  <div className="ts-kpi-val ts-mint">{readCurrency(STAT_BEST_DAY, currency)}</div>
                  <div className="ts-kpi-delta">on 21 Feb · 7 trades</div>
                  <div className="ts-mini-spark">
                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                      <path d={KPI_SPARK_PATHS.bestDay} fill="none" stroke="#36d399" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="ts-kpi">
                  <div className="ts-kpi-lab">Discipline</div>
                  <div className="ts-kpi-val">67</div>
                  <div className="ts-kpi-delta">Above avg profitable</div>
                  <div className="ts-mini-spark">
                    <svg viewBox="0 0 80 20" preserveAspectRatio="none">
                      <path d={KPI_SPARK_PATHS.discipline} fill="none" stroke="#36d399" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="ts-equity">
                <div className="ts-equity-head">
                  <h4>Equity curve · last 24 sessions</h4>
                  <span className="ts-equity-total">{readCurrency(STAT_NET, currency)} net</span>
                </div>
                <div className="ts-equity-chart">
                  <svg ref={equityRef} viewBox="0 0 600 150" preserveAspectRatio="none" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="ts-panel">
              <div className="ts-panel-h">Trade journal</div>
              <div className="ts-panel-sub">Every fill, paired automatically. Tagged by behaviour.</div>
              <div className="ts-journal">
                <div className="ts-journal-row ts-journal-header">
                  <div>Time</div><div>Symbol</div><div>Side</div><div>P&amp;L</div><div>Tag</div>
                </div>
                {JOURNAL_ROWS.map((r, i) => (
                  <div key={i} className="ts-journal-row">
                    <div className="ts-sym">{r.time}</div>
                    <div className="ts-sym">{r.symbol}</div>
                    <div>{r.side}</div>
                    <div className={r.pnlPositive ? 'ts-pnl ts-pnl-up' : 'ts-pnl ts-pnl-dn'}>
                      {readCurrency(r.pnl, currency)}
                    </div>
                    <div className={`ts-tag ts-tag-${r.tagKind}`}>{r.tag}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'journey' && (
            <div className="ts-panel">
              <div className="ts-panel-h">Your journey</div>
              <div className="ts-panel-sub">Pattern timeline. Where you&apos;ve been. What&apos;s improving.</div>
              <div className="ts-timeline">
                <div className="ts-tl-row">
                  <div className="ts-tl-t">WEEK 01 · STOCKS · NEW YORK</div>
                  <div className="ts-tl-h">The number nobody wants to see.</div>
                  <div className="ts-tl-b">
                    &quot;I thought I was revenge trading once in a while. The data said 106 times — in a single
                    month. That number changed everything.&quot;
                  </div>
                </div>
                <div className="ts-tl-row">
                  <div className="ts-tl-t">WEEK 03 · CRYPTO · SINGAPORE</div>
                  <div className="ts-tl-h">Profitable, but not for the right reasons.</div>
                  <div className="ts-tl-b">
                    &quot;My win rate looked fine. Then I saw 31% of my profitable trades were lucky exits — I had
                    held past my target by accident.&quot;
                  </div>
                </div>
                <div className="ts-tl-row">
                  <div className="ts-tl-t">WEEK 06 · FOREX · LONDON</div>
                  <div className="ts-tl-h">The pattern had a name. And a price tag.</div>
                  <div className="ts-tl-b">
                    &quot;The DQS for risk management was 38. The cost in real money was{' '}
                    {readCurrency(JOURNEY_RISK_COST, currency)} a month. Both numbers dropped together once I sized
                    down.&quot;
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'saathi' && (
            <div className="ts-panel">
              <div className="ts-panel-h">Saathi — your AI coach</div>
              <div className="ts-panel-sub">Asks the question your data is already screaming.</div>
              <div className="ts-saathi">
                <div className="ts-col">
                  <div className="ts-bubble ts-bubble-user">Why am I underperforming this month?</div>
                  <div className="ts-bubble ts-bubble-ai">
                    Your win rate is fine (54%). The leak is sizing — your losses on TSLA &amp; BTC are 2.3× your
                    average loss. Look at trades 14, 22, 31 from this month — same setup, you doubled lot size
                    after a winner. Cost: {readCurrency(SAATHI_LEAK_COST, currency)}.
                  </div>
                  <div className="ts-bubble ts-bubble-user">What should I change tomorrow?</div>
                  <div className="ts-bubble ts-bubble-ai">
                    One rule: max 1 contract on TSLA, max 0.05 BTC, regardless of how the previous trade went.
                    We&apos;ll re-check after 10 sessions.
                  </div>
                </div>
                <div className="ts-col">
                  <div className="ts-bubble ts-bubble-ai">
                    Pre-market check — yesterday you broke the 3-trade max twice. Want to set a hard stop at 3
                    today?
                  </div>
                  <div className="ts-bubble ts-bubble-user">Yes. Lock me out after 3.</div>
                  <div className="ts-bubble ts-bubble-ai">
                    Done. Saathi will warn you at trade 2 and block at trade 3. Good luck. Stay with the plan.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ts-product {
          background: #0c1322;
          color: #ecedef;
          padding: 120px 0;
          position: relative;
          overflow: hidden;
          font-family: var(--font-sans);
        }
        .ts-product::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 50% at 50% 0, rgba(255, 122, 0, 0.04), transparent 60%);
          pointer-events: none;
        }
        .ts-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 2;
        }
        .ts-product-head {
          text-align: center;
        }
        .ts-pill {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid #1f2a44;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8a93a8;
        }
        .ts-pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: #36d399;
          box-shadow: 0 0 0 4px rgba(54, 211, 153, 0.15);
        }
        .ts-product-h2 {
          font-family: var(--font-display);
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 56px;
          color: #fff;
          margin-top: 14px;
        }
        .ts-product-sub {
          margin-top: 14px;
          color: #8a93a8;
        }
        .ts-demo-nudge {
          margin: 32px auto 24px;
          display: inline-flex;
          gap: 10px;
          align-items: center;
          padding: 8px 16px;
          border-radius: 999px;
          background: rgba(255, 122, 0, 0.12);
          border: 1px solid rgba(255, 122, 0, 0.4);
          color: #ff7a00;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .ts-demo-nudge-dot {
          width: 6px;
          height: 6px;
          border-radius: 99px;
          background: #ff7a00;
          box-shadow: 0 0 0 4px rgba(255, 122, 0, 0.18);
          animation: ts-nudgePulse 1.6s ease-in-out infinite;
        }
        @keyframes ts-nudgePulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(255, 122, 0, 0.18); }
          50% { box-shadow: 0 0 0 10px rgba(255, 122, 0, 0.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ts-demo-nudge-dot { animation: none; }
        }
        .ts-demo {
          margin-top: 30px;
          background: #0e1830;
          border: 1px solid #1f2a44;
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 60px 120px -40px rgba(0, 0, 0, 0.7);
        }
        .ts-titlebar {
          display: flex;
          align-items: center;
          padding: 14px 18px;
          border-bottom: 1px solid #1f2a44;
          position: relative;
        }
        .ts-lights {
          display: flex;
          gap: 7px;
        }
        .ts-light {
          width: 11px;
          height: 11px;
          border-radius: 99px;
        }
        .ts-light-r { background: #ff605c; }
        .ts-light-y { background: #ffbd44; }
        .ts-light-g { background: #00ca4e; }
        .ts-title-label {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-mono);
          font-size: 12px;
          color: #ff7a00;
          letter-spacing: 0.06em;
        }
        .ts-tabs {
          background: #fff;
          color: #0c1322;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #e7e8ea;
          padding: 0 28px;
          position: relative;
        }
        .ts-brand {
          font-family: var(--font-display);
          font-size: 18px;
          padding: 14px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ts-brand-mark {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: linear-gradient(135deg, #ff7a00, #ff5500);
        }
        .ts-tabs ol {
          list-style: none;
          padding: 0;
          margin: 0 auto;
          display: flex;
          gap: 32px;
          font-size: 14px;
          color: #7a8093;
        }
        .ts-tabs ol li {
          position: relative;
          padding: 18px 0;
          cursor: pointer;
          transition: color 0.15s;
        }
        .ts-tabs ol li.ts-active {
          color: #0c1322;
        }
        .ts-tabs ol li.ts-active::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: #ff7a00;
        }
        .ts-avatar {
          width: 32px;
          height: 32px;
          border-radius: 99px;
          background: #0c1322;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .ts-cursor {
          position: absolute;
          left: -100px;
          top: -100px;
          pointer-events: none;
          width: 32px;
          height: 32px;
          filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5));
          transition: transform 0.3s ease, left 1.4s cubic-bezier(0.6, -0.05, 0.4, 1.05), top 1.4s cubic-bezier(0.6, -0.05, 0.4, 1.05);
          z-index: 5;
        }
        .ts-cursor :global(svg) {
          width: 100%;
          height: 100%;
        }
        .ts-cursor :global(.ts-cursor-tap),
        .ts-cursor.ts-cursor-tap {
          transform: scale(0.85);
        }
        .ts-tap-ring {
          position: absolute;
          left: -100px;
          top: -100px;
          width: 50px;
          height: 50px;
          border-radius: 99px;
          border: 2px solid #ff7a00;
          pointer-events: none;
          opacity: 0;
          z-index: 4;
          transform: scale(0.4);
          transform-origin: center;
        }
        .ts-tap-ring.ts-tap-ring-fire {
          animation: ts-tapring 0.55s ease-out forwards;
        }
        @keyframes ts-tapring {
          0% { opacity: 0.7; transform: scale(0.4); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        .ts-panel {
          background: #fff;
          color: #0c1322;
          min-height: 480px;
          padding: 36px;
          animation: ts-panelIn 0.35s ease;
        }
        @keyframes ts-panelIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ts-panel-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .ts-panel-h {
          font-family: var(--font-display);
          font-size: 30px;
        }
        .ts-panel-sub {
          color: #7a8093;
          margin-top: 6px;
          font-size: 14px;
        }
        :global(.ts-btn-compact) {
          padding: 10px 16px !important;
        }
        .ts-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-top: 18px;
        }
        .ts-kpi {
          background: linear-gradient(180deg, #fafafa, #f4f5f7);
          border: 1px solid #e7e8ea;
          border-radius: 14px;
          padding: 18px;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .ts-kpi:hover {
          transform: translateY(-2px);
          border-color: #d4d6da;
        }
        .ts-kpi-lab {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #7a8093;
        }
        .ts-kpi-val {
          font-family: var(--font-mono);
          font-size: 26px;
          margin-top: 8px;
        }
        .ts-mint {
          color: #36d399;
        }
        .ts-kpi-delta {
          font-size: 12px;
          margin-top: 6px;
          color: #36d399;
        }
        .ts-mini-spark {
          margin-top: 10px;
          height: 20px;
        }
        .ts-mini-spark svg {
          width: 100%;
          height: 100%;
        }
        .ts-equity {
          margin-top: 22px;
          padding: 24px;
          border: 1px solid #e7e8ea;
          border-radius: 14px;
          background: linear-gradient(180deg, #fafafa, #f4f5f7);
        }
        .ts-equity-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .ts-equity h4 {
          margin: 0;
          font-family: var(--font-sans);
          font-size: 13px;
          color: #7a8093;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .ts-equity-total {
          font-family: var(--font-mono);
          font-size: 14px;
          color: #36d399;
        }
        .ts-equity-chart {
          position: relative;
          height: 150px;
        }
        .ts-equity-chart svg {
          width: 100%;
          height: 100%;
        }
        .ts-journal {
          margin-top: 24px;
        }
        .ts-journal-row {
          display: grid;
          grid-template-columns: 120px 1fr 100px 110px 90px;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid #e7e8ea;
          border-radius: 12px;
          background: #fafafa;
          margin-top: 10px;
          font-size: 13px;
          align-items: center;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .ts-journal-row:hover {
          transform: translateX(2px);
          border-color: #d4d6da;
        }
        .ts-journal-header {
          background: #fff !important;
          border: none !important;
          font-size: 11px !important;
          color: #7a8093;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .ts-sym {
          font-family: var(--font-mono);
        }
        .ts-pnl {
          font-family: var(--font-mono);
        }
        .ts-pnl-up {
          color: #36d399;
        }
        .ts-pnl-dn {
          color: #f05d6c;
        }
        .ts-tag {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 99px;
          background: #fff;
          border: 1px solid #e7e8ea;
          width: max-content;
          color: #7a8093;
          font-weight: 500;
        }
        .ts-tag-warn {
          color: #a85a00;
          border-color: rgba(245, 158, 11, 0.4);
          background: rgba(245, 158, 11, 0.08);
        }
        .ts-tag-good {
          color: #177a44;
          border-color: rgba(54, 211, 153, 0.35);
          background: rgba(54, 211, 153, 0.08);
        }
        .ts-timeline {
          position: relative;
          padding-left: 32px;
          margin-top: 24px;
        }
        .ts-timeline::before {
          content: '';
          position: absolute;
          left: 8px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: #e7e8ea;
        }
        .ts-tl-row {
          position: relative;
          padding: 18px 0;
          border-bottom: 1px dashed #e7e8ea;
        }
        .ts-tl-row::before {
          content: '';
          position: absolute;
          left: -31px;
          top: 24px;
          width: 14px;
          height: 14px;
          border-radius: 99px;
          background: #fff;
          border: 2px solid #36d399;
        }
        .ts-tl-t {
          font-family: var(--font-mono);
          font-size: 11px;
          color: #7a8093;
          letter-spacing: 0.06em;
        }
        .ts-tl-h {
          font-family: var(--font-display);
          font-size: 20px;
          margin-top: 4px;
        }
        .ts-tl-b {
          color: #7a8093;
          font-size: 13.5px;
          margin-top: 6px;
          line-height: 1.6;
        }
        .ts-saathi {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-top: 22px;
        }
        .ts-col {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ts-bubble {
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.55;
        }
        .ts-bubble-user {
          background: #f0f1f3;
          color: #0c1322;
          border-radius: 14px 14px 4px 14px;
          align-self: flex-end;
        }
        .ts-bubble-ai {
          background: linear-gradient(180deg, #0e1830, #1a2848);
          color: #fff;
          border-radius: 14px 14px 14px 4px;
        }
        @media (max-width: 880px) {
          .ts-kpi-grid,
          .ts-saathi,
          .ts-journal-row {
            grid-template-columns: 1fr;
          }
          .ts-product-h2 {
            font-size: 36px;
          }
        }
      `}</style>
    </section>
  )
}
