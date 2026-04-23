"use client"

import { useState, useEffect, useRef } from "react"
import { useAnalysisStore } from "@/lib/analysisStore"
import { useUploadStore } from "@/lib/uploadStore"
import { usePlanStore } from "@/lib/planStore"
import AutoDetectBar from "@/components/upload/AutoDetectBar"
import Dropzone from "@/components/upload/Dropzone"
import FileChips from "@/components/upload/FileChips"
import TradingContext from "@/components/upload/TradingContext"
import AnalyseButton from "@/components/upload/AnalyseButton"
import KPIStrip from "@/components/results/KPIStrip"
import SessionSummary from "@/components/results/SessionSummary"
import MomentumIndicators from "@/components/results/MomentumIndicators"
import ViciousCycle from "@/components/results/ViciousCycle"
import TechnicalInsights from "@/components/results/TechnicalInsights"
import TradeSidebar from "@/components/results/TradeSidebar"
import TradeDetail from "@/components/results/TradeDetail"
import PaywallGate from "@/components/results/PaywallGate"
import EquityCurve from "@/components/results/EquityCurve"
import BatchAnalysisRunner from "@/components/BatchAnalysisRunner"
import Toaster from "@/components/ui/Toast"
import ErrorBoundary from "@/components/ui/ErrorBoundary"

const BROKER_LINKS = [
  { name: 'Zerodha',    url: 'https://kite.zerodha.com/portfolio/holdings' },
  { name: 'Fyers',      url: 'https://trade.fyers.in/reports' },
  { name: 'Upstox',    url: 'https://upstox.com/reports' },
  { name: 'Angel One',  url: 'https://www.angelone.in/reports' },
  { name: 'Groww',     url: 'https://groww.in/reports' },
  { name: '5Paisa',    url: 'https://www.5paisa.com/reports' },
]

