"use client"

interface MistakeBreakdown {
  type: string
  icon: string
  count: number
  cost: number
}

interface Props {
  totalCost?: number
  counterfactualPnl?: number
  actualPnl?: number
  mistakes?: MistakeBreakdown[]
}

const DEFAULT_MISTAKES: MistakeBreakdown[] = []

function formatINR(v: number): string {
  // #12: show full INR numbers, no L/K abbreviation
  return Math.round(v).toLocaleString("en-IN")
}

export default function MistakeCostCalculator({
  totalCost = 0,
  counterfactualPnl = 0,
  actualPnl = 0,
  mistakes = DEFAULT_MISTAKES,
}: Props) {
  const hasData = mistakes.length > 0 && totalCost !== 0

  const maxCost = hasData ? Math.max(...mistakes.map((m) => Math.abs(m.cost)), 1) : 1

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-base font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>
          Mistake Cost Calculator
        </h2>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
          padding: "2px 8px", borderRadius: 6,
          background: "rgba(62,232,196,.12)", color: "var(--accent)",
        }}>PRO</span>
      </div>

      {!hasData ? (
        <div className="text-center py-10">
          <div className="text-3xl mb-3">💡</div>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            No mistake data available yet.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            As you upload sessions, TradeSaath tags revenge trades, FOMO entries, and overtrading — then shows you their real cost.
          </p>
        </div>
      ) : (
        <>
          {/* Main number */}
          <div className="rounded-lg p-4 mb-4" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.15)" }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text2)" }}>
              Total Learning Cost (All Time)
            </div>
            <div className="text-2xl md:text-[32px]" style={{
              fontWeight: 800, color: "var(--red, #ef4444)",
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1,
            }}>
              -₹{formatINR(Math.abs(totalCost))}
            </div>
          </div>

          {/* Breakdown by type */}
          <div className="space-y-3 mb-4">
            {mistakes.map((m) => (
              <div key={m.type} className="flex items-center gap-3">
                <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{m.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                      {m.type}
                      <span style={{ color: "var(--text2)", fontWeight: 400, marginLeft: 6 }}>
                        ×{m.count}
                      </span>
                    </span>
                    <span className="text-xs font-semibold" style={{
                      color: "var(--red, #ef4444)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      -₹{formatINR(Math.abs(m.cost))}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: "rgba(239,68,68,.5)",
                      width: `${(Math.abs(m.cost) / maxCost) * 100}%`,
                      transition: "width .6s ease-out",
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Counterfactual line */}
          <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.12)" }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14 }}>✨</span>
              <div>
                <div className="text-xs" style={{ color: "var(--text2)" }}>
                  Without these mistakes, your P&L would be
                </div>
                <div className="text-sm font-bold" style={{
                  color: counterfactualPnl >= 0 ? "var(--green, #22c55e)" : "var(--red, #ef4444)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {counterfactualPnl >= 0 ? "+" : ""}₹{formatINR(counterfactualPnl)}
                  <span className="text-xs font-normal ml-2" style={{ color: "var(--text2)" }}>
                    (actual: {actualPnl >= 0 ? "+" : ""}₹{formatINR(actualPnl)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
