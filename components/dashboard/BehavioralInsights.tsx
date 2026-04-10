"use client"

interface Props {
  sessionCount: number
}

const PLACEHOLDER_INSIGHTS = [
  {
    icon: "🔥",
    title: "Top Money Drain",
    desc: "Revenge trading after losses costs you the most. 40% of your red days start with an unplanned trade after a loss.",
    color: "var(--red)",
  },
  {
    icon: "📊",
    title: "Volume Pattern",
    desc: "You trade 2.3x more after a loss. Your best days are when you stay under 6 trades total.",
    color: "var(--gold)",
  },
  {
    icon: "☀️",
    title: "Best Performance Window",
    desc: "Your win rate is 72% between 9:15-10:30 AM but drops to 34% after 2 PM. Consider stopping earlier.",
    color: "var(--green)",
  },
  {
    icon: "🎯",
    title: "Position Sizing",
    desc: "Your size mirrors your emotions - averaging 35 lots on winning days but 60+ lots when chasing losses.",
    color: "var(--purple)",
  },
]

export default function BehavioralInsights({ sessionCount }: Props) {
  if (sessionCount < 3) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
        <div className="text-3xl mb-3">🧠</div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Behavioral Insights</h3>
        <p className="text-xs" style={{ color: "var(--text2)" }}>Upload 3+ sessions to unlock behavioral insights and pattern detection.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>Behavioral Insights</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLACEHOLDER_INSIGHTS.map((insight) => (
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