export default function UploadPage() {
  const analysis = useAnalysisStore((s) => s.analysis)
  const trades = useAnalysisStore((s) => s.trades)
  const error = useAnalysisStore((s) => s.error)
  const resetAnalysis = useAnalysisStore((s) => s.reset)
  const resetUpload = useUploadStore((s) => s.reset)
  const analysisState = useUploadStore((s) => s.analysisState)
  const setAnalysisState = useUploadStore((s) => s.setAnalysisState)
  const [activeTrade, setActiveTrade] = useState(0)
  const tradeLimit = usePlanStore((s) => s.tradeLimit)
  const FREE_LIMIT = tradeLimit()

  // First-time user banner — hidden once the user dismisses it via localStorage
  const [showBanner, setShowBanner] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem('ts-upload-banner-dismissed') !== 'true') {
        setShowBanner(true)
      }
    } catch { /* ignore private-browsing errors */ }
  }, [])

  function dismissBanner() {
    try { localStorage.setItem('ts-upload-banner-dismissed', 'true') } catch { /* ignore */ }
    setShowBanner(false)
  }

  const showResults = trades.length > 0 && (analysisState === "parsed" || analysisState === "ai_running" || analysisState === "complete")
  const aiDone = analysisState === "complete" && analysis !== null
  const aiRunning = analysisState === "ai_running" || analysisState === "parsed"

  const handleNewAnalysis = () => {
    resetAnalysis()
    resetUpload()
    setAnalysisState("idle")
    setActiveTrade(0)
  }

  // On mount: clear stale state from previous completed/errored analysis
  // so navigating to /upload always shows a fresh upload form.
  // Do NOT reset if user is mid-analysis (uploading, analysing, parsed, ai_running).
  const hasResetOnMount = useRef(false)
  useEffect(() => {
    if (hasResetOnMount.current) return
    hasResetOnMount.current = true
    const state = useUploadStore.getState().analysisState
    if (state === 'complete' || state === 'error') {
      resetAnalysis()
      resetUpload()
    }
  }, [resetAnalysis, resetUpload])

  if (showResults) {
    const planLabel = (() => {
      const p = usePlanStore.getState().plan
      if (p === 'pro_monthly') return 'Pro Monthly'
      if (p === 'pro_yearly') return 'Pro Yearly'
      if (p === 'single') return 'Starter'
      return 'Free tier'
    })()

    return (
      <main className="min-h-screen pt-20 pb-16 px-4" style={{ background: "var(--bg)" }}>
        <Toaster />
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <button onClick={handleNewAnalysis} className="text-sm px-3 py-1.5 rounded-lg transition-colors" style={{ color: "var(--text2)", border: "1px solid var(--border)" }}>{"←"} New Analysis</button>
              <span className="text-xs" style={{ color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}>{planLabel} {"·"} {trades.length} trades analysed</span>
            </div>
            <button className="text-sm px-3 py-1.5 rounded-lg transition-colors shrink-0" style={{ color: "var(--muted)", border: "1px solid var(--border)" }}>{"⬇"} Report</button>
          </div>

          {/* AI Status Banner */}
          {aiRunning && (
            <div className="rounded-xl p-4 border flex items-start sm:items-center gap-3" style={{ background: "linear-gradient(135deg, rgba(62,232,196,.06) 0%, var(--s1) 100%)", borderColor: "var(--accent)" }}>
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5 sm:mt-0" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}></div>
              <div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>AI analysis running in background...</span>
                <span className="text-xs block sm:inline sm:ml-2" style={{ color: "var(--text2)" }}>Dashboard will update automatically when ready</span>
              </div>
            </div>
          )}

          {/* Background batch-analysis for any other sessions on this account */}
          {aiDone && (
            <ErrorBoundary name="BatchAnalysisRunner">
              <BatchAnalysisRunner autoStart />
            </ErrorBoundary>
          )}

          {/* KPIs (always shown after parse) */}
          <ErrorBoundary name="KPIStrip"><KPIStrip /></ErrorBoundary>

          {/* Equity Curve (always shown after parse) */}
          <ErrorBoundary name="EquityCurve"><EquityCurve /></ErrorBoundary>

          {/* AI sections (only when AI is done) */}
          {aiDone && <ErrorBoundary name="SessionSummary"><SessionSummary /></ErrorBoundary>}
          {aiDone && <ErrorBoundary name="MomentumIndicators"><MomentumIndicators /></ErrorBoundary>}
          {aiDone && <ErrorBoundary name="ViciousCycle"><ViciousCycle /></ErrorBoundary>}
          {aiDone && <ErrorBoundary name="TechnicalInsights"><TechnicalInsights /></ErrorBoundary>}

          {/* Per-Trade Section Header */}
          <ErrorBoundary name="TradeAnalysis">
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>Per-Trade Analysis</h2>
              <span className="text-[10px] px-3 py-1 rounded-full font-bold" style={{ background: "rgba(62,232,196,.12)", color: "var(--accent)" }}>First 3 FREE</span>
            </div>
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-[320px] shrink-0">
                <TradeSidebar activeTrade={activeTrade} onSelectTrade={setActiveTrade} freeLimit={FREE_LIMIT} />
              </div>
              <div className="flex-1 min-w-0 p-4">
                <TradeDetail activeTrade={activeTrade} freeLimit={FREE_LIMIT} />
              </div>
            </div>
          </div>
          </ErrorBoundary>

          {trades.length > FREE_LIMIT && <PaywallGate tradeCount={trades.length} />}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4" style={{ background: "var(--bg)" }}>
      <Toaster />
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {showBanner && (
          <div style={{
            borderRadius: 10,
            background: 'var(--upload-banner-bg, rgba(15,76,129,.06))',
            borderBottom: '0.5px solid var(--upload-banner-border, rgba(133,183,235,.7))',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
                New to TradeSaath? Here is how to get your broker statement:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 0' }}>
                {BROKER_LINKS.map((b, i) => (
                  <span key={b.name}>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      {b.name}
                    </a>
                    {i < BROKER_LINKS.length - 1 && (
                      <span style={{ color: 'var(--border)', margin: '0 6px' }}>&middot;</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={dismissBanner}
              style={{
                fontSize: 18,
                lineHeight: 1,
                color: 'var(--muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                padding: '0 2px',
              }}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        <div className="text-center mb-2">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: "var(--text)" }}>Analyse Your Trades<span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, backgroundColor: 'rgba(62,232,196,0.1)', color: '#3ee8c4', border: '1px solid rgba(62,232,196,0.2)', marginLeft: 8, fontFamily: 'monospace', letterSpacing: 1, verticalAlign: 'middle' }}>FREE</span></h1>
          <p className="mt-2 text-base" style={{ color: "var(--text2)" }}>Drop your broker files and get AI-powered psychological analysis in seconds</p>
        </div>
        <AutoDetectBar />
        <div className="rounded-xl border p-6 flex flex-col gap-5" style={{ background: "var(--s1)", borderColor: "var(--border)" }}>
          <Dropzone />
          <FileChips />
        </div>
        <TradingContext />
        <AnalyseButton />
        {error && (
          <div className="text-center text-sm px-4 py-3 rounded-lg" style={{ background: "rgba(240,93,108,.1)", color: "var(--red)", border: "1px solid rgba(240,93,108,.2)" }}>{error}</div>
        )}
      </div>
    </main>
  )
}
