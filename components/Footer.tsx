import Link from 'next/link'

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <strong>TradeSaath</strong> — Your AI Trading Companion<br />
        <span style={{ marginTop: 8, display: 'block' }}>
          Every trade teaches you something. We make sure you hear it.
        </span>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          <Link href="/faq" style={{ color: 'var(--muted)', textDecoration: 'none' }}>FAQ</Link>
          <Link href="/glossary" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Glossary</Link>
          <Link href="/pricing" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Terms of Service</Link>
          <Link href="/refund" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Refund Policy</Link>
          <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Contact</a>
        </div>
      </div>
    </footer>
  )
}
