'use client'

import { useEffect, useState } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminMetricCard from '@/components/admin/AdminMetricCard'
import AdminTable from '@/components/admin/AdminTable'

interface SessionRow {
  id: string
  user_id: string
  email: string
  trade_date: string
  detected_broker: string
  trade_count: number
  net_pnl: number
  status: 'analysed' | 'pending' | 'failed'
  created_at: string
}

interface SessionsData {
  total: number
  today: number
  pending: number
  sessions: SessionRow[]
}

interface FlagRow {
  key: string
  value: boolean
  updated_by: string | null
  updated_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  analysed: 'var(--admin-accent)',
  pending: 'var(--admin-gold)',
  failed: 'var(--admin-red)',
}

export default function AdminSessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [flagLoading, setFlagLoading] = useState<string | null>(null)

  function loadSessions(filter = statusFilter) {
    setLoading(true)
    fetch(`/api/admin/sessions?status=${filter}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function loadFlags() {
    fetch('/api/admin/flags')
      .then(r => r.json())
      .then(d => setFlags(d.flags ?? []))
  }

  useEffect(() => { loadSessions(); loadFlags() }, [])

  function handleStatusChange(v: string) {
    setStatusFilter(v)
    loadSessions(v)
  }

  async function toggleFlag(key: string, currentValue: boolean) {
    setFlagLoading(key)
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: !currentValue }),
    })
    loadFlags()
    setFlagLoading(null)
  }

  const aiFlag = flags.find(f => f.key === 'DISABLE_AI_ANALYSIS')

  return (
    <div>
      <AdminPageHeader title="Sessions" subtitle="Trade sessions and analysis status" />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <AdminMetricCard label="Total Sessions" value={data?.total.toLocaleString('en-IN') ?? '—'} />
        <AdminMetricCard label="Today" value={data?.today.toLocaleString('en-IN') ?? '—'} />
        <AdminMetricCard label="Pending Analysis" value={data?.pending.toLocaleString('en-IN') ?? '—'} />
        <AdminMetricCard label="Analysed" value={data ? ((data.total - data.pending)).toLocaleString('en-IN') : '—'} />
      </div>

      {/* AI Kill Switch */}
      <div
        style={{
          background: 'var(--admin-card-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--admin-shadow)',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 400, color: 'var(--admin-ink)', fontFamily: 'var(--font-sans)' }}>
            AI Analysis Kill Switch
          </div>
          <div style={{ fontSize: 12, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
            When enabled, all /api/analyse, /api/chat, and /api/coach calls return 503.
          </div>
        </div>
        <button
          disabled={!!flagLoading}
          onClick={() => aiFlag && toggleFlag(aiFlag.key, aiFlag.value)}
          style={{
            height: 28,
            padding: '0 14px',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            border: '1px solid var(--admin-border)',
            borderRadius: 4,
            background: aiFlag?.value ? 'var(--admin-red)' : 'var(--admin-card-bg)',
            color: aiFlag?.value ? '#fff' : 'var(--admin-ink)',
            cursor: flagLoading ? 'not-allowed' : 'pointer',
            minWidth: 80,
          }}
        >
          {flagLoading === 'DISABLE_AI_ANALYSIS' ? 'Saving...' : aiFlag?.value ? 'ON (disabled)' : 'OFF (enabled)'}
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'analysed', 'pending', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            style={{
              height: 28,
              padding: '0 12px',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              border: '1px solid var(--admin-border)',
              borderRadius: 4,
              background: statusFilter === s ? 'var(--admin-ink)' : 'var(--admin-card-bg)',
              color: statusFilter === s ? 'var(--admin-page-bg)' : 'var(--admin-ink)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <AdminTable
        loading={loading}
        keyField="id"
        pageSize={20}
        columns={[
          { key: 'email', label: 'User', sortable: true },
          { key: 'trade_date', label: 'Date', sortable: true, render: v => fmtDate(String(v)) },
          { key: 'detected_broker', label: 'Broker', sortable: true },
          { key: 'trade_count', label: 'Trades', mono: true, sortable: true },
          {
            key: 'net_pnl',
            label: 'Net P&L',
            mono: true,
            sortable: true,
            render: v => {
              const n = Number(v)
              return <span style={{ color: n >= 0 ? 'var(--admin-accent)' : 'var(--admin-red)' }}>₹{Math.round(n).toLocaleString('en-IN')}</span>
            },
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: v => (
              <span style={{ fontSize: 11, color: STATUS_COLORS[String(v)] ?? 'var(--admin-muted)', fontFamily: 'var(--font-mono)', textTransform: 'capitalize' }}>
                {String(v)}
              </span>
            ),
          },
          { key: 'created_at', label: 'Created', sortable: true, render: v => fmtDate(String(v)) },
        ]}
        rows={(data?.sessions ?? []) as unknown as Record<string, unknown>[]}
      />
    </div>
  )
}
