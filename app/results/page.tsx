'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRazorpay } from '@/hooks/useRazorpay'

interface Trade {
  id: number; time: string; symbol: string; side: 'BUY' | 'SELL'
  qty: number; entry: number; exit: number; pnl: number; cumPnl: number
  fills: { qty: number; price: number }[]
}

interface PerTrade {
  tradeIndex: number; tag: string; tagColor: string; label: string
  quickSummary: string; psychologyNote: string; technicalNote: string
  counterfactual: string; sessionBadge: string; timeGap: number; timeGapColor: string
}

interface Pattern {
  name: string; icon: string; description: string; costInRupees: number; frequency: string
}

interface Analysis {
  summary: string
  dqsScore: number
  dqsFactors: { name: string; score: number; color: string }[]
  perTrade: PerTrade[]
  patterns: Pattern[]
  financialImpact: { totalLost: number; potentialPnl: number; message: string }
  rulesForNextSession: string[]
  bestCase: string
  worstCase: string
}

interface ResultsData {
  trades: Trade[]
  analysis: Analysis
  broker: string
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  green: { bg: 'rgba(54,211,153,.1)', color: 'var(--green)' },
  blue: { bg: 'rgba(91,141,239,.1)', color: 'var(--blue)' },
  orange: { bg: 'rgba(242,155,75,.1)', color: 'var(--orange)' },
  red: { bg: 'rgba(240,93,108,.1)', color: 'var(--red)' },
  purple: { bg: 'rgba(157,122,247,.1)', color: 'var(--purple)' },
  gold: { bg: 'rgba(240,180,41,.1)', color: 'var(--gold)' },
}

function fmtExact(n: number) {
  return (n >= 0 ? '+' : '') + '₹' + Math.abs(n).toLocaleString('en-IN')
}

