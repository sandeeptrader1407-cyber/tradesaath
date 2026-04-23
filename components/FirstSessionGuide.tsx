'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BROKER_LINKS = [
  { name: 'Zerodha',   url: 'https://kite.zerodha.com/portfolio/holdings' },
  { name: 'Fyers',     url: 'https://trade.fyers.in/reports' },
  { name: 'Upstox',   url: 'https://upstox.com/reports' },
  { name: 'Angel One', url: 'https://www.angelone.in/reports' },
  { name: 'Groww',    url: 'https://groww.in/reports' },
  { name: '5Paisa',   url: 'https://www.5paisa.com/reports' },
]

const SAMPLE_ROWS = [
  { date: '22 Apr 2026', symbol: 'NIFTY 25000 CE',       type: 'BUY',  qty: '50', price: '125.00', pnl: '—'    },
  { date: '22 Apr 2026', symbol: 'NIFTY 25000 CE',       type: 'SELL', qty: '50', price: '138.50', pnl: '+675' },
  { date: '21 Apr 2026', symbol: 'BANKNIFTY 52000 PE',   type: 'BUY',  qty: '25', price: '89.00',  pnl: '—'    },
]

function BrokerLinks() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0', marginTop: 10 }}>
      {BROKER_LINKS.map((b, i) => (
        <span key={b.name}>
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--accent)', textDecoration: 'none' }}
          >
            {b.name}
          </a>
          {i < BROKER_LINKS.length - 1 && (
            <span style={{ color: 'var(--border)', margin: '0 8px' }}>&middot;</span>
          )}
        </span>
      ))}
    </div>
  )
}

export default function FirstSessionGuide() {
  const router = useRouter()
  const [showSample, setShowSample] = useState(false)

  function goUpload() {
    router.push('/upload')
  }

  return (
    <main
      className="min-h-screen pt-20 pb-16 px-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Responsive styles for the step grid */}
      <style>{`
        .fsg-steps{display:flex;gap:0}
        .fsg-content{display:flex;gap:24px;margin-top:16px}
        @media(max-width:600px){
          .fsg-steps{flex-direction:column;gap:8px}
          .fsg-content{flex-direction:column;gap:20px}
          .fsg-line{display:none}
        }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>

        {/* Heading */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 400,
          color: 'var(--text)',
          lineHeight: 1.2,
          margin: 0,
        }}>
          Your trading edge starts here.
        </h1>

        {/* Sub */}
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          color: 'var(--muted)',
          lineHeight: 1.7,
          marginTop: 12,
          marginBottom: 40,
        }}>
          Upload your first broker statement and get a complete psychological
          analysis of your trading — patterns, mistakes, discipline score,
          and what to fix first.
        </p>

        {/* 3-step guide */}
        <div style={{ marginBottom: 32 }}>
          {/* Circle row with connecting line */}
          <div className="fsg-steps" style={{ position: 'relative' }}>
            {/* Connecting line — hidden on mobile via .fsg-line class */}
            <div className="fsg-line" style={{
              position: 'absolute',
              top: 12,
              left: 'calc(100% / 6)',
              right: 'calc(100% / 6)',
              height: 1,
              background: 'var(--border)',
              zIndex: 0,
            }} />
            {[1, 2, 3].map(n => (
              <div key={n} style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--text)',
                  color: 'var(--color-canvas)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 400,
                  flexShrink: 0,
                }}>
                  {n}
                </div>
              </div>
            ))}
          </div>

          {/* Content row */}
          <div className="fsg-content">

            {/* Step 1 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Download your statement
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                Log into your broker &rarr; Reports &rarr; Trade book &rarr; Export as CSV or PDF
              </div>
              <BrokerLinks />
            </div>

            {/* Step 2 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Upload it here
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                CSV, XLSX, or PDF. Takes under 10 seconds.
              </div>
              <button
                onClick={goUpload}
                style={{
                  marginTop: 12,
                  height: 40,
                  padding: '0 20px',
                  background: 'var(--text)',
                  color: 'var(--color-canvas)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Upload your first session &rarr;
              </button>
            </div>

            {/* Step 3 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                Get your analysis
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
                DQS discipline score, top patterns, mistake cost, and a
                personalised AI coaching plan.
              </div>
            </div>

          </div>
        </div>

        {/* Sample statement toggle */}
        <div style={{ marginBottom: 36 }}>
          <button
            onClick={() => setShowSample(s => !s)}
            style={{
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              color: 'var(--text2)',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            {showSample ? 'Hide sample' : 'Not sure what your statement looks like?'}
          </button>

          {showSample && (
            <div style={{ marginTop: 14, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                    {['DATE', 'SYMBOL', 'TRADE TYPE', 'QTY', 'PRICE', 'P&L'].map(h => (
                      <th key={h} style={{
                        padding: '6px 10px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--muted)',
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_ROWS.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? 'var(--s2)' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-sans)', color: 'var(--text2)' }}>{row.date}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-sans)', color: 'var(--text)', fontWeight: 400 }}>{row.symbol}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-sans)', color: 'var(--text2)' }}>{row.type}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{row.qty}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{row.price}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: row.pnl.startsWith('+') ? 'var(--green)' : 'var(--muted)' }}>{row.pnl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <button
          onClick={goUpload}
          style={{
            display: 'block',
            width: '100%',
            height: 44,
            background: 'var(--accent)',
            color: 'var(--color-canvas)',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            cursor: 'pointer',
            letterSpacing: '.01em',
          }}
        >
          Upload your first session
        </button>

      </div>
    </main>
  )
}
