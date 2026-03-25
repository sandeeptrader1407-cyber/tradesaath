'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UploadedFile { file: File; name: string; size: string }

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function HomeUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  /* Context questions state */
  const [ctxExpanded, setCtxExpanded] = useState(false)
  const [ctx, setCtx] = useState({
    experience: '', capital: '', mood: '', marketView: '',
    stopLoss: '', strategy: '', plan: '', notes: ''
  })

  function addFiles(newFiles: File[]) {
    const added = newFiles.slice(0, 40 - files.length).map(f => ({
      file: f, name: f.name, size: formatSize(f.size)
    }))
    setFiles(prev => [...prev, ...added])
    setError(null)
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setError(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  function handleAnalyse() {
    // Store files info and context in sessionStorage, then navigate to /upload
    const ctxData = Object.fromEntries(
      Object.entries(ctx).filter(([, v]) => v !== '')
    )
    sessionStorage.setItem('tradesaath_home_context', JSON.stringify(ctxData))

    if (files.length > 0) {
      // We can't transfer File objects via sessionStorage, so navigate to upload
      // and let them re-upload. But we signal that they came from home.
      sessionStorage.setItem('tradesaath_from_home', 'true')
    }

    router.push('/upload')
  }

  return (
    <section id="sec-app" style={{ padding: '40px 0 80px' }}>
      <div className="wrap-narrow">
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              📤 Analyse Your Trades
            </div>
            <span className="badge badge-free">Free · No login</span>
          </div>
          <div className="card-body">

            {/* Auto-detect notice */}
            <div className="autodetect-bar">
              <span className="autodetect-icon">🔍</span>
              <span>Market, exchange &amp; currency will be <strong>auto-detected</strong> from your file</span>
              <span className="autodetect-badge">Awaiting file…</span>
            </div>

            {/* Dropzone */}
            <label
              htmlFor="homeFileInput"
              className="dropzone"
              onDragOver={(e) => { e.currentTarget.classList.add('drag'); e.preventDefault() }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
              onDrop={(e) => { e.currentTarget.classList.remove('drag'); handleDrop(e) }}
            >
              <input
                ref={inputRef}
                type="file"
                id="homeFileInput"
                accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.html,.htm"
                multiple
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }}
              />
              <div className="dz-icon">📂</div>
              <div className="dz-title">Drop files here or click to browse</div>
              <div className="dz-sub">PDF, CSV, Excel, HTML, screenshots — up to 40 files · any broker worldwide</div>
              <div className="dz-tags">
                <span>PDF</span><span>CSV</span><span>XLSX</span><span>XLS</span>
                <span>HTML</span><span>PNG</span><span>JPG</span>
              </div>
            </label>

            {/* File list */}
            {files.length > 0 && (
              <div className="file-list" style={{ marginBottom: 14 }}>
                {files.map((f, i) => (
                  <div key={i} className="file-chip">
                    <span className="chip-name">{f.name}</span>
                    <span className="chip-size">{f.size}</span>
                    <button className="chip-rm" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Trading Context (collapsible) */}
            <div className="ctx-box">
              <button
                className="ctx-toggle-btn"
                onClick={() => setCtxExpanded(!ctxExpanded)}
                style={{ marginBottom: 10 }}
              >
                {ctxExpanded ? '▾' : '▸'} Trading Context
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>optional · makes analysis sharper</span>
              </button>

              {ctxExpanded && (
                <div className="ctx-questions">
                  <div className="ctx-q">
                    <label className="ctx-label">Experience level</label>
                    <select className="ctx-select" value={ctx.experience} onChange={e => setCtx(p => ({ ...p, experience: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="beginner">🌱 Beginner (under 1 year)</option>
                      <option value="intermediate">📈 Intermediate (1–3 years)</option>
                      <option value="experienced">💼 Experienced (3–7 years)</option>
                      <option value="professional">🏆 Professional (7+ years)</option>
                    </select>
                  </div>

                  <div className="ctx-q">
                    <label className="ctx-label">Total trading capital</label>
                    <select className="ctx-select" value={ctx.capital} onChange={e => setCtx(p => ({ ...p, capital: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="micro">Under ₹50,000</option>
                      <option value="small">₹50K – ₹2L</option>
                      <option value="medium">₹2L – ₹10L</option>
                      <option value="large">₹10L – ₹50L</option>
                      <option value="xlarge">Above ₹50L</option>
                    </select>
                  </div>

                  <div className="ctx-q">
                    <label className="ctx-label">Your mood going in</label>
                    <select className="ctx-select" value={ctx.mood} onChange={e => setCtx(p => ({ ...p, mood: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="confident">😤 Confident &amp; focused</option>
                      <option value="neutral">😐 Neutral / calm</option>
                      <option value="anxious">😰 Anxious or stressed</option>
                      <option value="revenge">😡 Frustrated from yesterday</option>
                      <option value="overexcited">🤩 Overexcited / FOMO</option>
                      <option value="tired">😴 Tired or distracted</option>
                    </select>
                  </div>

                  <div className="ctx-q">
                    <label className="ctx-label">Market view that day</label>
                    <select className="ctx-select" value={ctx.marketView} onChange={e => setCtx(p => ({ ...p, marketView: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="bullish">📈 Bullish — expected up move</option>
                      <option value="bearish">📉 Bearish — expected down move</option>
                      <option value="neutral">↔️ Neutral / rangebound</option>
                      <option value="volatile">⚡ Volatile / event / news day</option>
                      <option value="expiry">🗓️ Expiry / settlement day</option>
                      <option value="no_view">❓ No view — reactive trading</option>
                    </select>
                  </div>

                  <div className="ctx-q">
                    <label className="ctx-label">Stop loss rules</label>
                    <select className="ctx-select" value={ctx.stopLoss} onChange={e => setCtx(p => ({ ...p, stopLoss: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="strict">✅ Strict — always set before entry</option>
                      <option value="mental">🧠 Mental SL only, no hard order</option>
                      <option value="moved">⚠️ Set SL but moved or removed it</option>
                      <option value="none">❌ No SL defined</option>
                    </select>
                  </div>

                  <div className="ctx-q">
                    <label className="ctx-label">Strategy intention</label>
                    <select className="ctx-select" value={ctx.strategy} onChange={e => setCtx(p => ({ ...p, strategy: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="breakout">🚀 Breakout / momentum</option>
                      <option value="reversal">🔄 Reversal / mean reversion</option>
                      <option value="trend">🌊 Trend following</option>
                      <option value="scalp">⚡ Scalping / quick trades</option>
                      <option value="swing">📆 Swing / positional</option>
                      <option value="no_strategy">🎲 No defined strategy</option>
                    </select>
                  </div>

                  <div className="ctx-q">
                    <label className="ctx-label">Pre-market plan</label>
                    <select className="ctx-select" value={ctx.plan} onChange={e => setCtx(p => ({ ...p, plan: e.target.value }))}>
                      <option value="">— select —</option>
                      <option value="full">📋 Full plan — clear levels &amp; rules</option>
                      <option value="loose">🗒️ Loose plan, no hard rules</option>
                      <option value="partial">⚠️ Had a plan, abandoned it</option>
                      <option value="none">❌ No plan — traded by feel</option>
                    </select>
                  </div>

                  <div className="ctx-q ctx-q-full">
                    <label className="ctx-label">Special notes</label>
                    <textarea
                      className="ctx-input ctx-textarea"
                      rows={2}
                      value={ctx.notes}
                      onChange={e => setCtx(p => ({ ...p, notes: e.target.value }))}
                      placeholder="e.g. First day trading a new strategy, large event day, had overnight position…"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(240,93,108,.08)', border: '1px solid rgba(240,93,108,.2)', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            {/* Analyse button */}
            <div className="analyse-row">
              <button className="btn btn-accent btn-lg" onClick={handleAnalyse} disabled={loading}>
                🔍 Run Free Analysis
              </button>
              <span className="analyse-note">No login required · runs with demo data if no file</span>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
