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

  const handleAnalyse = useCallback(async () => {
    if (isAnalysing) return
    setAnalysisState('analysing')
    setLoading(true)
    try {
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
          ? `Analysing ${files.length || 'demo'} file(s)…`
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
