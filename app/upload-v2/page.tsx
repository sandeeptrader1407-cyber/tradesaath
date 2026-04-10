'use client'

import AutoDetectBar from '@/components/upload/AutoDetectBar'
import Dropzone from '@/components/upload/Dropzone'
import FileChips from '@/components/upload/FileChips'
import TradingContext from '@/components/upload/TradingContext'
import AnalyseButton from '@/components/upload/AnalyseButton'

export default function UploadPageV2() {
  return (
    <main
      className="min-h-screen pt-24 pb-16 px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* Page heading */}
        <div className="text-center mb-2">
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: "'Fraunces', serif", color: 'var(--text)' }}
          >
            Upload Your Trades
          </h1>
          <p className="mt-2 text-base" style={{ color: 'var(--text2)' }}>
            Drop your broker files and get AI-powered psychological analysis in seconds
          </p>
        </div>

        {/* Auto-detect bar */}
        <AutoDetectBar />

        {/* Main upload card */}
        <div
          className="rounded-xl border p-6 flex flex-col gap-5"
          style={{
            background: 'var(--s1)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Dropzone */}
          <Dropzone />

          {/* File chips */}
          <FileChips />
        </div>

        {/* Trading context */}
        <TradingContext />

        {/* Analyse button */}
        <AnalyseButton />
      </div>
    </main>
  )
}
