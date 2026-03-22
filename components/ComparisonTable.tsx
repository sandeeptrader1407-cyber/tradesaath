const rows = [
  { feature: 'Session P&L & KPIs', free: <span className="vs-yes">✓ All trades</span>, single: <span className="vs-yes">✓</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Vicious Cycle Detection', free: <span className="vs-yes">✓</span>, single: <span className="vs-yes">✓</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Per-Trade Psychology', free: '1 trade', single: <span className="vs-yes">✓ All trades</span>, pro: <span className="vs-yes">✓ All trades</span> },
  { feature: 'Technical Analysis', free: 'Basic insights', single: <span className="vs-yes">✓ Deep</span>, pro: <span className="vs-yes">✓ Deep</span> },
  { feature: 'Counterfactual Scenarios', free: <span className="vs-no">✗</span>, single: <span className="vs-yes">✓</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Trade Notes', free: <span className="vs-no">✗</span>, single: <span className="vs-yes">✓</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Journal + History', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Trading Journey Profiling', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Pattern Intelligence', free: <span className="vs-no">✗</span>, single: 'Basic', pro: <span className="vs-yes">✓ Advanced</span> },
  { feature: 'Pro Dashboard', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'AI Coach (Daily/Weekly/Monthly Plans)', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'Personal AI Chatbot', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓</span> },
  { feature: 'TradeSaath Score Benchmark', free: 'Basic', single: <span className="vs-yes">✓</span>, pro: <span className="vs-yes">✓ + Rank</span> },
  { feature: 'Cross-User Pattern Insights', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓ AI-powered</span> },
  { feature: 'Certified Discipline Badge', free: <span className="vs-no">✗</span>, single: <span className="vs-no">✗</span>, pro: <span className="vs-yes">✓ Shareable</span> },
]

export default function ComparisonTable() {
  return (
    <div style={{ marginTop: 48 }}>
      <div className="sec-eyebrow">Free vs Premium</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th>Single ₹99</th>
              <th className="col-ours">Pro ₹799</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.feature}>
                <td>{r.feature}</td>
                <td>{r.free}</td>
                <td>{r.single}</td>
                <td className="col-ours">{r.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
