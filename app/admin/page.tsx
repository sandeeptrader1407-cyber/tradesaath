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

interface OverviewData {
  totalUsers: number
  totalRevenueRupees: number
  activeProUsers: number
  sessionsToday: number
  conversionRate: number
  avgSessionsPerUser: number
  weeklySignups: { week: string; count: number }[]
  recentUsers: { clerk_id: string; email: string; name: string; plan: string; created_at: string }[]
  recentPayments: { clerk_id: string; email?: string; plan: string; amountRupees: number; created_at: string; razorpay_order_id: string }[]
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  single: 'Starter',
  pro_monthly: 'Pro Monthly',
  pro_yearly: 'Pro Yearly',
}

function fmtPlan(plan: string) {
  return PLAN_LABELS[plan] ?? plan
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtWeek(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`
}

const CHART_COLOR = 'var(--admin-accent)'

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const row1 = data
    ? [
        { label: 'Total Users', value: data.totalUsers.toLocaleString('en-IN') },
        { label: 'Total Revenue', value: `₹${data.totalRevenueRupees.toLocaleString('en-IN')}` },
        { label: 'Active Pro Users', value: data.activeProUsers.toLocaleString('en-IN') },
        { label: 'Sessions Today', value: data.sessionsToday.toLocaleString('en-IN') },
      ]
    : Array(4).fill(null).map((_, i) => ({ label: ['Total Users', 'Total Revenue', 'Active Pro Users', 'Sessions Today'][i], value: '—' }))

  const row2 = data
    ? [
        { label: 'Free → Paid Conversion', value: `${data.conversionRate}%` },
        { label: 'Avg Sessions / User', value: String(data.avgSessionsPerUser) },
      ]
    : [
        { label: 'Free → Paid Conversion', value: '—' },
        { label: 'Avg Sessions / User', value: '—' },
      ]

  return (
    <div>
      <AdminPageHeader title="Overview" subtitle="Platform snapshot" />

      {/* Row 1 — core metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {row1.map(m => (
          <AdminMetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      {/* Row 2 — computed metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {row2.map(m => (
          <AdminMetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Recent Signups
          </div>
          <div style={{ overflowX: 'auto' }}>
            <AdminTable
              loading={loading}
              keyField="clerk_id"
              pageSize={10}
              columns={[
                { key: 'name', label: 'Name', sortable: true },
                { key: 'email', label: 'Email', sortable: true },
                {
                  key: 'plan',
                  label: 'Plan',
                  sortable: true,
                  width: '100px',
                  render: v => fmtPlan(String(v)),
                },
                {
                  key: 'created_at',
                  label: 'Joined',
                  sortable: true,
                  width: '100px',
                  render: v => fmtDate(String(v)),
                },
              ]}
              rows={(data?.recentUsers ?? []) as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Recent Payments
          </div>
          <div style={{ overflowX: 'auto' }}>
            <AdminTable
              loading={loading}
              keyField="razorpay_order_id"
              pageSize={10}
              emptyText="No completed payments yet."
              columns={[
                {
                  key: 'created_at',
                  label: 'Date',
                  sortable: true,
                  width: '100px',
                  render: v => fmtDate(String(v)),
                },
                { key: 'email', label: 'User', sortable: true },
                {
                  key: 'plan',
                  label: 'Plan',
                  sortable: true,
                  width: '100px',
                  render: v => fmtPlan(String(v)),
                },
                {
                  key: 'amountRupees',
                  label: 'Amount',
                  mono: true,
                  sortable: true,
                  width: '80px',
                  render: v => `₹${Number(v).toLocaleString('en-IN')}`,
                },
              ]}
              rows={(data?.recentPayments ?? []) as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>
      </div>

      {/* Weekly signups bar chart */}
      <div
        style={{
          background: 'var(--admin-card-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          padding: '20px 24px',
          boxShadow: 'var(--admin-shadow)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
          Signups per Week — Last 8 Weeks
        </div>
        {loading ? (
          <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-muted)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data?.weeklySignups ?? []} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="week"
                tickFormatter={fmtWeek}
                tick={{ fontSize: 10, fill: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--admin-muted)', fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: unknown) => [Number(v), 'Signups']}
                labelFormatter={(label: unknown) => fmtWeek(String(label))}
                contentStyle={{ fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px solid var(--admin-border)', borderRadius: 4, background: 'var(--admin-card-bg)' }}
                cursor={{ fill: 'var(--admin-accent-dim)' }}
              />
              <Bar dataKey="count" fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
