'use client'

interface Trade {
  time?: string
  symbol?: string
  side?: string
  pnl?: number
  tag?: string
}

interface Session {
  date?: string
  trades?: number
  pnl?: number
  winRate?: number
}

interface RecentActivityProps {
  recentTrades?: Trade[]
  recentSessions?: Session[]
}

export default function RecentActivity({ recentTrades = [], recentSessions = [] }: RecentActivityProps) {
  const formatPnl = (v: number) => {
    const s = Math.abs(v).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })
    return v >= 0 ? `+${s}` : `-${s}`
  }

  const getTagColor = (tag?: string) => {
    if (!tag) return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
    const t = tag.toLowerCase()
    if (t.includes('win') || t.includes('disciplined')) return { bg: 'rgba(54,211,153,0.1)', color: '#36d399' }
    if (t.includes('revenge') || t.includes('fomo')) return { bg: 'rgba(240,93,108,0.1)', color: '#f05d6c' }
    if (t.includes('overconfiden')) return { bg: 'rgba(240,180,41,0.1)', color: '#f0b429' }
    return { bg: 'rgba(91,141,239,0.1)', color: '#5b8def' }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Recent Trades */}
      <div style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📈 Recent Trades</div>
        {recentTrades.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.4, padding: '20px 0', textAlign: 'center' }}>No trades yet — upload your first file</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentTrades.slice(0, 5).map((t, i) => {
              const tagStyle = getTagColor(t.tag)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.4, minWidth: 40 }}>{t.time || '--:--'}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{t.symbol || 'Unknown'}</span>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, backgroundColor: t.side === 'BUY' ? 'rgba(54,211,153,0.15)' : 'rgba(240,93,108,0.15)', color: t.side === 'BUY' ? '#36d399' : '#f05d6c', fontFamily: 'monospace' }}>{t.side || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.tag && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, backgroundColor: tagStyle.bg, color: tagStyle.color, fontFamily: 'monospace' }}>{t.tag}</span>}
                    <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500, color: (t.pnl || 0) >= 0 ? '#36d399' : '#f05d6c' }}>{formatPnl(t.pnl || 0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📋 Recent Sessions</div>
        {recentSessions.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.4, padding: '20px 0', textAlign: 'center' }}>No sessions yet — analyse your first trade file</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.slice(0, 4).map((s, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.5 }}>{s.date || 'Unknown date'}</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 500, color: (s.pnl || 0) >= 0 ? '#36d399' : '#f05d6c' }}>{formatPnl(s.pnl || 0)}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 10, opacity: 0.4 }}>{s.trades || 0} trades</span>
                  <span style={{ fontSize: 10, opacity: 0.4 }}>WR {s.winRate || 0}%</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'center' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, s.winRate || 0)}%`, backgroundColor: (s.winRate || 0) >= 50 ? '#36d399' : '#f05d6c' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
