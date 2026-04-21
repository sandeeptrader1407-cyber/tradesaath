"use client"

interface Insight {
  title: string
  desc: string
  color: string
}

interface Props {
  sessionCount: number
  insights?: Insight[]
  pendingCount?: number
}

export default function BehavioralInsights({ sessionCount, insights, pendingCount = 0 }: Props) {
  if (sessionCount < 3) {
    return (
      <div className="card card-body text-center">
        <p className="empty-state-title" style={{ marginBottom: 8 }}>Behavioral insights.</p>
        <p className="t-caption">Upload 3 or more sessions to unlock pattern detection and behavioral analysis.</p>
      </div>
    )
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="card card-body text-center">
        <p className="empty-state-title" style={{ marginBottom: 8 }}>
          {pendingCount > 0 ? 'Analysis pending.' : 'No patterns detected.'}
        </p>
        <p className="t-caption">
          {pendingCount > 0
            ? `${pendingCount} session${pendingCount === 1 ? '' : 's'} awaiting analysis. Run AI analysis above to unlock behavioral insights.`
            : 'Analyse your sessions to unlock personalised behavioral insights from your trading data.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="dash-section-title">Behavioral patterns</p>
      <div className="insights-grid">
        {insights.map((insight) => (
          <div key={insight.title} className="insight-card">
            <h4 style={{ color: insight.color }}>{insight.title}</h4>
            <p>{insight.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
