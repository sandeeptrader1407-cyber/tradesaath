'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminMetricCard from '@/components/admin/AdminMetricCard'
import AdminTable from '@/components/admin/AdminTable'

interface UsageData {
  spendToday: number
  spendMonth: number
  spendAllTime: number
  dailyCost: { date: string; cost: number }[]
  topByUser: { user_id: string; email: string; cost_usd: number }[]
  byRoute: { route: string; cost_usd: number }[]
}

function fmtCost(usd: number) {
  if (usd < 0.001) return `$${usd.toFixed(6)}`
  if (usd < 0.01) return `$${usd.toFixed(5)}`
  return `$${usd.toFixed(4)}`
}

function fmtDayLabel(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`
}

const CHART_COLOR = 'var(--admin-accent)'

export default function AdminAiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/ai-usage')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <AdminPageHeader title="AI Usage" subtitle="Claude API spend tracking (claude-sonnet-4 pricing)" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <AdminMetricCard label="Spend Today" value={data ? fmtCost(data.spendToday) : '—'} />
        <AdminMetricCard label="Spend This Month" value={data ? fmtCost(data.spendMonth) : '—'} />
        <AdminMetricCard label="All-Time Spend" value={data ? fmtCost(data.spendAllTime) : '—'} />
      </div>

      {/* Daily cost chart */}
      <div
        style={{
          background: 'var(--admin-card-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: 'var(--admin-shadow)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
          Daily Cost — Last 30 Days (USD)
        </div>
        {loading ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data?.dailyCost ?? []} barSize={10} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={fmtDayLabel}
                tick={{ fontSize: 9, fill: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
              />
              <Tooltip
                formatter={(v: unknown) => [fmtCost(Number(v)), 'Cost']}
                labelFormatter={(label: unknown) => fmtDayLabel(String(label))}
                contentStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)', border: '1px solid var(--admin-border)', borderRadius: 4, background: 'var(--admin-card-bg)' }}
                cursor={{ fill: 'var(--admin-accent-dim)' }}
              />
              <Bar dataKey="cost" fill={CHART_COLOR} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Top Users by Cost (This Month)
          </div>
          <AdminTable
            loading={loading}
            keyField="user_id"
            columns={[
              { key: 'email', label: 'User', sortable: true },
              { key: 'cost_usd', label: 'Cost (USD)', mono: true, sortable: true, render: v => fmtCost(Number(v)) },
            ]}
            rows={(data?.topByUser ?? []) as unknown as Record<string, unknown>[]}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Cost by Route (This Month)
          </div>
          <AdminTable
            loading={loading}
            keyField="route"
            columns={[
              { key: 'route', label: 'Route', sortable: true, mono: true },
              { key: 'cost_usd', label: 'Cost (USD)', mono: true, sortable: true, render: v => fmtCost(Number(v)) },
            ]}
            rows={(data?.byRoute ?? []) as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  )
}
