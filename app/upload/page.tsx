export default function UploadPage() {
  return (
    <section className="section-view" style={{ display: 'block' }}>
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              📤 Analyse Your Trades
            </div>
            <span className="badge badge-free">Free &middot; No login</span>
          </div>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Upload area coming soon. Drag &amp; drop your trade files here.</p>
            <p style={{ marginTop: 12, fontSize: 13 }}>Supports PDF, CSV, Excel, Screenshots &middot; Any broker worldwide</p>
          </div>
        </div>
      </div>
    </section>
  )
}
