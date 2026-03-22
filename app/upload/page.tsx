'use client'

import { useState, useRef, useCallback } from 'react'
import PreviewTable from '@/components/PreviewTable'
import ColumnMapper from '@/components/ColumnMapper'
import BrokerGuide from '@/components/BrokerGuide'
import type { ColumnMapping, DetectionResult } from '@/lib/parsers/types'

const DEMO_TRADES = [
  { id:1, time:'09:18', symbol:'NIFTY 24850 CE', side:'SELL' as const, qty:75, entry:138.2, exit:92.4, pnl:3435, cumPnl:3435, fills:[{qty:50,price:139.0},{qty:25,price:136.6}] },
  { id:2, time:'09:20', symbol:'NIFTY 24950 PE', side:'BUY' as const, qty:75, entry:123.4, exit:165.0, pnl:3120, cumPnl:6555, fills:[{qty:75,price:123.4}] },
  { id:3, time:'10:01', symbol:'NIFTY 25000 PE', side:'BUY' as const, qty:75, entry:118.8, exit:143.7, pnl:1868, cumPnl:8423, fills:[{qty:75,price:118.8}] },
  { id:4, time:'10:36', symbol:'NIFTY 24800 CE', side:'BUY' as const, qty:75, entry:99.7, exit:84.7, pnl:-1125, cumPnl:7298, fills:[{qty:75,price:99.7}] },
  { id:5, time:'12:07', symbol:'NIFTY 24750 CE', side:'BUY' as const, qty:75, entry:82.5, exit:46.2, pnl:-2723, cumPnl:4575, fills:[{qty:75,price:82.5}] },
  { id:6, time:'12:32', symbol:'NIFTY 24650 CE', side:'BUY' as const, qty:150, entry:79.1, exit:18.5, pnl:-9090, cumPnl:-4515, fills:[{qty:75,price:81.2},{qty:75,price:77.0}] },
  { id:7, time:'13:29', symbol:'NIFTY 24650 CE', side:'SELL' as const, qty:75, entry:18.5, exit:16.1, pnl:180, cumPnl:-4335, fills:[{qty:75,price:18.5}] },
  { id:8, time:'13:31', symbol:'NIFTY 24650 CE', side:'BUY' as const, qty:75, entry:22.1, exit:19.3, pnl:-210, cumPnl:-4545, fills:[{qty:75,price:22.1}] },
  { id:9, time:'14:01', symbol:'NIFTY 24600 CE', side:'BUY' as const, qty:75, entry:37.5, exit:62.3, pnl:1860, cumPnl:-2685, fills:[{qty:75,price:37.5}] },
  { id:10,time:'14:33', symbol:'NIFTY 24700 CE', side:'BUY' as const, qty:75, entry:48.6, exit:75.7, pnl:2033, cumPnl:-652, fills:[{qty:75,price:48.6}] },
]

interface UploadedFile {
  file: File
  name: string
  size: string
}

