'use client'

interface GoalTrackingProps {
  winRate: number      // current win rate 0-100
  revengeTrades: number // count of revenge trades this month
  maxDailyTrades: number // max trades in a single day this month
  riskReward: number   // current avg risk:reward ratio
}

export default function GoalTracking({
  winRate = 0,
  revengeTrades = 0,
  maxDailyTrades = 0,
  riskReward = 0
}: GoalTrackingProps) {
  const goals = [
    {
      label: 'Win Rate',
      current: winRate,
      target: 50,
      unit: '%',
      color: '#3ee8c4',
      tip: winRate >= 50 ? 'On track!' : `${(50 - winRate).toFixed(0)}% to go`
    },
    {
      label: 'Zero Revenge Trades',
      current: Math.max(0, 5 - revengeTrades),
      target: 5,
      unit: '/5 days',
      color: '#9d7af7',
      tip: revengeTrades === 0 ? 'Clean streak!' : `${revengeTrades} revenge trades this month`
    },
    {
      label: 'Max Daily Trades',
      current: maxDailyTrades <= 10 ? 10 : 0,
      target: 10,
      unit: 'trades',
      color: '#5b8def',
      tip: maxDailyTrades <= 10 ? 'Disciplined!' : `Overtraded: ${maxDailyTrades} in one day`
    },
    {
      label: 'Risk:Reward',
      current: Math.min(riskReward, 2) * 50,
      target: 100,
      unit: '',
      color: '#f0b429',
      tip: riskReward >= 2 ? 'Excellent R:R!' : `Current: 1:${riskReward.toFixed(1)}`
    },
  ]

  return (
    <div className="p-4 md:p-5 rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Goal Tracking</span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, backgroundColor: 'rgba(240,180,41,0.1)', color: '#f0b429', border: '1px solid rgba(240,180,41,0.2)', fontFamily: 'monospace', letterSpacing: 1 }}>PRO</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {goals.map((g, i) => {
          const pct = Math.min(100, Math.max(0, (g.current / g.target) * 100))
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{g.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.5 }}>{g.tip}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, backgroundColor: g.color, width: `${pct}%`, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
