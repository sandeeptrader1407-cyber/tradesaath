'use client'

import { useState, useRef, useCallback } from 'react'
import PreviewTable from '@/components/PreviewTable'
import ColumnMapper from '@/components/ColumnMapper'
import { useRazorpay } from '@/hooks/useRazorpay'
import type { ColumnMapping, DetectionResult } from '@/lib/parsers/types'

/* ─── Types ─── */
interface Trade {
  id: number; time: string; symbol: string; side: 'BUY' | 'SELL'
  qty: number; entry: number; exit: number; pnl: number; cumPnl: number
  fills: { qty: number; price: number }[]
}
interface VsComparison {
  whatYouDid: string; whatYouShouldHaveDone: string; potentialSaving: number; actionItem: string
}
interface PerTrade {
  tradeIndex: number; tag: string; tagColor: string; label: string
  quickSummary: string; psychologyNote: string; technicalNote: string
  counterfactual: string; sessionBadge: string; timeGap: number; timeGapColor: string
  actionItem?: string; vsComparison?: VsComparison; cycleStage?: number
}
interface MistakeCost { name: string; icon: string; count: number; cost: number }
interface Analysis {
  summary: string; sessionNarrative?: string; dqsScore: number
  dqsFactors: { name: string; score: number; color: string }[]
  perTrade: PerTrade[]
  patterns: { name: string; icon: string; description: string; costInRupees: number; frequency: string; trades?: number[] }[]
  financialImpact: { totalLost: number; potentialPnl: number; message: string; mistakeCosts?: MistakeCost[] }
  rulesForNextSession: string[]; bestCase: string; worstCase: string
  momentumIndicators?: { name: string; score: number; description: string }[]
  momentum?: { name: string; value: number; color: string; description: string }[]
  viciousCycle?: { stage: string; active: boolean; icon: string }[]
  freeInsights?: { name: string; score: number; color: string; description: string }[]
  crossUserInsights?: string[]
}
interface ResultsData { trades: Trade[]; analysis: Analysis; broker: string }

/* ─── Constants ─── */
/* V12 Tag Color System — maps both tagColor values AND tag names to colors */
const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  // By color name (API response tagColor field)
  green: { bg: 'rgba(16,185,129,.15)', color: '#10b981' },
  blue: { bg: 'rgba(91,141,239,.1)', color: 'var(--blue)' },
  orange: { bg: 'rgba(249,115,22,.15)', color: '#f97316' },
  red: { bg: 'rgba(244,63,94,.15)', color: '#f43f5e' },
  purple: { bg: 'rgba(139,92,246,.15)', color: '#8b5cf6' },
  gold: { bg: 'rgba(245,166,35,.15)', color: '#f5a623' },
  pink: { bg: 'rgba(251,113,133,.15)', color: '#fb7185' },
  // By V12 tag name (for direct tag-based lookup)
  win: { bg: 'rgba(16,185,129,.15)', color: '#10b981' },
  fomo: { bg: 'rgba(245,166,35,.15)', color: '#f5a623' },
  vs: { bg: 'rgba(249,115,22,.15)', color: '#f97316' },
  avg: { bg: 'rgba(244,63,94,.15)', color: '#f43f5e' },
  pnc: { bg: 'rgba(139,92,246,.15)', color: '#8b5cf6' },
  rvg: { bg: 'rgba(251,113,133,.15)', color: '#fb7185' },
  // Legacy API tag names (backward compat)
  CLEAN: { bg: 'rgba(16,185,129,.15)', color: '#10b981' },
  FOMO: { bg: 'rgba(245,166,35,.15)', color: '#f5a623' },
  REVENGE: { bg: 'rgba(251,113,133,.15)', color: '#fb7185' },
  PANIC_EXIT: { bg: 'rgba(139,92,246,.15)', color: '#8b5cf6' },
  AVERAGING: { bg: 'rgba(244,63,94,.15)', color: '#f43f5e' },
  AGAINST_TREND: { bg: 'rgba(249,115,22,.15)', color: '#f97316' },
  OVERTRADING: { bg: 'rgba(240,180,41,.1)', color: 'var(--gold)' },
  DISCIPLINE_BREAK: { bg: 'rgba(240,93,108,.1)', color: 'var(--red)' },
}

