import Link from 'next/link'

const NAV = [
  { label: 'How it works', href: '/#how' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Glossary', href: '/glossary' },
]

const LEGAL = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Refund Policy', href: '/refund' },
  { label: 'Contact', href: 'mailto:sandeep.trader1407@gmail.com' },
]

export default function Footer() {
  return (
    <footer style={{
      background: '#080C14',
      borderTop: '0.5px solid rgba(255,255,255,0.07)',
      padding: '60px 24px 32px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Top row */}
        <div className="footer-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 48,
          marginBottom: 48,
        }}>
          {/* Brand */}
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 400,
              color: '#F1F5F9',
              letterSpacing: '-0.02em',
              marginBottom: 12,
            }}>
              TradeSaath
            </div>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'rgba(241,245,249,0.42)',
              lineHeight: 1.7,
              maxWidth: 220,
              margin: 0,
            }}>
              AI-powered trading psychology analysis for Indian F&O traders.
            </p>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'rgba(241,245,249,0.25)',
              lineHeight: 1.6,
              maxWidth: 220,
              marginTop: 10,
              marginBottom: 0,
            }}>
              Every trade teaches you something. We make sure you hear it.
            </p>
          </div>

          {/* Product links */}
          <div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(241,245,249,0.28)',
              marginBottom: 16,
            }}>
              Product
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NAV.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    color: 'rgba(241,245,249,0.5)',
                    textDecoration: 'none',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal links */}
          <div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(241,245,249,0.28)',
              marginBottom: 16,
            }}>
              Legal
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LEGAL.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    color: 'rgba(241,245,249,0.5)',
                    textDecoration: 'none',
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{
          borderTop: '0.5px solid rgba(255,255,255,0.07)',
          paddingTop: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'rgba(241,245,249,0.22)',
          }}>
            &copy; {new Date().getFullYear()} TradeSaath. All rights reserved.
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(241,245,249,0.18)',
            letterSpacing: '0.04em',
          }}>
            NSE &middot; BSE &middot; 20+ brokers &middot; Any format
          </span>
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </footer>
  )
}
