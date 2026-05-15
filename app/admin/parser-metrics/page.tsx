'use client'

import { useEffect, useState } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminMetricCard from '@/components/admin/AdminMetricCard'

interface RecentParse {
  id: string
  created_at: string
  parser_used: string | null
  parser_model_name: string | null
  parser_cost_usd: number | null
  parser_duration_ms: number | null
  trade_count: number | null
  net_pnl: number | null
}

interface ParserBreakdown {
  parser: string
  count: number
  totalCostUsd: number
  avgCostUsd: number
  avgDurationMs: number
}

interface MetricsData {
  totalCost24h: number
  totalCost7d: number
  totalCost30d: number
  totalParses24h: number
  totalParses7d: number
  totalParses30d: number
  byParser: ParserBreakdown[]
  recent: RecentParse[]
}

function fmtUsd(n: number): string {
  if (n === 0) return '$0'
  if (n < 0.01) return `$${n.toFixed(6)}`
  return `$${n.toFixed(4)}`
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} ${time}`
}

export default function ParserMetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/parser-metrics')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as MetricsData
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Parser Metrics" subtitle="AI parser cost + performance" />
        <div style={{ color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Loading…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <AdminPageHeader title="Parser Metrics" subtitle="AI parser cost + performance" />
        <div style={{ color: 'var(--admin-loss)', fontFamily: 'var(--font-sans)' }}>
          Error loading metrics: {error ?? 'No data'}
        </div>
      </div>
    )
  }

  const hasNoData = data.totalParses30d === 0

  return (
    <div>
      <AdminPageHeader
        title="Parser Metrics"
        subtitle="AI parser cost + performance (Gemini / Claude Haiku). Legacy parser sessions not included."
      />

      {hasNoData ? (
        <div
          style={{
            background: 'var(--admin-card-bg)',
            border: '1px solid var(--admin-border)',
            borderRadius: 8,
            padding: '32px 24px',
            color: 'var(--admin-muted)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
          }}
        >
          No AI parser activity in the last 30 days.
          <br />
          <span style={{ fontSize: 13, marginTop: 8, display: 'inline-block' }}>
            Set ENABLE_AI_FIRST_PARSER=true on Vercel Preview to start collecting data.
          </span>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <AdminMetricCard
              label="Cost 24h"
              value={fmtUsd(data.totalCost24h)}
              subtext={`${data.totalParses24h} parses`}
            />
            <AdminMetricCard
              label="Cost 7d"
              value={fmtUsd(data.totalCost7d)}
              subtext={`${data.totalParses7d} parses`}
            />
            <AdminMetricCard
              label="Cost 30d"
              value={fmtUsd(data.totalCost30d)}
              subtext={`${data.totalParses30d} parses`}
            />
            <AdminMetricCard
              label="Avg cost / parse"
              value={fmtUsd(data.totalParses30d > 0 ? data.totalCost30d / data.totalParses30d : 0)}
              subtext="30-day average"
            />
          </div>

          {/* By-parser breakdown */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 400,
              color: 'var(--admin-ink)',
              marginBottom: 12,
            }}
          >
            By parser (30 days)
          </h2>
          <div
            style={{
              background: 'var(--admin-card-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 32,
              boxShadow: 'var(--admin-shadow)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Parser</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Files</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Total cost</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Avg cost</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Avg time</th>
                </tr>
              </thead>
              <tbody>
                {data.byParser.map((row) => (
                  <tr key={row.parser} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {row.parser}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {row.count}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {fmtUsd(row.totalCostUsd)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {fmtUsd(row.avgCostUsd)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {fmtDuration(row.avgDurationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent parses */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 400,
              color: 'var(--admin-ink)',
              marginBottom: 12,
            }}
          >
            Recent parses (last 100)
          </h2>
          <div
            style={{
              background: 'var(--admin-card-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '16px 20px',
              boxShadow: 'var(--admin-shadow)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Parser</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Model</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Cost</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Time</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Trades</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Net P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}>
                      {fmtTime(r.created_at)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {r.parser_used ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}>
                      {r.parser_model_name ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {r.parser_cost_usd != null ? fmtUsd(r.parser_cost_usd) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {r.parser_duration_ms != null ? fmtDuration(r.parser_duration_ms) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--admin-ink)', fontFamily: 'var(--font-mono)' }}>
                      {r.trade_count ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 12px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        color:
                          r.net_pnl == null
                            ? 'var(--admin-muted)'
                            : r.net_pnl >= 0
                              ? 'var(--admin-profit, #3B6D11)'
                              : 'var(--admin-loss, #A32D2D)',
                      }}
                    >
                      {r.net_pnl != null ? `₹${r.net_pnl.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
