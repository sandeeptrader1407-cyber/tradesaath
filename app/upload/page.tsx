'use client'

import { useState, useRef, useCallback } from 'react'

/* ─── Types ─── */
interface Trade {
  index: number; time: string; symbol: string; side: string
  qty: number; entry: number; exit: number; pnl: number
  tag: string; label: string; quick_summary: string
  psychology_coaching?: string; technical_analysis?: string
}
interface Momentum { name: string; score: number; color: string; desc: string }
interface CycleStage { stage: string; count: number; icon: string; desc: string }
interface TechInsight { name: string; score: number; color: string; desc: string }
interface KPIs {
  net_pnl: number; total_trades: number; wins: number; losses: number
  win_rate: number; profit_factor: number; best_trade_pnl: number; worst_trade_pnl: number
}
interface AnalysisResult {
  broker: string; market: string; trade_date: string; currency: string
  kpis: KPIs; summary: string; momentum: Momentum[]
  vicious_cycle: CycleStage[]; technical_insights: TechInsight[]
  trades: Trade[]
}

function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(Math.round(n)).toLocaleString('en-IN')
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  win: { bg: 'rgba(54,211,153,.12)', color: 'var(--green)' },
  fomo: { bg: 'rgba(240,180,41,.12)', color: 'var(--gold)' },
  revenge: { bg: 'rgba(240,93,108,.12)', color: 'var(--red)' },
  averaging: { bg: 'rgba(240,93,108,.12)', color: 'var(--red)' },
  panic: { bg: 'rgba(157,122,247,.12)', color: 'var(--purple)' },
  against_trend: { bg: 'rgba(242,155,75,.12)', color: 'var(--orange)' },
  hope_hold: { bg: 'rgba(240,93,108,.12)', color: 'var(--red)' },
  decision_fatigue: { bg: 'rgba(150,150,150,.12)', color: 'var(--muted)' },
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPct, setLoadingPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [expandedTrade, setExpandedTrade] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function reset() {
    setFile(null); setLoading(false); setLoadingPct(0)
    setError(null); setResult(null); setExpandedTrade(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f) { setFile(f); setError(null) }
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError(null) }
    e.target.value = ''
  }

  /* ─── Collect context from selects ─── */
  function getContext() {
    const ctx: Record<string, string> = {}
    document.querySelectorAll<HTMLSelectElement>('.ctx-select').forEach(sel => {
      if (sel.value) {
        const label = sel.closest('.ctx-q')?.querySelector('.ctx-label')?.textContent || ''
        ctx[label] = sel.value
      }
    })
    const notes = document.querySelector<HTMLTextAreaElement>('.ctx-textarea')?.value
    if (notes) ctx['Special notes'] = notes
    return ctx
  }

  /* ─── Run Analysis ─── */
  async function runAnalysis() {
    if (!file) { setError('Please select a file first'); return }
    setError(null); setLoading(true); setLoadingPct(5)

    const progressTimer = setInterval(() => {
      setLoadingPct(prev => Math.min(prev + 2, 90))
    }, 1500)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('context', JSON.stringify(getContext()))

      const res = await fetch('/api/analyse', { method: 'POST', body: fd })
      clearInterval(progressTimer)
      setLoadingPct(95)

      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Analysis failed')
        setLoading(false); setLoadingPct(0)
        return
      }

      setLoadingPct(100)
      setResult(data)
      setLoading(false); setLoadingPct(0)

      // Save to session storage for results page
      sessionStorage.setItem('tradesaath_results', JSON.stringify(data))

      // Save to Supabase (non-blocking)
      try {
        fetch('/api/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trades: data.trades, analysis: data, broker: data.broker }),
        }).catch(() => {})
      } catch { /* ignore */ }

    } catch {
      clearInterval(progressTimer)
      setError('Failed to connect to server. Please try again.')
      setLoading(false); setLoadingPct(0)
    }
  }

  /* ═══════════════════════════════════════════
     RESULTS VIEW
  ═══════════════════════════════════════════ */
  if (result) {
    const { kpis, trades, momentum, vicious_cycle, technical_insights } = result
    const ts = TAG_STYLES

    return (
      <section style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1100 }}>

          {/* Nav */}
          <div className="results-nav">
            <button className="btn btn-ghost btn-sm" onClick={reset}>&larr; New Analysis</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Free tier &middot; {result.broker} &middot; {result.market}</span>
          </div>

          {/* KPI Strip */}
          <div className="kpi-strip">
            {[
              { label: 'Net P&L', val: fmtPnl(kpis.net_pnl), color: kpis.net_pnl >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Trades', val: String(kpis.total_trades), color: 'var(--text)' },
              { label: 'Winners', val: String(kpis.wins), color: 'var(--green)' },
              { label: 'Losers', val: String(kpis.losses), color: 'var(--red)' },
              { label: 'Win Rate', val: kpis.win_rate + '%', color: kpis.win_rate >= 50 ? 'var(--green)' : 'var(--red)' },
              { label: 'Profit Factor', val: String(kpis.profit_factor || '—'), color: 'var(--text)' },
              { label: 'Best Trade', val: fmtPnl(kpis.best_trade_pnl), color: 'var(--green)' },
              { label: 'Worst Trade', val: fmtPnl(kpis.worst_trade_pnl), color: 'var(--red)' },
            ].map((k, i) => (
              <div key={i} className="kpi-item">
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">AI Session Summary<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {result.summary}
              </div>
            </div>
          </div>

          {/* Momentum Indicators */}
          {momentum && momentum.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Session Momentum<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div className="momentum-grid">
                  {momentum.map((m, i) => (
                    <div key={i} className="momentum-item">
                      <div className="momentum-head">
                        <span className="momentum-name">{m.name}</span>
                        <span className="momentum-val" style={{ color: `var(--${m.color})` }}>{m.score}%</span>
                      </div>
                      <div className="momentum-bar"><div className="momentum-fill" style={{ width: `${m.score}%`, background: `var(--${m.color})` }} /></div>
                      <div className="momentum-desc">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Vicious Cycle */}
          {vicious_cycle && vicious_cycle.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Vicious Cycle Detector<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div className="cycle-grid">
                  {vicious_cycle.map((s, i) => (
                    <div key={i} className={`cycle-stage${s.count > 0 ? ' active' : ''}`}>
                      <div className="cycle-icon">{s.icon}</div>
                      <div className="cycle-label">{s.stage}</div>
                      {s.count > 0 && <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>{s.count}x</div>}
                      {s.count > 0 && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Technical Insights */}
          {technical_insights && technical_insights.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">Free Technical Insights<span className="badge badge-free">FREE</span></div>
              <div className="card-body">
                <div className="fi-grid">
                  {technical_insights.map((ti, i) => (
                    <div key={i} className="fi-item">
                      <div className="fi-head">
                        <span className="fi-name">{ti.name}</span>
                        <span className="fi-score" style={{ color: `var(--${ti.color})` }}>{ti.score}/100</span>
                      </div>
                      <div className="fi-bar"><div className="fi-fill" style={{ width: `${ti.score}%`, background: `var(--${ti.color})` }} /></div>
                      <div className="fi-desc">{ti.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trade List */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Per-Trade Analysis<span className="badge badge-free">FREE</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              {trades.map((t, i) => {
                const isExpanded = expandedTrade === i
                const isLocked = i > 0
                const tagStyle = ts[t.tag] || { bg: 'rgba(150,150,150,.12)', color: 'var(--muted)' }

                return (
                  <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Trade header — always visible */}
                    <div onClick={() => !isLocked && setExpandedTrade(isExpanded ? -1 : i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                        cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.5 : 1,
                      }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted)', width: 28 }}>#{i + 1}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', width: 40 }}>{t.time}</span>
                      <span style={{ fontWeight: 700, flex: 1, fontSize: 13 }}>{t.symbol}</span>
                      <span className={`side-badge side-${t.side.toLowerCase()}`} style={{ fontSize: 9 }}>{t.side}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>&times;{t.qty}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)', width: 80, textAlign: 'right' }}>
                        {fmtPnl(t.pnl)}
                      </span>
                      <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: tagStyle.bg, color: tagStyle.color }}>
                        {t.label}
                      </span>
                      {isLocked && <span style={{ fontSize: 12 }}>🔒</span>}
                    </div>

                    {/* Expanded detail — only for unlocked trades */}
                    {isExpanded && !isLocked && (
                      <div style={{ padding: '0 16px 16px 54px' }}>
                        {/* Entry/Exit grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                          {[
                            { label: 'Entry', val: '\u20B9' + t.entry },
                            { label: 'Exit', val: '\u20B9' + t.exit },
                            { label: 'Qty', val: String(t.qty) },
                            { label: 'P&L', val: fmtPnl(t.pnl), color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' },
                          ].map((c, ci) => (
                            <div key={ci} style={{ padding: '8px 12px', background: 'var(--s2)', borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{c.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: c.color || 'var(--text)' }}>{c.val}</div>
                            </div>
                          ))}
                        </div>

                        {/* Quick summary */}
                        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>
                          {t.quick_summary}
                        </div>

                        {/* Psychology coaching */}
                        {t.psychology_coaching && (
                          <div style={{ padding: '12px 14px', borderLeft: '3px solid var(--purple)', background: 'rgba(157,122,247,.04)', borderRadius: '0 8px 8px 0', marginBottom: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', marginBottom: 4 }}>Psychology Coaching</div>
                            {t.psychology_coaching}
                          </div>
                        )}

                        {/* Technical analysis */}
                        {t.technical_analysis && (
                          <div style={{ padding: '12px 14px', borderLeft: '3px solid var(--blue)', background: 'rgba(91,141,239,.04)', borderRadius: '0 8px 8px 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>Technical Analysis</div>
                            {t.technical_analysis}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Paywall */}
              {trades.length > 1 && (
                <div style={{ padding: '24px 20px', textAlign: 'center', background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Unlock {trades.length - 1} More Trades</div>
                  <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 14 }}>Full psychology coaching, technical analysis for every trade.</div>
                  <button className="btn btn-accent">Upgrade to Pro — ₹99</button>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>
    )
  }

  /* ═══════════════════════════════════════════
     UPLOAD FORM
  ═══════════════════════════════════════════ */
  return (
    <section id="sec-app">
      <div className="wrap-narrow" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              📤 Analyse Your Trades
            </div>
            <span className="badge badge-free">Free &middot; No login</span>
          </div>
          <div className="card-body">

            {/* Auto-detect bar */}
            <div className="autodetect-bar">
              <span className="autodetect-icon">🔍</span>
              <span>Market, exchange &amp; currency will be <strong>auto-detected</strong> from your file</span>
              <span className={`autodetect-badge${file ? ' detected' : ''}`}>
                {file ? 'File ready' : 'Awaiting file\u2026'}
              </span>
            </div>

            {/* Dropzone */}
            {!loading && (
              <label className="dropzone"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag') }}
                onDragLeave={e => e.currentTarget.classList.remove('drag')}
                onDrop={e => { e.currentTarget.classList.remove('drag'); handleDrop(e) }}>
                <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" multiple={false}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  onChange={handleFileSelect} />
                <div className="dz-icon">📂</div>
                <div className="dz-title">Drop files here or click to browse</div>
                <div className="dz-sub">PDF, CSV, Excel, screenshots — any broker worldwide</div>
                <div className="dz-tags"><span>PDF</span><span>CSV</span><span>XLSX</span><span>XLS</span><span>PNG</span><span>JPG</span><span>JPEG</span></div>
              </label>
            )}

            {/* File chip */}
            {file && !loading && (
              <div className="file-list">
                <div className="file-chip">
                  <span className="chip-name">{file.name}</span>
                  <span className="chip-size">{formatSize(file.size)}</span>
                  <button className="chip-rm" onClick={() => setFile(null)}>&times;</button>
                </div>
              </div>
            )}

            {/* Trading Context */}
            {!loading && (
              <div className="ctx-box">
                <div className="ctx-header">
                  <span className="label" style={{ fontSize: 13, fontWeight: 600 }}>Trading Context</span>
                  <span className="ctx-optional">optional &middot; makes analysis sharper</span>
                </div>
                <div className="ctx-questions">
                  <div className="ctx-q">
                    <label className="ctx-label">Experience level</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="experienced">Experienced</option><option value="professional">Professional</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Total trading capital</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="micro">Under ₹50K</option><option value="small">₹50K–₹2L</option><option value="medium">₹2L–₹10L</option><option value="large">₹10L–₹50L</option><option value="xlarge">Above ₹50L</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Your mood going in</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="confident">Confident</option><option value="neutral">Neutral</option><option value="anxious">Anxious</option><option value="revenge">Revenge</option><option value="overexcited">Overexcited</option><option value="tired">Tired</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Market view that day</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="bullish">Bullish</option><option value="bearish">Bearish</option><option value="neutral">Neutral</option><option value="volatile">Volatile</option><option value="expiry">Expiry</option><option value="no_view">No view</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Stop loss rules</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="strict">Strict</option><option value="mental">Mental</option><option value="moved">Moved</option><option value="none">None</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Strategy intention</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="breakout">Breakout</option><option value="reversal">Reversal</option><option value="trend">Trend</option><option value="scalp">Scalp</option><option value="swing">Swing</option><option value="no_strategy">No strategy</option></select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Pre-market plan</label>
                    <select className="ctx-select"><option value="">— select —</option><option value="full">Full plan</option><option value="loose">Loose plan</option><option value="abandoned">Abandoned</option><option value="none">No plan</option></select>
                  </div>
                  <div className="ctx-q ctx-q-full">
                    <label className="ctx-label">Special notes</label>
                    <textarea className="ctx-textarea" rows={2} placeholder="e.g. First day trading new strategy, expiry day, etc." />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10, padding: '8px 12px', background: 'rgba(244,63,94,.08)', borderRadius: 8, border: '1px solid rgba(244,63,94,.2)' }}>
                ⚠ {error}
              </div>
            )}

            {/* Analyse button */}
            {!loading && (
              <div className="analyse-row">
                <button className="btn btn-accent btn-lg" onClick={runAnalysis} disabled={!file}>
                  🔍 Analyse My Trades
                </button>
                <span className="analyse-note">
                  No login required &middot; {file ? '1 file ready' : 'select a file to start'}
                </span>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
                  ⏳ AI is reading your file and analysing trades...
                </div>
                <div className="loading-bar"><div className="loading-fill" style={{ width: `${loadingPct}%` }} /></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  This takes 20-60 seconds. Do not close this tab.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
