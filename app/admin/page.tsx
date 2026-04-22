'use client'

import { useEffect, useState } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminMetricCard from '@/components/admin/AdminMetricCard'
import AdminTable from '@/components/admin/AdminTable'

interface OverviewData {
  totalUsers: number
  totalRevenueRupees: number
  activeProUsers: number
  sessionsToday: number
  recentUsers: { clerk_id: string; email: string; name: string; plan: string; created_at: string }[]
  recentPayments: { clerk_id: string; email?: string; plan: string; amountRupees: number; created_at: string; razorpay_order_id: string }[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const metrics = data
    ? [
        { label: 'Total Users', value: data.totalUsers.toLocaleString('en-IN') },
        { label: 'Total Revenue', value: `₹${data.totalRevenueRupees.toLocaleString('en-IN')}` },
        { label: 'Active Pro Users', value: data.activeProUsers.toLocaleString('en-IN') },
        { label: 'Sessions Today', value: data.sessionsToday.toLocaleString('en-IN') },
      ]
    : [
        { label: 'Total Users', value: '—' },
        { label: 'Total Revenue', value: '—' },
        { label: 'Active Pro Users', value: '—' },
        { label: 'Sessions Today', value: '—' },
      ]

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        subtitle="Platform snapshot"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {metrics.map(m => (
          <AdminMetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Recent Signups
          </div>
          <AdminTable
            loading={loading}
            keyField="clerk_id"
            pageSize={10}
            columns={[
              { key: 'name', label: 'Name', sortable: true },
              { key: 'email', label: 'Email', sortable: true },
              { key: 'plan', label: 'Plan', sortable: true },
              {
                key: 'created_at',
                label: 'Joined',
                sortable: true,
                render: v => fmtDate(String(v)),
              },
            ]}
            rows={(data?.recentUsers ?? []) as unknown as Record<string, unknown>[]}
          />
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', marginBottom: 10, fontFamily: 'var(--font-sans)' }}>
            Recent Payments
          </div>
          <AdminTable
            loading={loading}
            keyField="razorpay_order_id"
            pageSize={10}
            columns={[
              {
                key: 'created_at',
                label: 'Date',
                sortable: true,
                render: v => fmtDate(String(v)),
              },
              { key: 'email', label: 'User', sortable: true },
              { key: 'plan', label: 'Plan', sortable: true },
              {
                key: 'amountRupees',
                label: 'Amount',
                mono: true,
                sortable: true,
                render: v => `₹${Number(v).toLocaleString('en-IN')}`,
              },
            ]}
            rows={(data?.recentPayments ?? []) as unknown as Record<string, unknown>[]}
          />
        </div>
      </div>
    </div>
  )
}
