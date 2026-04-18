'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAnalysisStore } from '@/lib/analysisStore'

/**
 * /results page — redirects to /upload where results are now rendered inline.
 * If analysis data exists in store, the upload page will show the results view.
 * If no data, user lands on the upload form.
 */
export default function ResultsRedirect() {
  const router = useRouter()
  const analysis = useAnalysisStore((s) => s.analysis)

  useEffect(() => {
    // Always redirect to /upload — it handles both upload and results views
    router.replace('/upload')
  }, [router, analysis])

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <p style={{ color: 'var(--muted)' }}>Redirecting…</p>
    </main>
  )
}
