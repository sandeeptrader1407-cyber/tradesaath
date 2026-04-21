'use client'

import Link from 'next/link'

export default function HomeUpload() {
  return (
    <section id="sec-upload" style={{ padding: '60px 0' }}>
      <div className="wrap-narrow" style={{ textAlign: 'center' }}>
        <div className="card">
          <div className="card-body" style={{ padding: '40px 24px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Analyse Your Trades Now
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
              Upload any broker file — PDF, CSV, Excel, or screenshot.
              AI reads your trades, detects patterns, and gives you psychology coaching.
            </p>
            <Link href="/upload" className="btn btn-accent btn-lg">
              Start Free Analysis
            </Link>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              No login required &middot; Works with any broker worldwide
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
