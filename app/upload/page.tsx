'use client'

import { useState } from 'react'
import { useAnalysisStore } from '@/lib/analysisStore'
import { useUploadStore } from '@/lib/uploadStore'
import AutoDetectBar from '@/components/upload/AutoDetectBar'
import Dropzone from '@/components/upload/Dropzone'
import FileChips from '@/components/upload/FileChips'
import TradingContext from '@/components/upload/TradingContext'
import AnalyseButton from '@/components/upload/AnalyseButton'
import KPIStrip from '@/components/results/KPIStrip'
import SessionSummary from '@/components/results/SessionSummary'
import MomentumIndicators from '@/components/results/MomentumIndicators'
import ViciousCycle from '@/components/results/ViciousCycle'
import TechnicalInsights from '@/components/results/TechnicalInsights'
import TradeSidebar from '@/components/results/TradeSidebar'
import TradeDetail from '@/components/results/TradeDetail'
import PaywallGate from '@/components/results/PaywallGate'

export default function UploadPage() {
  const analysis = useAnalysisStore((s) => s.analysis)
  const trades = useAnalysisStore((s) => s.trades)
  const error = useAnalysisStore((s) => s.error)
  const resetAnalysis = useAnalysisStore((s) => s.reset)
  const resetUpload = useUploadStore((s) => s.reset)
  const analysisState = useUploadStore((s) => s.analysisState)
  const setAnalysisState = useUploadStore((s) => s.setAnalysisState)
  const [activeTrade, setActiveTrade] = useState(0)
  const FREE_LIMIT = 1
  const showResults = analysis !== null && analysisState === 'complete'

  const handleNewAnalysis = () => {
    resetAnalysis()
    resetUpload()
    setAnalysisState('idle')
    setActiveTrade(0)
  }

  if (showResults) {
    return (
      <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={handleNewAnalysis} className="text-sm px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--text2)', border: '1px solid var(--border)' }}>
                ← New Analysis
              </button>
              <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                Free tier · {trades.length} trades analysed
              </span>
            </div>
            <button className="text-sm px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
              ⬇ Report
            </button>
          </div>
          <KPIStrip />
          <SessionSummary />
          <MomentumIndicators />
          <ViciousCycle />
          <TechnicalInsights />
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-[320px] shrink-0">
              <TradeSidebar activeTrade={activeTrade} onSelectTrade={setActiveTrade} freeLimit={FREE_LIMIT} />
            </div>
            <div className="flex-1 min-w-0">
              <TradeDetail activeTrade={activeTrade} freeLimit={FREE_LIMIT} />
            </div>
          </div>
          {trades.length > FREE_LIMIT && <PaywallGate tradeCount={trades.length} />}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="text-center mb-2">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}>Upload Your Trades</h1>
          <p className="mt-2 text-base" style={{ color: 'var(--text2)' }}>Drop your broker files and get AI-powered psychological analysis in seconds</p>
        </div>
        <AutoDetectBar />
        <div className="rounded-xl border p-6 flex flex-col gap-5" style={{ background: 'var(--s1)', borderColor: 'var(--border)' }}>
          <Dropzone />
          <FileChips />
        </div>
        <TradingContext />
        <AnalyseButton />
        {error && (
          <div className="text-center text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(240,93,108,.1)', color: 'var(--red)', border: '1px solid rgba(240,93,108,.2)' }}>
            {error}
          </div>
        )}
      </div>
    </main>
  )
}