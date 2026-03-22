export default function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="hero-glow"></div>
      <div className="wrap">
        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          Global Markets &middot; All Currencies &middot; No Login Required
        </div>
        <h1>
          Your trades reveal<br />
          <em>your patterns.</em><br />
          We reveal them to you.
        </h1>
        <p className="hero-sub">
          Upload any trade file — NSE, NYSE, Forex, Crypto, any broker, any format. Get AI-powered
          P&amp;L analysis, per-trade psychology coaching, live session monitoring, predictive
          warnings, and a personalised roadmap. Compare your discipline against 800+ traders.
        </p>
        <div className="hero-markets">
          <span>🇮🇳 NSE / BSE</span>
          <span>🇺🇸 NYSE / NASDAQ</span>
          <span>🇬🇧 LSE</span>
          <span>🌍 Forex</span>
          <span>₿ Crypto</span>
          <span>🥇 Commodities</span>
          <span>🇦🇺 ASX</span>
          <span>🇸🇬 SGX</span>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <a href="/upload" className="btn btn-accent btn-lg">
            🔍 Analyse My Trades Free
          </a>
          <a href="#pricing" className="btn btn-ghost btn-lg">
            See Pricing →
          </a>
        </div>
      </div>
    </section>
  )
}
