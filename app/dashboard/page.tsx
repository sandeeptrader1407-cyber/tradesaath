export default function DashboardPage() {
  return (
    <section className="section-view" style={{ display: 'block' }}>
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="sec-eyebrow">Dashboard</div>
        <div className="sec-title">Your Trading Overview</div>
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Your dashboard will appear here once you&apos;ve uploaded and analysed trades.</p>
            <a href="/upload" className="btn btn-accent btn-sm" style={{ marginTop: 16, display: 'inline-block' }}>
              Upload Trades →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
