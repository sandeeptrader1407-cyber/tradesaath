export default function JournalPage() {
  return (
    <section className="section-view" style={{ display: 'block' }}>
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="sec-eyebrow">Journal</div>
        <div className="sec-title">Your Trading Journal</div>
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Your journal entries will appear here. Analyse trades to start building your journal.</p>
            <a href="/upload" className="btn btn-accent btn-sm" style={{ marginTop: 16, display: 'inline-block' }}>
              Upload Trades →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
