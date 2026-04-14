"use client"

interface Insight {
  icon: string
  title: string
  desc: string
  color: string
}

interface Props {
  sessionCount: number
  insights?: Insight[]
}

export default function BehavioralInsights({ sessionCount, insights }: Props) {
  if (sessionCount < 3) {
    return (
      <div className="rounded-xl border p-5 md:p-8 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="text-3xl mb-3">🧠</div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Behavioral Insights</h3>
        <p className="text-xs" style={{ color: "var(--text2)" }}>Upload 3+ sessions to unlock behavioral insights and pattern detection.</p>
      </div>
    )
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="rounded-xl border p-5 md:p-8 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="text-3xl mb-3">🧠</div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Behavioral Insights</h3>
        <p className="text-xs" style={{ color: "var(--text2)" }}>
          Run AI analysis on your sessions to unlock personalised behavioral insights from your real trading patterns.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Behavioral Insights</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight) => (
          <div key={insight.title} className="rounded-xl border p-4" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{insight.icon}</span>
              <span className="text-xs font-bold" style={{ color: insight.color }}>{insight.title}</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>{insight.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
