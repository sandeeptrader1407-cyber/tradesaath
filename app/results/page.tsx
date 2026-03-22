export default function ResultsPage() {
  return (
    <section className="section-view" style={{ display: 'block' }}>
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              📊 Analysis Results
            </div>
          </div>
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Upload your trades first to see your analysis results here.</p>
            <a href="/upload" className="btn btn-accent btn-sm" style={{ marginTop: 16, display: 'inline-block' }}>
              Upload Trades →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
