const features = [
  { icon: '🌍', bg: 'rgba(62,232,196,.1)', title: 'All Global Markets', desc: 'NSE, BSE, NYSE, NASDAQ, LSE, ASX, SGX, Forex, Crypto, Commodities. Any currency, auto-converted.' },
  { icon: '🧠', bg: 'rgba(139,92,246,.1)', title: 'Psychology Coaching', desc: '10-stage Vicious Cycle detection — FOMO, revenge trading, averaging down, panic exits. Named and coached.' },
  { icon: '📊', bg: 'rgba(59,130,246,.1)', title: 'Technical Analysis', desc: 'Price action based — market structure, entry quality, exit logic, key levels. Indicator analysis only when you provide your strategy.' },
  { icon: '📓', bg: 'rgba(245,166,35,.1)', title: 'Premium Journal', desc: 'Session history, trade timeline, pattern intelligence alerts, and performance trend tracking.' },
  { icon: '🗺', bg: 'rgba(244,63,94,.1)', title: 'Trading Journey', desc: 'Optional deep profiling of your habits, experience, and mindset. Unlocks personalised coaching.' },
  { icon: '📝', bg: 'rgba(16,185,129,.1)', title: 'Trade Notes', desc: 'Add your own notes to every trade section — psychology, technicals, lessons. Stored with your journal.' },
  { icon: '📊', bg: 'rgba(62,232,196,.1)', title: 'Pro Dashboard', desc: 'Monthly KPIs, discipline score, smart insights, best trading times, worst mistakes — all in one view.', border: 'rgba(62,232,196,.25)', badge: 'PRO' },
  { icon: '🗺', bg: 'rgba(245,166,35,.1)', title: 'Saathi', desc: 'Daily, weekly, monthly & quarterly improvement plans. Actionable steps with stop/do/practice tags. Personalised roadmap.', border: 'rgba(245,166,35,.25)', badge: 'PRO' },
  { icon: '💬', bg: 'rgba(139,92,246,.1)', title: 'AI Chat', desc: 'Personal chatbot with full context of your trades, patterns & psychology. Ask anything — acts as mentor, analyst & psychologist.', border: 'rgba(139,92,246,.25)', badge: 'PRO' },
  { icon: '📈', bg: 'rgba(91,141,239,.1)', title: 'TradeSaath Score', desc: 'Your trading discipline credit score. Compare against 800+ Indian traders. See where you rank — and what top traders do differently.', border: 'rgba(91,141,239,.25)' },
  { icon: '🔮', bg: 'rgba(240,180,41,.1)', title: 'Predictive Warnings', desc: 'AI predicts your next mistake before it happens. "82% chance next trade is revenge. Avg cost: ₹1,050." Based on YOUR historical patterns.' },
  { icon: '🔗', bg: 'rgba(62,232,196,.1)', title: 'Broker Integration', desc: 'Auto-import trades from Zerodha, Angel One, Upstox, Dhan. No manual uploads. Coming in Phase 2.', soonBadge: true },
  { icon: '👥', bg: 'rgba(244,63,94,.1)', title: 'Accountability Partners', desc: 'Pair up with trading partners, share challenges, track scores together.', border: 'rgba(244,63,94,.25)', badge: 'PRO' },
]

import ComparisonTable from './ComparisonTable'

export default function Features() {
  return (
    <section className="landing-sec" id="features">
      <div className="wrap">
        <div className="sec-eyebrow">Features</div>
        <div className="sec-title">Built for serious traders</div>
        <div className="feat-grid">
          {features.map((f) => (
            <div
              key={f.title}
              className="feat-card"
              style={f.border ? { borderColor: f.border } : undefined}
            >
              <div className="feat-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3>
                {f.title}
                {f.badge && (
                  <span className="badge badge-pro" style={{ fontSize: 9, verticalAlign: 'middle', marginLeft: 4 }}>{f.badge}</span>
                )}
                {f.soonBadge && (
                  <span className="badge" style={{ fontSize: 8, background: 'rgba(240,180,41,.1)', color: 'var(--gold)', border: '1px solid rgba(240,180,41,.2)', marginLeft: 4 }}>SOON</span>
                )}
              </h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
        <ComparisonTable />
      </div>
    </section>
  )
}
