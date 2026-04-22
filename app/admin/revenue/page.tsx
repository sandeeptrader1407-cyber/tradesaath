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

interface RevenueData {
  totalRevenueRupees: number
  thisMonthRupees: number
  lastMonthRupees: number
  momChangePct: number | null
  weeklyRevenue: { week: string; rupees: number }[]
  planBreakdown: { plan: string; count: number; revenueRupees: number; pct: number }[]
  recentPayments: { date: string; email: string; plan: string; amountRupees: number; razorpay_order_id: string }[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmtWeek(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`
}

const CHART_COLOR = 'var(--admin-accent)'

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/revenue')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const momSign = (data?.momChangePct ?? 0) >= 0 ? '+' : ''

  return (
    <div>
      <AdminPageHeader title="Revenue" subtitle="Razorpay payments, completed only" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <AdminMetricCard label="All-Time Revenue" value={data ? `₹${data.totalRevenueRupees.toLocaleString('en-IN')}` : '—'} />
        <AdminMetricCard label="This Month" value={data ? `₹${data.thisMonthRupees.toLocaleString('en-IN')}` : '—'} />
        <AdminMetricCard label="Last Month" value={data ? `₹${data.lastMonthRupees.toLocaleString('en-IN')}` : '—'} />
        <AdminMetricCard
          label="Month-over-Month"
          value={data?.momChangePct != null ? `${momSign}${data.momChangePct}%` : '—'}
          trend={
            data?.momChangePct != null
              ? { value: `${momSign}${data.momChangePct}%`, up: (data.momChangePct ?? 0) >= 0 }
              : null
          }
        />
      </div>

      {/* Weekly bar chart */}
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
          Weekly Revenue — Last 12 Weeks
        </div>
        {loading ? (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.weeklyRevenue ?? []} barSize={22} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="week"
                tickFormatter={fmtWeek}
                tick={{ fontSize: 10, fill: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₹${v}`}
              />
              <Tooltip
                formatter={(v: unknown) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                labelFormatter={(label: unknown) => fmtWeek(String(label))}
                contentStyle={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--admin-border)', borderRadius: 4, background: 'var(--admin-card-bg)' }}
                cursor={{ fill: 'var(--admin-accent-dim)' }}
              />
              <Bar dataKey="rupees" fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
        {/* Plan breakdown */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Plan Breakdown
          </div>
          <AdminTable
            loading={loading}
            keyField="plan"
            columns={[
              { key: 'plan', label: 'Plan', sortable: true },
              { key: 'count', label: 'Purchases', mono: true, sortable: true },
              { key: 'revenueRupees', label: 'Revenue', mono: true, sortable: true, render: v => `₹${Number(v).toLocaleString('en-IN')}` },
              { key: 'pct', label: '%', mono: true, sortable: true, render: v => `${v}%` },
            ]}
            rows={(data?.planBreakdown ?? []) as unknown as Record<string, unknown>[]}
          />
        </div>

        {/* Recent payments */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Recent Payments
          </div>
          <AdminTable
            loading={loading}
            keyField="razorpay_order_id"
            pageSize={10}
            columns={[
              { key: 'date', label: 'Date', sortable: true, render: v => fmtDate(String(v)) },
              { key: 'email', label: 'User', sortable: true },
              { key: 'plan', label: 'Plan', sortable: true },
              { key: 'amountRupees', label: 'Amount', mono: true, sortable: true, render: v => `₹${Number(v).toLocaleString('en-IN')}` },
              { key: 'razorpay_order_id', label: 'Order ID', mono: true },
            ]}
            rows={(data?.recentPayments ?? []) as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  )
}