export default function ResultsPage() {
  const [data, setData] = useState<ResultsData | null>(null)
  const [expandedTrades, setExpandedTrades] = useState<Set<number>>(new Set([0]))
  const [deepDives, setDeepDives] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL' | 'loss'>('all')
  const [selectedTrade, setSelectedTrade] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const { pay, loading: payLoading, paid, testMode } = useRazorpay()

  useEffect(() => {
    const stored = sessionStorage.getItem('tradesaath_results')
    if (stored) {
      try { setData(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  if (!data) {
    return (
      <section style={{ paddingTop: 100, textAlign: 'center', minHeight: '80vh' }}>
        <div className="wrap-narrow">
          <div className="card">
            <div className="card-body" style={{ padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 8 }}>No Analysis Data</h2>
              <p style={{ color: 'var(--muted2)', fontSize: 14, marginBottom: 20 }}>
                Upload your trades first to see the AI analysis.
              </p>
              <Link href="/upload" className="btn btn-accent">Upload Trades</Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const { trades, analysis } = data
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const wins = trades.filter((t) => t.pnl > 0).length
  const losses = trades.filter((t) => t.pnl < 0).length
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0

  const filteredTrades = trades.filter((t) => {
    if (filter === 'BUY') return t.side === 'BUY'
    if (filter === 'SELL') return t.side === 'SELL'
    if (filter === 'loss') return t.pnl < 0
    return true
  })

  function toggleTrade(idx: number) {
    setExpandedTrades((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
    setSelectedTrade(idx)
  }

  function toggleDeepDive(idx: number) {
    setDeepDives((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function getPerTrade(idx: number): PerTrade | undefined {
    return analysis.perTrade.find((p) => p.tradeIndex === idx)
  }

  const FREE_LIMIT = (unlocked || paid) ? Infinity : 1
  const dqsColor = analysis.dqsScore >= 70 ? 'var(--green)' : analysis.dqsScore >= 50 ? 'var(--gold)' : analysis.dqsScore >= 30 ? 'var(--orange)' : 'var(--red)'
  const dqsCircumference = 2 * Math.PI * 50
  const dqsDash = (analysis.dqsScore / 100) * dqsCircumference

  return (
    <section style={{ paddingTop: 80, paddingBottom: 60, position: 'relative', zIndex: 1 }}>
      <div className="wrap" style={{ maxWidth: 1100 }}>

        {/* Results Nav */}
        <div className="results-nav">
          <Link href="/upload" className="btn btn-ghost btn-sm">&larr; New Upload</Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-free">Free Analysis</span>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip">
          <div className="kpi-item">
            <div className="kpi-label">Net P&L</div>
            <div className="kpi-val" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtExact(totalPnl)}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Trades</div>
            <div className="kpi-val">{trades.length}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Win Rate</div>
            <div className="kpi-val">{winRate}%</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">Wins / Losses</div>
            <div className="kpi-val"><span style={{ color: 'var(--green)' }}>{wins}</span> / <span style={{ color: 'var(--red)' }}>{losses}</span></div>
          </div>
          <div className="kpi-item">
            <div className="kpi-label">DQS</div>
            <div className="kpi-val" style={{ color: dqsColor }}>{analysis.dqsScore}/100</div>
          </div>
        </div>

        {/* AI Summary + DQS */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">🧠 AI Session Summary<span className="badge badge-free">FREE</span></div>
          <div className="card-body">
            <div className="quick-summary">{analysis.summary}</div>
            <div className="dqs-wrap">
              <div className="dqs-ring">
                <svg viewBox="0 0 120 120">
                  <circle className="ring-bg" cx="60" cy="60" r="50" />
                  <circle className="ring-fill" cx="60" cy="60" r="50" stroke={dqsColor}
                    style={{ strokeDasharray: `${dqsDash} ${dqsCircumference}` }} />
                </svg>
                <div className="dqs-center">
                  <div className="dqs-num" style={{ color: dqsColor }}>{analysis.dqsScore}</div>
                  <div className="dqs-lbl">Quality</div>
                </div>
              </div>
              <div className="dqs-factors">
                {analysis.dqsFactors?.map((f, i) => (
                  <div key={i} className="dqs-f">
                    <span className="dqs-f-name">{f.name}</span>
                    <div className="dqs-f-bar">
                      <div className="dqs-f-fill" style={{ width: `${f.score}%`, background: `var(--${f.color})` }} />
                    </div>
                    <span className="dqs-f-val" style={{ color: `var(--${f.color})` }}>{f.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout: Sidebar + Trades */}
        <div className="results-layout">
          {/* Sidebar */}
          <div className="adv-sidebar">
            <div className="adv-sb-head">
              <span className="adv-sb-title">Trades</span>
              <span className="adv-sb-count">{trades.length} trades</span>
            </div>
            <div className="filter-tabs">
              {(['all', 'BUY', 'SELL', 'loss'] as const).map((f) => (
                <button key={f} className={`ftab${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'loss' ? 'Losses' : f}
                </button>
              ))}
            </div>
            <div className="rpnl-ticker">
              Cumulative: <span style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtExact(totalPnl)}</span>
            </div>
            <div className="adv-trade-list">
              {filteredTrades.map((t) => {
                const idx = t.id - 1
                const pt = getPerTrade(idx)
                return (
                  <div key={t.id} className={`sb-trade-item${selectedTrade === idx ? ' active' : ''}`}
                    onClick={() => { setSelectedTrade(idx); toggleTrade(idx) }}>
                    <div className="sb-trade-left">
                      <span className="sb-trade-num">#{t.id}</span>
                      <span className="sb-trade-time">{t.time}</span>
                      <span className={`side-badge side-${t.side.toLowerCase()}`}>{t.side}</span>
                    </div>
                    <div className="sb-trade-right">
                      <span style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }}>
                        {fmtExact(t.pnl)}
                      </span>
                      {pt && (
                        <span className="tag-pill" style={{ background: TAG_COLORS[pt.tagColor]?.bg, color: TAG_COLORS[pt.tagColor]?.color }}>
                          {pt.label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trade Cards */}
          <div className="trades-list">
            {filteredTrades.map((t, fi) => {
              const idx = t.id - 1
              const pt = getPerTrade(idx)
              const isExpanded = expandedTrades.has(idx)
              const isDeepDive = deepDives.has(idx)
              const isLocked = fi >= FREE_LIMIT

              return (
                <div key={t.id} className={`trade-card${isLocked ? ' trade-locked' : ''}`}>
                  <div className="trade-hd" onClick={() => !isLocked && toggleTrade(idx)}>
                    <div className="trade-hd-left">
                      <span className="trade-num">#{t.id}</span>
                      <span className="trade-time">{t.time}</span>
                      {pt && pt.timeGap > 0 && (
                        <span className={`time-gap-badge tg-${pt.timeGapColor}`}>⏱ {pt.timeGap}m</span>
                      )}
                      {pt && <span className="session-badge">{pt.sessionBadge}</span>}
                      <span className="trade-sym">{t.symbol}</span>
                      <span className={`side-badge side-${t.side.toLowerCase()}`}>{t.side}</span>
                      <span className="trade-qty">&times;{t.qty}</span>
                    </div>
                    <div className="trade-hd-right">
                      <span className="trade-pnl" style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtExact(t.pnl)}
                      </span>
                      {pt && (
                        <span className="tag-pill" style={{ background: TAG_COLORS[pt.tagColor]?.bg, color: TAG_COLORS[pt.tagColor]?.color }}>
                          {pt.label}
                        </span>
                      )}
                      <svg className={`chev${isExpanded ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && !isLocked && pt && (
                    <div className="trade-detail" style={{ display: 'block' }}>
                      <div className="td-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                        <div className="td-cell"><div className="td-label">Entry</div><div className="td-val">₹{t.entry}</div></div>
                        <div className="td-cell"><div className="td-label">Exit</div><div className="td-val">₹{t.exit}</div></div>
                        <div className="td-cell"><div className="td-label">Qty</div><div className="td-val">{t.qty}</div></div>
                        <div className="td-cell"><div className="td-label">Net P&L</div><div className="td-val" style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtExact(t.pnl)}</div></div>
                        <div className="td-cell"><div className="td-label">Cumulative</div><div className="td-val" style={{ color: t.cumPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtExact(t.cumPnl)}</div></div>
                      </div>

                      {t.fills.length > 1 && (
                        <table className="fills-tbl">
                          <thead><tr><th>Fill #</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead>
                          <tbody>
                            {t.fills.map((f, fi2) => (
                              <tr key={fi2}><td>{fi2 + 1}</td><td>{f.qty}</td><td>₹{f.price}</td><td>₹{(f.qty * f.price).toLocaleString('en-IN')}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <div className="quick-summary">{pt.quickSummary}</div>

                      <div className="detail-section ds-psych">
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', marginBottom: 6 }}>🧠 Psychology Coaching</div>
                        {pt.psychologyNote}
                      </div>

                      <button className="deep-dive-btn" onClick={() => toggleDeepDive(idx)}>
                        {isDeepDive ? '▲ Hide Deep Dive' : '▼ Deep Dive'}
                      </button>

                      {isDeepDive && (
                        <>
                          <div className="detail-section ds-ta">
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>📊 Technical Analysis</div>
                            {pt.technicalNote}
                          </div>
                          <div className="detail-section ds-counter">
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>🔄 Counterfactual — What If?</div>
                            {pt.counterfactual}
                          </div>
                        </>
                      )}

                      <div className="ds-note">
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📝 Your Reflection</div>
                        <textarea className="note-input" placeholder="What were you thinking during this trade? Any lessons?" />
                      </div>
                    </div>
                  )}

                  {isLocked && <div className="trade-lock-overlay"><span>🔒</span></div>}
                </div>
              )
            })}

            {trades.length > FREE_LIMIT && (
              <div className="paywall-gate">
                {testMode && (
                  <div className="test-mode-badge">
                    TEST MODE — no real charges
                  </div>
                )}
                <div className="pw-title">Unlock {trades.length - FREE_LIMIT} More Trades</div>
                <div className="pw-sub">Full psychology coaching, technical analysis, counterfactuals, and notes for every trade.</div>
                <div className="pw-prices">
                  <div className="pw-price-card sel">
                    <div className="pw-price-name">Single Report</div>
                    <div className="pw-price-amt">₹99</div>
                    <div className="pw-price-sub">This session only</div>
                  </div>
                  <div className="pw-price-card">
                    <div className="pw-price-name">Pro Monthly</div>
                    <div className="pw-price-amt">₹799</div>
                    <div className="pw-price-sub">Unlimited reports</div>
                  </div>
                  <div className="pw-price-card">
                    <div className="pw-price-name">Pro Yearly</div>
                    <div className="pw-price-amt">₹499/mo</div>
                    <div className="pw-price-sub">Save 38%</div>
                  </div>
                </div>
                {payError && (
                  <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>⚠ {payError}</div>
                )}
                <button
                  className="btn btn-accent btn-lg"
                  disabled={payLoading}
                  onClick={() => {
                    setPayError(null)
                    pay({
                      plan: 'single',
                      onSuccess: () => setUnlocked(true),
                      onError: (err) => setPayError(err),
                    })
                  }}
                >
                  {payLoading ? '⏳ Processing…' : 'Unlock Full Report — ₹99'}
                </button>
                {testMode && (
                  <div className="test-card-hint">
                    Test card: <code>4111 1111 1111 1111</code> | Expiry: any future date | CVV: any 3 digits | OTP: <code>1234</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Financial Impact */}
        {analysis.patterns.length > 0 && (
          <>
            <div className="dash-section-title">💸 What Your Lessons Cost Today</div>
            <div className="mc-card">
              <div className="mc-header">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Learning cost — money lost to emotional decisions</div>
                  <div className="mc-total">{fmtExact(analysis.financialImpact.totalLost)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>If you&apos;d followed your own rules:</div>
                  <div className="mc-saved">{analysis.financialImpact.message}</div>
                </div>
              </div>
              <div className="mc-rows">
                {analysis.patterns.map((p, i) => {
                  const maxCost = Math.max(...analysis.patterns.map((pp) => Math.abs(pp.costInRupees)), 1)
                  const barPct = (Math.abs(p.costInRupees) / maxCost) * 100
                  return (
                    <div key={i} className="mc-row">
                      <span className="mc-row-icon">{p.icon}</span>
                      <span className="mc-row-name">{p.name}</span>
                      <span className="mc-row-count">{p.frequency}</span>
                      <div className="mc-row-bar"><div className="mc-row-fill" style={{ width: `${barPct}%` }} /></div>
                      <span className="mc-row-cost">{fmtExact(p.costInRupees)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Rules for Next Session */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">📋 Rules for Next Session<span className="badge badge-free">FREE</span></div>
          <div className="card-body">
            {analysis.rulesForNextSession.map((rule, i) => (
              <div key={i} className="action-item" style={{ borderLeft: '3px solid var(--accent)' }}>
                <div><strong style={{ color: 'var(--accent)' }}>Rule {i + 1}:</strong> {rule}</div>
              </div>
            ))}
            {analysis.bestCase && (
              <div className="action-item" style={{ borderLeft: '3px solid var(--green)', marginTop: 10 }}>
                <div><strong style={{ color: 'var(--green)' }}>BEST CASE:</strong> {analysis.bestCase}</div>
              </div>
            )}
            {analysis.worstCase && (
              <div className="action-item" style={{ borderLeft: '3px solid var(--red)' }}>
                <div><strong style={{ color: 'var(--red)' }}>WORST CASE:</strong> {analysis.worstCase}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
