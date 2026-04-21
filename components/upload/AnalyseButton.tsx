"use client"

import { useCallback, useRef, useEffect } from "react"
import { useUploadStore } from "@/lib/uploadStore"
import { useAnalysisStore } from "@/lib/analysisStore"
import { showToast } from "@/components/ui/Toast"

/* User-friendly error messages */
function friendlyError(raw: string, code?: string): string {
  if (code === 'TIMEOUT' || /timed?\s*out|timeout/i.test(raw))
    return "Analysis is taking longer than expected. This can happen with large files. Please try again or upload a smaller file."
  if (code === 'RATE_LIMIT' || /rate.?limit|429/i.test(raw))
    return "Our AI is experiencing high demand. Please try again in a few minutes."
  if (code === 'OVERLOADED' || /overload|529|busy/i.test(raw))
    return "Our AI is experiencing high demand. Please try again in a few minutes."
  if (/api.?key|auth|401|403/i.test(raw))
    return "Analysis service temporarily unavailable. Please try again later."
  if (/network|fetch|ERR_/i.test(raw))
    return "Network error. Please check your internet connection and try again."
  if (/no trades found|0 trades/i.test(raw))
    return "No trades found in this file. Please check the file format or try a different file."
  if (/parse|extract|format/i.test(raw))
    return "Could not read trades from this file. Please check the file format or try a different file."
  return "Analysis failed. Please try again."
}