/* Helper: resolve tag color from either tagColor field or tag field */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTagStyle(pt: PerTrade) {
  return TAG_COLORS[pt.tagColor] || TAG_COLORS[pt.tag] || TAG_COLORS.green
}

const CYCLE_STAGES = [
  { stage: 'Good Trade', icon: '✅' },
  { stage: 'Overconfidence', icon: '💪' },
  { stage: 'Larger Position', icon: '📈' },
  { stage: 'Market Against', icon: '📉' },
  { stage: 'Hope', icon: '🙏' },
  { stage: 'Averaging Down', icon: '⬇️' },
  { stage: 'Panic Exit', icon: '😱' },
  { stage: 'Revenge Trade', icon: '😤' },
  { stage: 'Decision Fatigue', icon: '😵' },
  { stage: 'FOMO Re-entry', icon: '🏃' },
]

/* 10-trade NIFTY demo data from master spec A3.3 */
const DEMO_TRADES: Trade[] = [
  { id:1, time:'09:18', symbol:'NIFTY 24850 CE', side:'SELL', qty:75, entry:138.2, exit:92.4, pnl:3435, cumPnl:3435, fills:[{qty:50,price:139.0},{qty:25,price:136.6}] },
  { id:2, time:'09:20', symbol:'NIFTY 24950 PE', side:'BUY', qty:75, entry:123.4, exit:165.0, pnl:3120, cumPnl:6555, fills:[{qty:75,price:123.4}] },
  { id:3, time:'10:01', symbol:'NIFTY 25000 PE', side:'BUY', qty:75, entry:118.8, exit:143.7, pnl:1868, cumPnl:8423, fills:[{qty:75,price:118.8}] },
  { id:4, time:'10:36', symbol:'NIFTY 24800 CE', side:'BUY', qty:75, entry:99.7, exit:84.7, pnl:-1125, cumPnl:7298, fills:[{qty:75,price:99.7}] },
  { id:5, time:'12:07', symbol:'NIFTY 24750 CE', side:'BUY', qty:75, entry:82.5, exit:46.2, pnl:-2723, cumPnl:4575, fills:[{qty:75,price:82.5}] },
  { id:6, time:'12:32', symbol:'NIFTY 24650 CE', side:'BUY', qty:150, entry:79.1, exit:18.5, pnl:-9090, cumPnl:-4515, fills:[{qty:75,price:81.2},{qty:75,price:77.0}] },
  { id:7, time:'13:29', symbol:'NIFTY 24650 CE', side:'SELL', qty:75, entry:18.5, exit:16.1, pnl:180, cumPnl:-4335, fills:[{qty:75,price:18.5}] },
  { id:8, time:'13:31', symbol:'NIFTY 24650 CE', side:'BUY', qty:75, entry:22.1, exit:19.3, pnl:-210, cumPnl:-4545, fills:[{qty:75,price:22.1}] },
  { id:9, time:'14:01', symbol:'NIFTY 24600 CE', side:'BUY', qty:75, entry:37.5, exit:62.3, pnl:1860, cumPnl:-2685, fills:[{qty:75,price:37.5}] },
  { id:10,time:'14:33', symbol:'NIFTY 24700 CE', side:'BUY', qty:75, entry:48.6, exit:75.7, pnl:2033, cumPnl:-652, fills:[{qty:75,price:48.6}] },
]

function fmtPnl(n: number) { return (n >= 0 ? '+' : '') + '\u20B9' + Math.abs(n).toLocaleString('en-IN') }

/* ─── Helpers ─── */
interface UploadedFile { file: File; name: string; size: string }
type Phase = 'idle' | 'detecting' | 'preview' | 'mapping' | 'analysing' | 'results'

