"use client"

interface MistakeBreakdown {
  type: string
  icon?: string
  count: number
  cost: number
}

interface Props {
  totalCost?: number
  counterfactualPnl?: number
  actualPnl?: number
  mistakes?: MistakeBreakdown[]
  pendingCount?: number
}

const DEFAULT_MISTAKES: MistakeBreakdown[] = []

function formatINR(v: number): string {
  return Math.round(v).toLocaleString("en-IN")
}

export default function MistakeCostCalculator({
  totalCost = 0,
  counterfactualPnl = 0,
  actualPnl = 0,
  mistakes = DEFAULT_MISTAKES,
  pendingCount = 0,
}: Props) {
  // Sort by cost descending
  const sortedMistakes = [...mistakes].sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost))
  const hasData = sortedMistakes.length > 0 && totalCost !== 0
  const maxCost = hasData ? Math.max(...sortedMistakes.map(m => Math.abs(m.cost)), 1) : 1

  return (
    <div className="rounded-xl border p-4 md:p-6" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>
          Pattern Cost
        </h2>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-muted)', fontWeight: 400 }}>
          all time
        </span>
        <span style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
          padding: '2px 8px', borderRadius: 20,
          background: 'var(--color-ink)', color: 'var(--color-canvas)',
          marginLeft: 'auto',
        }}>PRO</span>
      </div>

      {!hasData ? (
        <div className="text-center py-10">
          <p className="text-sm" style={{ color: pendingCount > 0 ? '#f59e0b' : 'var(--text2)', fontWeight: 400 }}>
            {pendingCount > 0 ? "Analysis pending" : "No pattern data yet."}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            {pendingCount > 0
              ? `${pendingCount} session${pendingCount === 1 ? '' : 's'} awaiting analysis.`
              : "Upload sessions to see your pattern costs."}
          </p>
        </div>
      ) : (
        <>
          {/* Total */}
          <div style={{ borderRadius: 8, padding: '12px 14px', marginBottom: 16, background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.15)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', marginBottom: 4 }}>
              Total excess loss from patterns
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--color-loss)', lineHeight: 1.1 }}>
              -&#8377;{formatINR(Math.abs(totalCost))}
            </div>
          </div>

          {/* Pattern cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {sortedMistakes.map((m) => {
              const hasCost = Math.abs(m.cost) > 0
              const costPerTrade = m.count > 0 ? Math.round(Math.abs(m.cost) / m.count / 10) * 10 : 0
              return (
                <div key={m.type} style={{ opacity: hasCost ? 1 : 0.4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-ink)' }}>
                      {m.type}
                      <span style={{ color: 'var(--color-muted)', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                        x{m.count}
                      </span>
                    </span>
                    {hasCost ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--color-loss)' }}>
                        -&#8377;{formatINR(Math.abs(m.cost))}
                      </span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-profit)', fontStyle: 'italic' }}>
                        None this month
                      </span>
                    )}
                  </div>
                  {hasCost && (
                    <>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: 'rgba(192,57,43,0.5)',
                          width: `${(Math.abs(m.cost) / maxCost) * 100}%`,
                          transition: 'width .6s ease-out',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--color-profit)' }}>
                          Save ~&#8377;{formatINR(Math.abs(m.cost))} by fixing this
                        </span>
                        {costPerTrade > 0 && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)' }}>
                            &#8377;{formatINR(costPerTrade)}/trade
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Counterfactual */}
          <div style={{ borderRadius: 8, padding: '10px 12px', background: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.12)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
              Without these patterns your P&L would be
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: counterfactualPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
              {counterfactualPnl >= 0 ? '+' : ''}&#8377;{formatINR(counterfactualPnl)}
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, color: 'var(--color-muted)', marginLeft: 8 }}>
                (actual: {actualPnl >= 0 ? '+' : ''}&#8377;{formatINR(actualPnl)})
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