export default function AnalyseButton() {
  const files = useUploadStore((s) => s.files)
  const context = useUploadStore((s) => s.context)
  const detectedBrokerFromStore = useUploadStore((s) => s.detectedBroker)
  const setDetectedBroker = useUploadStore((s) => s.setDetectedBroker)
  const analysisState = useUploadStore((s) => s.analysisState)
  const setAnalysisState = useUploadStore((s) => s.setAnalysisState)
  const setAnalysis = useAnalysisStore((s) => s.setAnalysis)
  const setLoading = useAnalysisStore((s) => s.setLoading)
  const setError = useAnalysisStore((s) => s.setError)
  const barRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)

  const isAnalysing = analysisState === "uploading" || analysisState === "analysing" || analysisState === "ai_running"
  const noFiles = !files || files.length === 0

  useEffect(() => {
    if (!barRef.current) return
    if (analysisState === "analysing") {
      barRef.current.style.width = "0%"
      requestAnimationFrame(() => { if (barRef.current) barRef.current.style.width = "45%" })
    } else if (analysisState === "ai_running") {
      if (barRef.current) barRef.current.style.width = "88%"
    } else if (analysisState === "parsed" || analysisState === "complete") {
      if (barRef.current) barRef.current.style.width = "100%"
    } else {
      barRef.current.style.width = "0%"
    }
  }, [analysisState])

  const setStatus = (msg: string) => {
    if (statusRef.current) statusRef.current.textContent = msg
  }

  const runAIAnalysis = async (allTrades: unknown[], broker: string, market: string, tradeDate: string, currency: string, fileHash?: string, fileSizeBytes?: number, rawFileId?: string) => {
    setAnalysisState("ai_running")
    setStatus("Running AI psychology analysis...")
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: allTrades,
          broker,
          market,
          trade_date: tradeDate,
          currency,
          total_trades_in_file: allTrades.length,
          context,
          file_hash: fileHash || undefined,
          file_size_bytes: fileSizeBytes || undefined,
          raw_file_id: rawFileId || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        friendlyError(data.error || data.details || `HTTP ${res.status}`, data.code)
        console.warn("AI analysis HTTP error:", res.status, data)
        showToast.warning("AI analysis unavailable \u2014 showing parsed trades only. You can retry later.")
        setAnalysisState("complete")
        return
      }

      const data = await res.json()
      if (data._ai_failed || data._ai_error) {
        console.warn("AI coaching unavailable:", data._ai_error)
        showToast.info("AI coaching is processing. Showing your parsed trades for now.")
      }
      // Show dedup stats if trades were skipped during save
      if (data.tradesSkipped && data.tradesSkipped > 0) {
        const mergeNote = data.sessionsMerged > 0 ? ` Merged into ${data.sessionsMerged} existing session(s).` : ""
        showToast.info(`Added ${data.tradesAdded || 0} new trades. Skipped ${data.tradesSkipped} duplicates.${mergeNote}`)
      }
      setAnalysis(data)
      setAnalysisState("complete")
    } catch (err) {
      console.warn("AI analysis failed:", err)
      showToast.warning("AI analysis unavailable \u2014 showing parsed trades only. You can retry later.")
      setAnalysisState("complete")
    }
  }

  const handleAnalyse = useCallback(async () => {
    if (isAnalysing) return
    setAnalysisState("analysing")
    setLoading(true)

    try {
      if (!files || files.length === 0) {
        showToast.error("Please upload at least one broker statement to analyse.")
        setError("Please upload at least one broker statement to analyse.")
        setAnalysisState("error")
        return
      }

      // Step 1: Local Parse
      setStatus("Parsing your files locally...")
      let allTrades: unknown[] = []
      let broker = detectedBrokerFromStore || "Unknown"
      let market = "Unknown"
      let tradeDate = ""
      let currency = ""
      let fileHash = ""
      let fileSizeBytes = 0
      let rawFileId: string | undefined
      const failedFiles: string[] = []

      for (const file of files) {
        const parseForm = new FormData()
        parseForm.append("file", file)
        try {
          const parseRes = await fetch("/api/parse", { method: "POST", body: parseForm })
          if (parseRes.ok) {
            const parsed = await parseRes.json()
            if (parsed.trades && parsed.trades.length > 0) {
              allTrades = [...allTrades, ...parsed.trades]
              if (parsed.broker && parsed.broker !== "Unknown") broker = parsed.broker
              market = parsed.market || market
              tradeDate = parsed.trade_date || tradeDate
              currency = parsed.currency || currency
              if (parsed.file_hash) fileHash = parsed.file_hash
              if (parsed.file_size_bytes) fileSizeBytes = parsed.file_size_bytes
              if (parsed.raw_file_id && !rawFileId) rawFileId = parsed.raw_file_id
            } else {
              failedFiles.push(file.name)
            }
          } else {
            failedFiles.push(file.name)
          }
        } catch {
          failedFiles.push(file.name)
        }
      }

      // Show partial success / failure messages
      if (failedFiles.length > 0 && allTrades.length > 0) {
        const names = failedFiles.length <= 2 ? failedFiles.join(', ') : `${failedFiles.length} files`
        showToast.warning(`Could not extract trades from: ${names}. Continuing with ${allTrades.length} trades from other files.`)
      }

      // Update store with detected broker for UI display
      if (broker !== "Unknown") setDetectedBroker(broker)

      if (allTrades.length === 0) {
        // Fallback: send files directly to AI for extraction + analysis
        setStatus("Local parse found no trades, trying AI extraction...")
        const formData = new FormData()
        for (const file of files) formData.append("files", file)
        formData.append("context", JSON.stringify({ ...context, detected_broker: broker !== "Unknown" ? broker : undefined }))

        let res: Response
        try {
          res = await fetch("/api/analyse", { method: "POST", body: formData })
        } catch {
          const msg = "Network error. Please check your internet connection and try again."
          showToast.error(msg)
          setError(msg)
          setAnalysisState("error")
          return
        }

        const data = await res.json().catch(() => ({ error: "Failed to read response" }))

        // Handle duplicate file detection
        if (data.duplicate) {
          showToast.info(data.message || "This file was already uploaded. No changes made.")
          setAnalysisState("idle")
          setLoading(false)
          return
        }

        if (!res.ok || data.error) {
          const msg = friendlyError(data.error || data.details || `HTTP ${res.status}`, data.code)
          showToast.error(msg)
          setError(msg)
          setAnalysisState("error")
          return
        }

        // Show dedup stats if available
        if (data.tradesSkipped && data.tradesSkipped > 0) {
          showToast.info(`Added ${data.tradesAdded || data.trades?.length || 0} new trades. Skipped ${data.tradesSkipped} duplicates.`)
        }

        setAnalysis(data)
        setAnalysisState("complete")
        showToast.success(`Analysis complete! ${data.tradesAdded || data.trades?.length || 0} trades found.`)
        return
      }

      // Step 2: Show parsed results immediately
      setStatus("Trades parsed! Loading dashboard...")
      setAnalysis({
        trades: allTrades,
        analysis: null,
        metadata: {
          detected_market: market,
          detected_currency: currency,
          detected_broker: broker,
          trade_date: tradeDate,
          trade_count: allTrades.length,
          net_pnl: // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic trade shape
          (allTrades as any[]).reduce((s: number, t: any) => s + (t.pnl || 0), 0),
          processing_time_ms: 0,
        },
      })
      setAnalysisState("parsed")
      showToast.success(`${allTrades.length} trades parsed! Running AI analysis...`)

      // Step 3: Auto-trigger AI analysis in background
      runAIAnalysis(allTrades, broker, market, tradeDate, currency, fileHash, fileSizeBytes, rawFileId)

    } catch (err) {
      const raw = err instanceof Error ? err.message : "Analysis failed"
      const msg = friendlyError(raw)
      showToast.error(msg)
      setError(msg)
      setAnalysisState("error")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [files, context, isAnalysing, setAnalysisState, setAnalysis, setLoading, setError])

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleAnalyse}
        disabled={isAnalysing || noFiles}
        className="px-8 py-3 rounded-xl text-base font-semibold transition-all duration-200"
        style={{
          background: (isAnalysing || noFiles) ? 'var(--s3)' : 'var(--color-accent)',
          color: (isAnalysing || noFiles) ? 'var(--color-muted)' : '#FFFFFF',
          cursor: (isAnalysing || noFiles) ? 'not-allowed' : 'pointer',
          opacity: (isAnalysing || noFiles) ? 0.7 : 1,
          fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)',
          boxShadow: 'none',
        }}
      >
        {isAnalysing ? 'Analysing...' : 'Run free analysis'}
      </button>
      <p className="text-xs text-center" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-dm-sans, DM Sans, system-ui, sans-serif)' }}>
        {isAnalysing
          ? <span ref={statusRef}>Analysing {files.length} file{files.length !== 1 ? 's' : ''}...</span>
          : 'No account required. Upload your broker statement to begin.'}
      </p>
      <div
        className="w-full max-w-sm h-1 rounded-full overflow-hidden"
        style={{ background: "var(--s3)", opacity: isAnalysing ? 1 : 0, transition: "opacity 0.3s" }}
      >
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ background: "var(--accent)", width: "0%", transition: isAnalysing ? "width 2.8s cubic-bezier(.4,0,.2,1)" : "width 0.3s" }}
        />
      </div>
    </div>
  )
}