type Phase = 'idle' | 'detecting' | 'preview' | 'mapping' | 'analysing' | 'done'

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [broker, setBroker] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPct, setLoadingPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [confirmedMapping, setConfirmedMapping] = useState<ColumnMapping | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function resetState() {
    setBroker(null)
    setError(null)
    setPhase('idle')
    setDetection(null)
    setConfirmedMapping(null)
    setLoading(false)
    setLoadingPct(0)
  }

  function addFiles(newFiles: File[]) {
    const added = newFiles.slice(0, 40 - files.length).map((f) => ({
      file: f,
      name: f.name,
      size: formatSize(f.size),
    }))
    setFiles((prev) => [...prev, ...added])
    resetState()
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    resetState()
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dt = e.dataTransfer
    if (dt?.files) addFiles(Array.from(dt.files))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  function isImageFile(name: string) {
    return /\.(png|jpg|jpeg|gif|webp)$/i.test(name)
  }

  async function runDetection() {
    setError(null)
    setLoading(true)
    setLoadingPct(10)

    // No file → demo data
    if (files.length === 0) {
      setLoadingPct(50)
      await new Promise((r) => setTimeout(r, 800))
      setLoadingPct(100)
      console.log('📊 TradeSaath — Using DEMO data (no file uploaded)')
      console.table(DEMO_TRADES.map((t) => ({
        '#': t.id, time: t.time, symbol: t.symbol, side: t.side,
        qty: t.qty, entry: t.entry, exit: t.exit, pnl: t.pnl, cumPnl: t.cumPnl,
      })))
      await new Promise((r) => setTimeout(r, 400))
      setLoading(false)
      setLoadingPct(0)
      setBroker('demo')
      setPhase('done')
      return
    }

    // Image file check
    if (isImageFile(files[0].name)) {
      setError('Image parsing is coming soon. For now, please export your trades as CSV or Excel from your broker.')
      setLoading(false)
      setLoadingPct(0)
      return
    }

    // Phase 1: Detect
    setPhase('detecting')
    try {
      setLoadingPct(30)
      const formData = new FormData()
      formData.append('file', files[0].file)
      formData.append('mode', 'detect')

      const res = await fetch('/api/parse', { method: 'POST', body: formData })
      setLoadingPct(70)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to read file')
        setLoading(false)
        setLoadingPct(0)
        setPhase('idle')
        return
      }

      setLoadingPct(100)
      setDetection(data)
      setBroker(data.broker)

      await new Promise((r) => setTimeout(r, 300))
      setLoading(false)
      setLoadingPct(0)

      // High confidence → preview, low → mapping
      if (data.confidence >= 0.7) {
        setConfirmedMapping(data.mapping)
        setPhase('preview')
      } else {
        setPhase('mapping')
      }
    } catch {
      setError('Failed to connect to server')
      setLoading(false)
      setLoadingPct(0)
      setPhase('idle')
    }
  }

  async function runAnalysis() {
    if (!detection || !confirmedMapping) return

    setError(null)
    setLoading(true)
    setLoadingPct(20)
    setPhase('analysing')

    try {
      setLoadingPct(40)
      const formData = new FormData()
      formData.append('file', files[0].file)
      formData.append('mode', 'analyse')
      formData.append('mapping', JSON.stringify(confirmedMapping))
      if (broker) formData.append('broker', broker)

      const res = await fetch('/api/parse', { method: 'POST', body: formData })
      setLoadingPct(80)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Analysis failed')
        setLoading(false)
        setLoadingPct(0)
        setPhase('preview')
        return
      }

      setLoadingPct(100)
      console.log(`📊 TradeSaath — Parsed ${data.trades.length} trades from ${data.broker} (${data.totalFills} fills)`)
      console.table(data.trades.map((t: Record<string, unknown>) => ({
        '#': t.id, time: t.time, symbol: t.symbol, side: t.side,
        qty: t.qty, entry: t.entry, exit: t.exit, pnl: t.pnl, cumPnl: t.cumPnl,
      })))

      await new Promise((r) => setTimeout(r, 400))
      setLoading(false)
      setLoadingPct(0)
      setPhase('done')
    } catch {
      setError('Failed to connect to server')
      setLoading(false)
      setLoadingPct(0)
      setPhase('preview')
    }
  }

  function handleMappingConfirm(mapping: ColumnMapping) {
    setConfirmedMapping(mapping)
    setPhase('preview')
  }

  function handleMappingCancel() {
    resetState()
  }

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
              <span>Columns, broker &amp; format will be <strong>auto-detected</strong> from your file</span>
              <span className={`autodetect-badge${broker ? ' detected' : ''}`}>
                {broker === 'demo' ? 'Demo data' : broker ? `${broker} detected` : 'Awaiting file\u2026'}
              </span>
            </div>

            {/* Dropzone — hide when in mapping/preview/analysing */}
            {phase !== 'mapping' && phase !== 'preview' && phase !== 'analysing' && phase !== 'done' && (
              <>
                <label
                  className="dropzone"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag') }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
                  onDrop={(e) => { e.currentTarget.classList.remove('drag'); handleDrop(e) }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.tsv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                    multiple
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }}
                  />
                  <div className="dz-icon">📂</div>
                  <div className="dz-title">Drop files here or click to browse</div>
                  <div className="dz-sub">CSV, Excel, PDF, screenshots — any broker worldwide</div>
                  <div className="dz-tags">
                    <span>CSV</span><span>TSV</span><span>XLSX</span><span>XLS</span><span>PDF</span><span>PNG</span><span>JPG</span>
                  </div>
                </label>

                <BrokerGuide />
              </>
            )}

            {/* File chips */}
            {files.length > 0 && phase !== 'done' && (
              <div className="file-list">
                {files.map((f, i) => (
                  <div key={i} className="file-chip">
                    <span className="chip-name">{f.name}</span>
                    <span className="chip-size">{f.size}</span>
                    {phase === 'idle' && (
                      <button className="chip-rm" onClick={() => removeFile(i)}>&times;</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {files.length >= 40 && (
              <div style={{ fontSize: 12, color: 'var(--orange)', marginBottom: 10 }}>⚠ Max 40 files reached</div>
            )}

            {/* Column Mapper */}
            {phase === 'mapping' && detection && (
              <ColumnMapper
                headers={detection.headers}
                sampleRow={detection.preview[0] || {}}
                initialMapping={detection.mapping}
                onConfirm={handleMappingConfirm}
                onCancel={handleMappingCancel}
              />
            )}

            {/* Preview Table */}
            {(phase === 'preview' || phase === 'analysing') && detection && confirmedMapping && (
              <PreviewTable
                headers={detection.headers}
                rows={detection.preview}
                mapping={confirmedMapping}
              />
            )}

            {/* Trading context — show in idle and preview phases */}
            {(phase === 'idle' || phase === 'preview') && (
              <div className="ctx-box">
                <div className="ctx-header">
                  <span className="label" style={{ fontSize: 13, fontWeight: 600 }}>Trading Context</span>
                  <span className="ctx-optional">optional &middot; makes analysis sharper</span>
                </div>
                <div className="ctx-questions">
                  <div className="ctx-q">
                    <label className="ctx-label">Experience level</label>
                    <select className="ctx-select">
                      <option value="">— select —</option>
                      <option value="beginner">🌱 Beginner (under 1 year)</option>
                      <option value="intermediate">📈 Intermediate (1–3 years)</option>
                      <option value="experienced">💼 Experienced (3–7 years)</option>
                      <option value="professional">🏆 Professional (7+ years)</option>
                    </select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Total trading capital</label>
                    <select className="ctx-select">
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
                    <select className="ctx-select">
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
                    <select className="ctx-select">
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
                    <select className="ctx-select">
                      <option value="">— select —</option>
                      <option value="strict">✅ Strict — always set before entry</option>
                      <option value="mental">🧠 Mental SL only, no hard order</option>
                      <option value="moved">⚠️ Set SL but moved or removed it</option>
                      <option value="none">❌ No SL defined</option>
                    </select>
                  </div>
                  <div className="ctx-q">
                    <label className="ctx-label">Strategy intention</label>
                    <select className="ctx-select">
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
                    <select className="ctx-select">
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
                      className="ctx-textarea"
                      rows={2}
                      placeholder="e.g. First day trading a new strategy, large event day, had overnight position, trying different position sizing…"
                    />
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

            {/* Action buttons */}
            <div className="analyse-row">
              {phase === 'idle' && (
                <>
                  <button
                    className="btn btn-accent btn-lg"
                    onClick={runDetection}
                    disabled={loading}
                  >
                    {loading ? '⏳ Reading file…' : '🔍 Run Free Analysis'}
                  </button>
                  <span className="analyse-note">
                    No login required &middot; {files.length === 0 ? 'runs with demo data if no file' : `${files.length} file${files.length > 1 ? 's' : ''} ready`}
                  </span>
                </>
              )}

              {phase === 'preview' && (
                <>
                  <button
                    className="btn btn-accent btn-lg"
                    onClick={runAnalysis}
                    disabled={loading}
                  >
                    {loading ? '⏳ Analysing…' : '✅ Looks good — Run Analysis'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPhase('mapping')}
                    disabled={loading}
                  >
                    Fix column mapping
                  </button>
                </>
              )}

              {phase === 'done' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
                    ✅ Analysis complete — check browser console for parsed trades
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => { setFiles([]); resetState() }}
                    style={{ marginTop: 8 }}
                  >
                    Upload another file
                  </button>
                </>
              )}
            </div>

            {/* Loading bar */}
            {loading && (
              <div className="loading-bar">
                <div className="loading-fill" style={{ width: `${loadingPct}%` }} />
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