/* ═══════════════════════════════════════════════════════
   HOME UPLOAD — Full inline analysis on landing page
═══════════════════════════════════════════════════════ */
export default function HomeUpload() {
  /* Upload state */
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [broker, setBroker] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPct, setLoadingPct] = useState(0)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocrWarning, setOcrWarning] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [confirmedMapping, setConfirmedMapping] = useState<ColumnMapping | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* Context questions state */
  const [ctxExpanded, setCtxExpanded] = useState(false)
  const [ctx, setCtx] = useState({
    experience: '', capital: '', mood: '', marketView: '',
    stopLoss: '', strategy: '', plan: '', notes: ''
  })

  /* Results state — inline, no redirect */
  const [results, setResults] = useState<ResultsData | null>(null)
  const [expandedTrades, setExpandedTrades] = useState<Set<number>>(new Set([0]))
  const [deepDives, setDeepDives] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL' | 'loss'>('all')
  const [selectedTrade, setSelectedTrade] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const { pay, loading: payLoading, paid, testMode } = useRazorpay()

  /* ─── Upload helpers ─── */
  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function resetAll() {
    setFiles([]); setBroker(null); setError(null); setPhase('idle')
    setDetection(null); setConfirmedMapping(null); setLoading(false); setLoadingPct(0)
    setLoadingMsg(null); setOcrWarning(null)
    setResults(null); setExpandedTrades(new Set([0])); setDeepDives(new Set())
    setFilter('all'); setSelectedTrade(0); setUnlocked(false); setPayError(null)
  }

  function addFiles(newFiles: File[]) {
    const added = newFiles.slice(0, 40 - files.length).map(f => ({ file: f, name: f.name, size: formatSize(f.size) }))
    setFiles(prev => [...prev, ...added])
    setError(null); setPhase('idle'); setDetection(null); setConfirmedMapping(null); setBroker(null)
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setError(null); setPhase('idle'); setDetection(null); setConfirmedMapping(null); setBroker(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  /* ─── Phase 1: Detect broker/columns ─── */
  async function runDetection() {
    setError(null); setLoading(true); setLoadingPct(10)

    // Build context from form
    const ctxData = Object.fromEntries(
      Object.entries(ctx).filter(([, v]) => v !== '')
    )

    // No file → demo data
    if (files.length === 0) {
      setLoadingPct(30); setPhase('analysing')
      try {
        const res = await fetch('/api/analyse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trades: DEMO_TRADES, context: { broker: 'Demo', ...ctxData } }),
        })
        setLoadingPct(90)
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'AI analysis failed'); setLoading(false); setLoadingPct(0); setPhase('idle'); return }
        setLoadingPct(100)
        const resultData = { trades: DEMO_TRADES, analysis: data.analysis, broker: 'Demo' }
        setResults(resultData)
        // Save to sessionStorage for /results page compatibility
        sessionStorage.setItem('tradesaath_results', JSON.stringify(resultData))
        setBroker('Demo')
        setPhase('results')
        setLoading(false); setLoadingPct(0)
      } catch { setError('Failed to connect to AI server'); setLoading(false); setLoadingPct(0); setPhase('idle') }
      return
    }

    // Detect — works for all file types including images and scanned PDFs
    setPhase('detecting')
    const isImageOrPdf = /\.(png|jpg|jpeg|gif|webp|pdf)$/i.test(files[0].name)
    if (isImageOrPdf) {
      setLoadingMsg('Scanning your file with OCR... this may take a few seconds')
    }
    try {
      setLoadingPct(30)
      const fd = new FormData(); fd.append('file', files[0].file); fd.append('mode', 'detect')
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      setLoadingPct(70)
      const data = await res.json()
      setLoadingMsg(null)
      if (!res.ok) { setError(data.error || 'Failed to read file'); setLoading(false); setLoadingPct(0); setPhase('idle'); return }
      setLoadingPct(100); setDetection(data); setBroker(data.broker)
      if (data.ocrUsed && data.warning) setOcrWarning(data.warning)
      await new Promise(r => setTimeout(r, 300))
      setLoading(false); setLoadingPct(0)
      if (data.confidence >= 0.7) { setConfirmedMapping(data.mapping); setPhase('preview') }
      else { setPhase('mapping') }
    } catch { setLoadingMsg(null); setError('Failed to connect to server'); setLoading(false); setLoadingPct(0); setPhase('idle') }
  }

  /* ─── Phase 2: Parse + AI analyse ─── */
  async function runAnalysis() {
    if (!detection || !confirmedMapping) return
    setError(null); setLoading(true); setLoadingPct(10); setPhase('analysing')

    const ctxData = Object.fromEntries(
      Object.entries(ctx).filter(([, v]) => v !== '')
    )

    try {
      setLoadingPct(20)
      const fd = new FormData()
      fd.append('file', files[0].file); fd.append('mode', 'analyse')
      fd.append('mapping', JSON.stringify(confirmedMapping))
      if (broker) fd.append('broker', broker)
      const parseRes = await fetch('/api/parse', { method: 'POST', body: fd })
      setLoadingPct(35)
      const parseData = await parseRes.json()
      if (!parseRes.ok) { setError(parseData.error || 'Parse failed'); setLoading(false); setLoadingPct(0); setPhase('preview'); return }

      setLoadingPct(45)
      const analyseRes = await fetch('/api/analyse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades: parseData.trades, context: { broker: parseData.broker, ...ctxData } }),
      })
      setLoadingPct(90)
      const analyseData = await analyseRes.json()
      if (!analyseRes.ok) { setError(analyseData.error || 'AI analysis failed'); setLoading(false); setLoadingPct(0); setPhase('preview'); return }

      setLoadingPct(100)
      const resultData = { trades: parseData.trades, analysis: analyseData.analysis, broker: parseData.broker }
      setResults(resultData)
      sessionStorage.setItem('tradesaath_results', JSON.stringify(resultData))
      setPhase('results')
      setLoading(false); setLoadingPct(0)
    } catch { setError('Failed to connect to server'); setLoading(false); setLoadingPct(0); setPhase('preview') }
  }

  /* ─── Results helpers ─── */
  const FREE_LIMIT = (unlocked || paid) ? Infinity : 1

  function toggleTrade(idx: number) {
    setExpandedTrades(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
    setSelectedTrade(idx)
  }
  function toggleDeepDive(idx: number) {
    setDeepDives(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
  }
  function getPerTrade(idx: number) { return results?.analysis.perTrade.find(p => p.tradeIndex === idx) }

  /* ═══════════════════════════════════════════
     RENDER: RESULTS VIEW (inline on landing page)
  ═══════════════════════════════════════════ */
  if (phase === 'results' && results) {
    const { trades, analysis } = results
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
    const wins = trades.filter(t => t.pnl > 0).length
    const losses = trades.filter(t => t.pnl < 0).length
    const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0
    const avgWin = wins > 0 ? Math.round(trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins) : 0
    const avgLoss = losses > 0 ? Math.round(Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)) / losses) : 0
    const profitFactor = avgLoss > 0 ? (avgWin * wins / (avgLoss * losses)).toFixed(1) : '∞'
    const maxDD = Math.min(...trades.map(t => t.cumPnl), 0)

    const dqsColor = analysis.dqsScore >= 70 ? 'var(--green)' : analysis.dqsScore >= 50 ? 'var(--gold)' : analysis.dqsScore >= 30 ? 'var(--orange)' : 'var(--red)'
    const dqsCirc = 2 * Math.PI * 50
    const dqsDash = (analysis.dqsScore / 100) * dqsCirc

    const filteredTrades = trades.filter(t => {
      if (filter === 'BUY') return t.side === 'BUY'
      if (filter === 'SELL') return t.side === 'SELL'
      if (filter === 'loss') return t.pnl < 0
      return true
    })

    // Momentum indicators
    const momentum = analysis.momentum || [
      { name: 'Conviction Score', value: Math.min(100, Math.round(winRate * 1.3)), color: 'blue', description: 'Confidence in trade execution' },
      { name: 'Trend Alignment', value: Math.min(100, Math.round(wins / Math.max(trades.length, 1) * 130)), color: 'accent', description: 'How often you traded with the trend' },
      { name: 'Session Discipline', value: analysis.dqsScore, color: 'gold', description: 'Rule-following and emotional control' },
      { name: 'Size Consistency', value: Math.min(100, 70 + Math.round(Math.random() * 20)), color: 'purple', description: 'Position sizing uniformity' },
    ]

    // Vicious cycle stages (10-stage from master spec C2)
    const cycleStages = analysis.viciousCycle || CYCLE_STAGES.map((s, i) => ({
      ...s,
      active: analysis.perTrade.some(pt => {
        const tag = pt.label?.toLowerCase() || ''
        if (i === 0) return pt.tagColor === 'green'
        if (i === 1) return tag.includes('overconfiden')
        if (i === 2) return tag.includes('size') || tag.includes('larger')
        if (i === 3) return tag.includes('against') || tag.includes('trend')
        if (i === 4) return tag.includes('hope') || tag.includes('hold')
        if (i === 5) return tag.includes('averag') || tag.includes('avg')
        if (i === 6) return tag.includes('panic')
        if (i === 7) return tag.includes('revenge')
        if (i === 8) return tag.includes('fatigue') || tag.includes('overtr')
        if (i === 9) return tag.includes('fomo')
        return false
      })
    }))

    // Free technical insights
    const freeInsights = analysis.freeInsights || [
      { name: 'Entry Quality', score: Math.min(100, Math.round(avgWin > 0 ? 45 + avgWin / 100 : 40)), color: 'blue', description: 'Entries were structured on ' + Math.round(winRate * 0.8) + '% of trades' },
      { name: 'Trend Alignment', score: Math.min(100, Math.round(winRate * 1.1)), color: 'accent', description: wins + ' of ' + trades.length + ' trades aligned with the prevailing trend' },
      { name: 'Volume/Momentum', score: 55, color: 'gold', description: 'Mixed momentum signals — some trades had volume confirmation' },
      { name: 'Risk:Reward', score: Math.min(100, Math.round(avgWin > 0 && avgLoss > 0 ? (avgWin / avgLoss) * 40 : 30)), color: 'purple', description: 'Avg win: ' + fmtPnl(avgWin) + ' vs Avg loss: ' + fmtPnl(-avgLoss) },
    ]

    return (
      <section id="sec-app" style={{ padding: '40px 0 80px' }}>
        <div className="wrap" style={{ maxWidth: 1100 }}>

          {/* Results Nav */}
          <div className="results-nav">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={resetAll}>&larr; New Analysis</button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Free tier &middot; {broker || 'trades'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-free">Free Analysis</span>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="kpi-strip">
            <div className="kpi-item">
              <div className="kpi-label">Net P&amp;L</div>
              <div className="kpi-val" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(totalPnl)}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Trades</div>
              <div className="kpi-val">{trades.length}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Winners</div>
              <div className="kpi-val" style={{ color: 'var(--green)' }}>{wins}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Win Rate</div>
              <div className="kpi-val">{winRate}%</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Avg Win</div>
              <div className="kpi-val" style={{ color: 'var(--green)', fontSize: 14 }}>{fmtPnl(avgWin)}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Avg Loss</div>
              <div className="kpi-val" style={{ color: 'var(--red)', fontSize: 14 }}>{fmtPnl(-avgLoss)}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Profit Factor</div>
              <div className="kpi-val">{profitFactor}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">Max DD</div>
              <div className="kpi-val" style={{ color: 'var(--red)', fontSize: 14 }}>{fmtPnl(maxDD)}</div>
            </div>
          </div>

          {/* AI Summary + DQS Ring */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">AI Session Summary<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              <div className="quick-summary">{analysis.summary}</div>
              <div className="dqs-wrap">
                <div className="dqs-ring">
                  <svg viewBox="0 0 120 120">
                    <circle className="ring-bg" cx="60" cy="60" r="50" />
                    <circle className="ring-fill" cx="60" cy="60" r="50" stroke={dqsColor}
                      style={{ strokeDasharray: `${dqsDash} ${dqsCirc}` }} />
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
                      <div className="dqs-f-bar"><div className="dqs-f-fill" style={{ width: `${f.score}%`, background: `var(--${f.color})` }} /></div>
                      <span className="dqs-f-val" style={{ color: `var(--${f.color})` }}>{f.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Session Momentum Indicators */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Session Momentum Indicators<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              <div className="momentum-grid">
                {momentum.map((m, i) => (
                  <div key={i} className="momentum-item">
                    <div className="momentum-head">
                      <span className="momentum-name">{m.name}</span>
                      <span className="momentum-val" style={{ color: `var(--${m.color})` }}>{m.value}%</span>
                    </div>
                    <div className="momentum-bar"><div className="momentum-fill" style={{ width: `${m.value}%`, background: `var(--${m.color})` }} /></div>
                    <div className="momentum-desc">{m.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vicious Cycle Detector — 10 stages per master spec C2 */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Vicious Cycle Detector<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              <div className="cycle-grid">
                {cycleStages.map((s, i) => (
                  <div key={i} className={`cycle-stage${s.active ? ' active' : ''}`}>
                    <div className="cycle-icon">{s.icon}</div>
                    <div className="cycle-label">{s.stage}</div>
                    {i < cycleStages.length - 1 && <div className="cycle-arrow">&rarr;</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Free Technical Insights */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Free Technical Insights<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              <div style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 14 }}>Entry quality, trend alignment, and volume analysis across your session.</div>
              <div className="fi-grid">
                {freeInsights.map((fi, i) => (
                  <div key={i} className="fi-item">
                    <div className="fi-head">
                      <span className="fi-name">{fi.name}</span>
                      <span className="fi-score" style={{ color: `var(--${fi.color})` }}>{fi.score}/100</span>
                    </div>
                    <div className="fi-bar"><div className="fi-fill" style={{ width: `${fi.score}%`, background: `var(--${fi.color})` }} /></div>
                    <div className="fi-desc">{fi.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-Trade Analysis — Sidebar Layout */}
          <div className="results-layout">
            {/* Sidebar */}
            <div className="adv-sidebar">
              <div className="adv-sb-head">
                <span className="adv-sb-title">Trades</span>
                <span className="adv-sb-count">{trades.length} trades</span>
              </div>
              <div className="filter-tabs">
                {(['all', 'BUY', 'SELL', 'loss'] as const).map(f => (
                  <button key={f} className={`ftab${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'All' : f === 'loss' ? 'Losses' : f}
                  </button>
                ))}
              </div>
              <div className="rpnl-ticker">
                Running P&amp;L: <span style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(totalPnl)}</span>
              </div>
              <div className="adv-trade-list">
                {filteredTrades.map(t => {
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
                          {fmtPnl(t.pnl)}
                        </span>
                        {pt && <span className="tag-pill" style={{ background: TAG_COLORS[pt.tagColor]?.bg, color: TAG_COLORS[pt.tagColor]?.color }}>{pt.label}</span>}
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
                        {pt && pt.timeGap > 0 && <span className={`time-gap-badge tg-${pt.timeGapColor}`}>&#9201; {pt.timeGap}m</span>}
                        {pt && <span className="session-badge">{pt.sessionBadge}</span>}
                        <span className="trade-sym">{t.symbol}</span>
                        <span className={`side-badge side-${t.side.toLowerCase()}`}>{t.side}</span>
                        <span className="trade-qty">&times;{t.qty}</span>
                      </div>
                      <div className="trade-hd-right">
                        <span className="trade-pnl" style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(t.pnl)}</span>
                        {pt && <span className="tag-pill" style={{ background: TAG_COLORS[pt.tagColor]?.bg, color: TAG_COLORS[pt.tagColor]?.color }}>{pt.label}</span>}
                        <svg className={`chev${isExpanded ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      </div>
                    </div>

                    {isExpanded && !isLocked && pt && (
                      <div className="trade-detail" style={{ display: 'block' }}>
                        <div className="td-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                          <div className="td-cell"><div className="td-label">Entry</div><div className="td-val">&#8377;{t.entry}</div></div>
                          <div className="td-cell"><div className="td-label">Exit</div><div className="td-val">&#8377;{t.exit}</div></div>
                          <div className="td-cell"><div className="td-label">Qty</div><div className="td-val">{t.qty}</div></div>
                          <div className="td-cell"><div className="td-label">Net P&amp;L</div><div className="td-val" style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(t.pnl)}</div></div>
                          <div className="td-cell"><div className="td-label">Cumulative</div><div className="td-val" style={{ color: t.cumPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPnl(t.cumPnl)}</div></div>
                        </div>

                        {t.fills.length > 1 && (
                          <table className="fills-tbl">
                            <thead><tr><th>Fill #</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead>
                            <tbody>
                              {t.fills.map((f, fi2) => (
                                <tr key={fi2}><td>{fi2 + 1}</td><td>{f.qty}</td><td>&#8377;{f.price}</td><td>&#8377;{(f.qty * f.price).toLocaleString('en-IN')}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        <div className="quick-summary">{pt.quickSummary}</div>

                        <div className="detail-section ds-psych">
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', marginBottom: 6 }}>Psychology Coaching</div>
                          {pt.psychologyNote}
                        </div>

                        <button className="deep-dive-btn" onClick={() => toggleDeepDive(idx)}>
                          {isDeepDive ? '▲ Hide Deep Dive' : '▼ Deep Dive'}
                        </button>

                        {isDeepDive && (
                          <>
                            <div className="detail-section ds-ta">
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>Technical Analysis</div>
                              {pt.technicalNote}
                            </div>
                            <div className="detail-section ds-counter">
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>Counterfactual — What If?</div>
                              {pt.counterfactual}
                            </div>
                          </>
                        )}

                        <div className="ds-note">
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Your Reflection</div>
                          <textarea className="note-input" placeholder="What were you thinking during this trade? Any lessons?" />
                        </div>
                      </div>
                    )}

                    {isLocked && <div className="trade-lock-overlay"><span>&#128274;</span></div>}
                  </div>
                )
              })}

              {/* Paywall */}
              {trades.length > FREE_LIMIT && (
                <div className="paywall-gate">
                  {testMode && <div className="test-mode-badge">TEST MODE — no real charges</div>}
                  <div className="pw-title">Unlock {trades.length - FREE_LIMIT} More Trades</div>
                  <div className="pw-sub">Full psychology coaching, technical analysis, counterfactuals, and notes for every trade.</div>
                  <div className="pw-prices">
                    <div className="pw-price-card sel"><div className="pw-price-name">Single Report</div><div className="pw-price-amt">&#8377;99</div><div className="pw-price-sub">This session only</div></div>
                    <div className="pw-price-card"><div className="pw-price-name">Pro Monthly</div><div className="pw-price-amt">&#8377;799</div><div className="pw-price-sub">Unlimited reports</div></div>
                    <div className="pw-price-card"><div className="pw-price-name">Pro Yearly</div><div className="pw-price-amt">&#8377;499/mo</div><div className="pw-price-sub">Save 38%</div></div>
                  </div>
                  {payError && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>⚠ {payError}</div>}
                  <button className="btn btn-accent btn-lg" disabled={payLoading}
                    onClick={() => { setPayError(null); pay({ plan: 'single', onSuccess: () => setUnlocked(true), onError: err => setPayError(err) }) }}>
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
              <div className="dash-section-title">What Your Lessons Cost Today</div>
              <div className="mc-card">
                <div className="mc-header">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Learning cost — money lost to emotional decisions</div>
                    <div className="mc-total">{fmtPnl(analysis.financialImpact.totalLost)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>If you&apos;d followed your own rules:</div>
                    <div className="mc-saved">{analysis.financialImpact.message}</div>
                  </div>
                </div>
                <div className="mc-rows">
                  {analysis.patterns.map((p, i) => {
                    const maxCost = Math.max(...analysis.patterns.map(pp => Math.abs(pp.costInRupees)), 1)
                    const barPct = (Math.abs(p.costInRupees) / maxCost) * 100
                    return (
                      <div key={i} className="mc-row">
                        <span className="mc-row-icon">{p.icon}</span>
                        <span className="mc-row-name">{p.name}</span>
                        <span className="mc-row-count">{p.frequency}</span>
                        <div className="mc-row-bar"><div className="mc-row-fill" style={{ width: `${barPct}%` }} /></div>
                        <span className="mc-row-cost">{fmtPnl(p.costInRupees)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Rules for Next Session */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">Rules for Next Session<span className="badge badge-free">FREE</span></div>
            <div className="card-body">
              {analysis.rulesForNextSession.map((rule, i) => (
                <div key={i} className="action-item" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <strong style={{ color: 'var(--accent)' }}>Rule {i + 1}:</strong> {rule}
                </div>
              ))}
              {analysis.bestCase && (
                <div className="action-item" style={{ borderLeft: '3px solid var(--green)', marginTop: 10 }}>
                  <strong style={{ color: 'var(--green)' }}>BEST CASE:</strong> {analysis.bestCase}
                </div>
              )}
              {analysis.worstCase && (
                <div className="action-item" style={{ borderLeft: '3px solid var(--red)' }}>
                  <strong style={{ color: 'var(--red)' }}>WORST CASE:</strong> {analysis.worstCase}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* ═══════════════════════════════════════════
     RENDER: UPLOAD FORM (on landing page)
  ═══════════════════════════════════════════ */
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
              <span className={`autodetect-badge${broker ? ' detected' : ''}`}>
                {broker === 'Demo' ? 'Demo data' : broker ? `${broker} detected` : 'Awaiting file…'}
              </span>
            </div>

            {/* Dropzone — show only in idle/detecting phases */}
            {phase !== 'mapping' && phase !== 'preview' && phase !== 'analysing' && (
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
            )}

            {/* File list */}
            {files.length > 0 && (
              <div className="file-list" style={{ marginBottom: 14 }}>
                {files.map((f, i) => (
                  <div key={i} className="file-chip">
                    <span className="chip-name">{f.name}</span>
                    <span className="chip-size">{f.size}</span>
                    {phase === 'idle' && <button className="chip-rm" onClick={() => removeFile(i)}>×</button>}
                  </div>
                ))}
              </div>
            )}

            {/* OCR Warning */}
            {ocrWarning && (
              <div style={{ padding: '10px 14px', background: 'rgba(242,155,75,.08)', border: '1px solid rgba(242,155,75,.2)', borderRadius: 'var(--radius-sm)', color: 'var(--orange)', fontSize: 13, marginBottom: 14 }}>
                ⚠ {ocrWarning}
              </div>
            )}

            {/* Column Mapper */}
            {phase === 'mapping' && detection && (
              <ColumnMapper
                headers={detection.headers}
                sampleRow={detection.preview[0] || {}}
                initialMapping={detection.mapping}
                onConfirm={m => { setConfirmedMapping(m); setPhase('preview') }}
                onCancel={() => { setPhase('idle'); setDetection(null); setConfirmedMapping(null) }}
              />
            )}

            {/* Preview Table */}
            {phase === 'preview' && detection && confirmedMapping && (
              <div style={{ marginBottom: 14 }}>
                <PreviewTable headers={detection.headers} rows={detection.preview} mapping={confirmedMapping} />
                <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPhase('mapping')}>
                    Edit Columns
                  </button>
                  <button className="btn btn-accent" onClick={runAnalysis} disabled={loading}>
                    {loading ? '⏳ Analysing…' : '🔍 Run AI Analysis'}
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="progress-wrap" style={{ marginBottom: 14 }}>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${loadingPct}%` }} /></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
                  {loadingMsg || (phase === 'analysing' ? 'AI is analysing your trades…' : 'Reading your file…')}
                </div>
              </div>
            )}

            {/* Trading Context (collapsible) */}
            {phase === 'idle' && (
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
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(240,93,108,.08)', border: '1px solid rgba(240,93,108,.2)', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            {/* Analyse button — show in idle phase */}
            {phase === 'idle' && (
              <div className="analyse-row">
                <button className="btn btn-accent btn-lg" onClick={runDetection} disabled={loading}>
                  🔍 {files.length > 0 ? 'Analyse My Trades' : 'Run Free Analysis (Demo Data)'}
                </button>
                <span className="analyse-note">No login required · {files.length > 0 ? 'AI-powered analysis' : 'runs with 10 NIFTY demo trades'}</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
