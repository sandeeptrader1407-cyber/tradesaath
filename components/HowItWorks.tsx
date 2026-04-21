export default function HowItWorks() {
  return (
    <section className="landing-sec" id="how">
      <div className="wrap">
        <div className="sec-eyebrow" style={{ textAlign: 'center' }}>How It Works</div>
        <div className="sec-title" style={{ textAlign: 'center' }}>
          From file to insight,<br /><em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>instantly.</em>
        </div>
        <div className="sec-sub" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 48px' }}>
          No account. No setup. Drop your file — market, exchange, and currency are auto-detected from the data itself.
        </div>

        <div className="how-timeline">

          {/* Step 1 */}
          <div className="how-step-v2">
            <div className="how-step-left">
              <div className="how-bubble">
                <span className="how-bubble-num">01</span>
              </div>
              <div className="how-connector"></div>
            </div>
            <div className="how-step-body">
              <div className="how-step-tag">Upload</div>
              <h3 className="how-step-title">Any file, any market — auto-detected</h3>
              <p className="how-step-desc">PDF statements, CSV exports, Excel files, or screenshots. NSE, NYSE, Forex, Crypto — auto-detected in seconds. Up to 40 files per session.</p>
              <div className="how-chips">
                <span>PDF</span><span>CSV</span><span>Excel</span><span>Screenshot</span><span>Any Broker</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="how-step-v2">
            <div className="how-step-left">
              <div className="how-bubble how-bubble-2">
                <span className="how-bubble-num">02</span>
              </div>
              <div className="how-connector"></div>
            </div>
            <div className="how-step-body">
              <div className="how-step-tag" style={{ color: 'var(--gold)', background: 'rgba(245,166,35,.1)', borderColor: 'rgba(245,166,35,.25)' }}>Context</div>
              <h3 className="how-step-title">Tell us how you felt going in</h3>
              <p className="how-step-desc">4 quick dropdowns — your mood, market conditions, session plan, and goal. Takes 10 seconds. Makes the analysis dramatically more personalised.</p>
              <div className="how-mood-row">
                <span>Confident</span>
                <span>Anxious</span>
                <span>Revenge mode</span>
                <span>FOMO</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="how-step-v2">
            <div className="how-step-left">
              <div className="how-bubble how-bubble-3">
                <span className="how-bubble-num">03</span>
              </div>
              <div className="how-connector"></div>
            </div>
            <div className="how-step-body">
              <div className="how-step-tag" style={{ color: '#a78bfa', background: 'rgba(139,92,246,.1)', borderColor: 'rgba(139,92,246,.25)' }}>Analyse Free</div>
              <h3 className="how-step-title">Instant Gross P&amp;L + Vicious Cycle + 3 deep trades</h3>
              <p className="how-step-desc">Your session KPIs, the 10-stage Vicious Cycle breakdown, and three complete trade analyses with technical entry review, mindset coaching, and counterfactual scenarios — all free, no login.</p>
              <div className="how-result-preview">
                <div className="hrp-item hrp-green">Gross P&amp;L calculated</div>
                <div className="hrp-item hrp-purple">Cycle stage detected</div>
                <div className="hrp-item hrp-blue">Price Action &middot; Structure</div>
                <div className="hrp-item hrp-gold">Mindset coaching</div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="how-step-v2">
            <div className="how-step-left">
              <div className="how-bubble how-bubble-4">
                <span className="how-bubble-num">04</span>
              </div>
              <div className="how-connector"></div>
            </div>
            <div className="how-step-body">
              <div className="how-step-tag" style={{ color: 'var(--accent)', background: 'rgba(62,232,196,.08)', borderColor: 'rgba(62,232,196,.2)' }}>Unlock All</div>
              <h3 className="how-step-title">Full report for ₹99 &middot; no subscription needed</h3>
              <p className="how-step-desc">One payment unlocks the complete session — every trade analysed, deep technical breakdown, counterfactual &ldquo;what if&rdquo; scenarios, and per-trade notes. Or go Pro for the journal, journey profiling, and unlimited history.</p>
              <div className="how-chips">
                <span style={{ color: 'var(--accent)', borderColor: 'rgba(62,232,196,.3)' }}>Single Report ₹99</span>
                <span style={{ color: 'var(--gold)', borderColor: 'rgba(245,166,35,.3)' }}>Pro ₹799/mo</span>
                <span style={{ color: '#a78bfa', borderColor: 'rgba(139,92,246,.3)' }}>Yearly save 38%</span>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="how-step-v2" style={{ '--connector-display': 'none' } as React.CSSProperties}>
            <div className="how-step-left">
              <div className="how-bubble how-bubble-5">
                <span className="how-bubble-num">05</span>
              </div>
            </div>
            <div className="how-step-body">
              <div className="how-step-tag" style={{ color: '#fb7185', background: 'rgba(251,113,133,.08)', borderColor: 'rgba(251,113,133,.25)' }}>Pro only</div>
              <h3 className="how-step-title">Journal &middot; Journey &middot; Pattern Intelligence</h3>
              <p className="how-step-desc">Build your trading history over time. Spot recurring patterns across sessions. Complete the Trading Journey profile for hyper-personalised coaching that knows your exact psychology.</p>
              <div className="how-chips">
                <span>Session history</span><span>Pattern alerts</span><span>Trading Journey</span><span>Performance trends</span>
              </div>
            </div>
          </div>

        </div>

        {/* Social proof bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 32, flexWrap: 'wrap' }}>
          {[
            { text: 'Your data never stored' },
            { text: 'Results in ~30 seconds' },
            { text: '10-stage psychology framework' },
            { text: 'First 3 trades free, no login' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
