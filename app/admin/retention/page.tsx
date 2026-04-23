'use client'

import { useEffect, useState } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminMetricCard from '@/components/admin/AdminMetricCard'

interface CohortRow {
  cohort_week: string
  signed_up: number
  active_d1: number
  active_d7: number
  active_d30: number
}

interface RetentionData {
  cohorts: CohortRow[]
  avgD1Rate: number
  avgD7Rate: number
  avgD30Rate: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function fmtWeekLabel(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`
}

function retentionPct(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

function pctColor(pct: number): string {
  if (pct >= 60) return '#3B6D11'
  if (pct >= 30) return '#854F0B'
  return '#A32D2D'
}

function RetentionCell({ count, signedUp, ageMs, threshold }: {
  count: number
  signedUp: number
  ageMs: number
  threshold: number
}) {
  if (ageMs < threshold) {
    return <span style={{ color: 'var(--admin-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>—</span>
  }
  const pct = retentionPct(count, signedUp)
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <span style={{ color: 'var(--admin-ink)' }}>{count} </span>
      <span style={{ color: pctColor(pct) }}>({pct}%)</span>
    </span>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0 14px',
  height: 36,
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--admin-muted)',
  borderBottom: '1px solid var(--admin-border)',
  background: 'var(--admin-card-bg)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '0 14px',
  height: 40,
  fontSize: 13,
  borderBottom: '1px solid var(--admin-border)',
  verticalAlign: 'middle',
}

export default function AdminRetentionPage() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/retention')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const now = Date.now()

  return (
    <div>
      <AdminPageHeader
        title="Retention"
        subtitle="Cohort upload activity — last 12 weeks"
      />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <AdminMetricCard
          label="Avg D1 Upload Rate"
          value={data ? `${data.avgD1Rate}%` : '—'}
          subtext="Users who uploaded within 1 day"
        />
        <AdminMetricCard
          label="Avg D7 Upload Rate"
          value={data ? `${data.avgD7Rate}%` : '—'}
          subtext="Users who uploaded within 7 days"
        />
        <AdminMetricCard
          label="Avg D30 Upload Rate"
          value={data ? `${data.avgD30Rate}%` : '—'}
          subtext="Users who uploaded within 30 days"
        />
      </div>

      {/* Cohort table */}
      <div
        style={{
          background: 'var(--admin-card-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: 'var(--admin-shadow)',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>
            Loading...
          </div>
        ) : !data || data.cohorts.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>
            No cohort data yet. Data appears after the first week of signups.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Week</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Signed up</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Uploaded D1</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Uploaded D7</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Uploaded D30</th>
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((row, i) => {
                  const weekAgeMs = now - new Date(row.cohort_week).getTime()
                  return (
                    <tr
                      key={row.cohort_week}
                      style={{ background: i % 2 === 1 ? 'var(--admin-row-hover)' : undefined }}
                    >
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-sans)', color: 'var(--admin-ink)' }}>
                        {fmtWeekLabel(row.cohort_week)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--admin-ink)' }}>
                        {row.signed_up}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <RetentionCell count={row.active_d1} signedUp={row.signed_up} ageMs={weekAgeMs} threshold={DAY_MS} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <RetentionCell count={row.active_d7} signedUp={row.signed_up} ageMs={weekAgeMs} threshold={7 * DAY_MS} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <RetentionCell count={row.active_d30} signedUp={row.signed_up} ageMs={weekAgeMs} threshold={30 * DAY_MS} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
