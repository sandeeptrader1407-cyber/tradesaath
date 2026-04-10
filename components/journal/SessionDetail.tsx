"use client"

interface Trade {
  entry_time: string
  symbol: string
  side: string
  quantity: number
  pnl: number
  tag?: string
}

interface Session {
  id: string
  trade_date: string
  detected_market: string
  trade_count: number
  net_pnl: number
  trades: Trade[] | string | null
  analysis: Record<string, unknown> | string | null
}

interface Props {
  session: Session | null
}

export default function SessionDetail({ session }: Props) {
  if (!session) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Select a session to view details</p>
        </div>
      </div>
    )
  }

  let trades: Trade[] = []
  try {
    if (typeof session.trades === "string") {
      trades = JSON.parse(session.trades)
    } else if (Array.isArray(session.trades)) {
      trades = session.trades
    }
  } catch {
    trades = []
  }

  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : ""
    return `${sign}\u20B9${Math.abs(Math.round(v)).toLocaleString("en-IN")}`
  }

  const getTagColor = (tag?: string) => {
    switch (tag?.toLowerCase()) {
      case "win": return { bg: "rgba(62,232,196,.15)", color: "var(--green)" }
      case "fomo": return { bg: "rgba(255,193,7,.15)", color: "var(--gold)" }
      case "rvg": return { bg: "rgba(245,151,192,.15)", color: "#f597c0" }
      case "avg": return { bg: "rgba(240,93,108,.15)", color: "var(--red)" }
      default: return { bg: "var(--s3)", color: "var(--text2)" }
    }
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
            {session.trade_date || "Session"}
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {session.detected_market || "NSE"} &middot; {session.trade_count || trades.length} trades
          </p>
        </div>
        <div className="font-jetbrains-mono font-bold text-xl" style={{ color: Number(session.net_pnl) >= 0 ? "var(--green)" : "var(--red)" }}>
          {fmt(Number(session.net_pnl || 0))}
        </div>
      </div>

      {/* Trade Timeline */}
      {trades.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: "var(--muted)" }}>No trade data available for this session</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: "var(--border)" }} />

          {trades.map((trade, idx) => {
            let cumPnl = 0
            for (let i = 0; i <= idx; i++) cumPnl += trades[i].pnl
            const tagStyle = getTagColor(trade.tag)

            return (
              <div key={idx} className="relative mb-4 last:mb-0">
                {/* Dot */}
                <div
                  className="absolute -left-4 top-3 w-3 h-3 rounded-full border-2"
                  style={{
                    background: trade.pnl >= 0 ? "var(--green)" : "var(--red)",
                    borderColor: "var(--s1)",
                  }}
                />

                <div className="rounded-lg border p-3 ml-2" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-jetbrains-mono" style={{ color: "var(--muted)" }}>
                        {trade.entry_time || `#${idx + 1}`}
                      </span>
                      <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{trade.symbol}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: trade.side?.toUpperCase() === "BUY" ? "rgba(62,232,196,.15)" : "rgba(240,93,108,.15)",
                          color: trade.side?.toUpperCase() === "BUY" ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {trade.side?.toUpperCase()}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>&times;{trade.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {trade.tag && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: tagStyle.bg, color: tagStyle.color }}>
                          {trade.tag}
                        </span>
                      )}
                      <span className="text-xs font-jetbrains-mono font-bold" style={{ color: trade.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                        {fmt(trade.pnl)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
