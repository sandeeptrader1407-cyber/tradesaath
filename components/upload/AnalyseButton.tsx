'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useUploadStore } from '@/lib/uploadStore'
import { useAnalysisStore } from '@/lib/analysisStore'

export default function AnalyseButton() {
  const files = useUploadStore((s) => s.files)
  const context = useUploadStore((s) => s.context)
  const analysisState = useUploadStore((s) => s.analysisState)
  const setAnalysisState = useUploadStore((s) => s.setAnalysisState)
  const setAnalysis = useAnalysisStore((s) => s.setAnalysis)
  const setLoading = useAnalysisStore((s) => s.setLoading)
  const setError = useAnalysisStore((s) => s.setError)
  const barRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)

  const isAnalysing = analysisState === 'uploading' || analysisState === 'analysing'
  const isComplete = analysisState === 'complete'

  useEffect(() => {
    if (!barRef.current) return
    if (isAnalysing) {
      barRef.current.style.width = '0%'
      requestAnimationFrame(() => { if (barRef.current) barRef.current.style.width = '88%' })
    } else if (isComplete) {
      if (barRef.current) barRef.current.style.width = '100%'
    } else {
      barRef.current.style.width = '0%'
    }
  }, [isAnalysing, isComplete])

  const setStatus = (msg: string) => {
    if (statusRef.current) statusRef.current.textContent = msg
  }

  const handleAnalyse = useCallback(async () => {
    if (isAnalysing) return
    setAnalysisState('analysing')
    setLoading(true)

    try {
      // ── DEMO MODE: No files uploaded ──
      if (!files || files.length === 0) {
        setStatus('Loading demo data...')
        const formData = new FormData()
        formData.append('context', JSON.stringify(context))
        const res = await fetch('/api/analyse', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error || 'Demo analysis failed')
          setAnalysisState('error')
          return
        }
        setAnalysis(data)
        setAnalysisState('complete')
        return
      }

      // ── STEP 1: Local Parse (instant, no AI) ──
      setStatus('Parsing your files locally...')
      let allTrades: unknown[] = []
      let broker = 'Unknown'
      let market = 'NSE'
      let tradeDate = ''
      let currency = 'INR'
      let kpis = {}
      let timeAnalysis = {}
      let localParseFailed = false

      for (const file of files) {
        const parseForm = new FormData()
        parseForm.append('file', file)
        try {
          const parseRes = await fetch('/api/parse', { method: 'POST', body: parseForm })
          if (parseRes.ok) {
            const parsed = await parseRes.json()
            if (parsed.trades && parsed.trades.length > 0) {
              allTrades = [...allTrades, ...parsed.trades]
              broker = parsed.broker || broker
              market = parsed.market || market
              tradeDate = parsed.trade_date || tradeDate
              currency = parsed.currency || currency
              kpis = parsed.kpis || kpis
              timeAnalysis = parsed.time_analysis || timeAnalysis
            }
          }
        } catch {
          // Individual file parse failed, continue with others
        }
      }

      // If local parse found no trades, fall back to AI extraction
      if (allTrades.length === 0) {
        localParseFailed = true
        setStatus('Local parse found no trades, trying AI extraction...')
        const formData = new FormData()
        for (const file of files) formData.append('files', file)
        formData.append('context', JSON.stringify(context))
        const res = await fetch('/api/analyse', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error || 'Analysis failed')
          setAnalysisState('error')
          return
        }
        setAnalysis(data)
        setAnalysisState('complete')
        return
      }

      // ── STEP 2: AI Psychology Analysis (with pre-parsed trades) ──
      setStatus('Trades parsed! Running AI psychology analysis...')
      const analyseRes = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trades: allTrades,
          kpis,
          broker,
          market,
          trade_date: tradeDate,
          currency,
          total_trades_in_file: allTrades.length,
          time_analysis: timeAnalysis,
          context,
        }),
      })

      const analyseData = await analyseRes.json()

      // Even if AI fails, we still have local data — show results
      if (analyseData._ai_failed || analyseData._ai_error) {
        console.warn('AI coaching unavailable:', analyseData._ai_error)
      }

      setAnalysis(analyseData)
      setAnalysisState('complete')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setAnalysisState('error')
    }
  }, [files, context, isAnalysing, setAnalysisState, setAnalysis, setLoading, setError])

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleAnalyse}
        disabled={isAnalysing}
        className="px-8 py-3 rounded-xl text-base font-semibold transition-all duration-200"
        style={{
          background: isAnalysing ? 'var(--s3)' : 'var(--accent)',
          color: isAnalysing ? 'var(--muted)' : '#0a0e17',
          cursor: isAnalysing ? 'not-allowed' : 'pointer',
          opacity: isAnalysing ? 0.7 : 1,
          fontFamily: "'Outfit', sans-serif",
          boxShadow: isAnalysing ? 'none' : '0 0 20px rgba(62,232,196,.2)',
        }}
      >
        {isAnalysing ? '⏳ Analysing…' : '🔍 Run Free Analysis'}
      </button>
      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        {isAnalysing
          ? <span ref={statusRef}>Analysing {files.length || 'demo'} file(s)…</span>
          : 'No login required · runs with demo data if no file'}
      </p>
      <div
        className="w-full max-w-sm h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--s3)', opacity: isAnalysing || isComplete ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ background: 'var(--accent)', width: '0%', transition: isAnalysing ? 'width 2.8s cubic-bezier(.4,0,.2,1)' : 'width 0.3s' }}
        />
      </div>
    </div>
  )
}
