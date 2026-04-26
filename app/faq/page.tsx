import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ — TradeSaath',
}

export default function FAQPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-canvas)' }}>
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 12 }}>
          FAQ
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-muted)' }}>
          Coming soon.
        </p>
      </div>
    </main>
  )
}
