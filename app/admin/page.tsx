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

interface ActivityEvent {
  event_type: 'signup' | 'upload'
  label: string
  email: string
  created_at: string
}

interface CollapsedEvent extends ActivityEvent {
  count?: number   // set when multiple consecutive uploads are collapsed
}

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
  activityFeed: ActivityEvent[]
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = diff / 1000
  const mins = diff / 60_000
  const hours = diff / 3_600_000
  const days = diff / 86_400_000
  if (secs < 60)  return 'just now'
  if (mins < 60)  return `${Math.floor(mins)}m ago`
  if (hours < 24) return `${Math.floor(hours)}h ago`
  return `${Math.floor(days)}d ago`
}

// Collapse > 3 consecutive uploads from the same user into a single row.
function deduplicateFeed(events: ActivityEvent[]): CollapsedEvent[] {
  const result: CollapsedEvent[] = []
  let i = 0
  while (i < events.length) {
    const ev = events[i]
    if (ev.event_type === 'upload') {
      let j = i + 1
      while (j < events.length && events[j].event_type === 'upload' && events[j].email === ev.email) {
        j++
      }
      const count = j - i
      if (count > 3) {
        // Keep the most-recent event's timestamp and broker label
        result.push({ ...ev, count })
        i = j
      } else {
        result.push(ev)
        i++
      }
    } else {
      result.push(ev)
      i++
    }
  }
  return result
}

const CHART_COLOR = 'var(--admin-accent)'

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      fetch('/api/admin/overview')
        .then(r => r.json())
        .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
        .catch(() => { if (!cancelled) setLoading(false) })
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
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

  const feed = deduplicateFeed(data?.activityFeed ?? [])

  return (
    <div>
      {/* Inline token for activity-feed dot colours */}
      <style>{`.admin-shell{--admin-blue:#0F4C81;--admin-muted2:#B4B2A9}`}</style>
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

      {/* Recent Signups (55%) + Activity Feed (45%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 24, marginBottom: 24 }}>

        {/* Left: Recent Signups */}
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

        {/* Right: Live activity feed */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginBottom: 10 }}>
            Activity — last 48 hours
          </div>
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
              <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>
                Loading...
              </div>
            ) : feed.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>
                No activity in the last 48 hours.
              </div>
            ) : (
              feed.map((ev, i) => {
                const eventText = ev.event_type === 'signup'
                  ? `${ev.label} joined`
                  : ev.count != null
                    ? `${ev.email || 'Unknown'} uploaded ${ev.count} sessions via ${ev.label}`
                    : `${ev.email || 'Unknown'} uploaded via ${ev.label}`
                return (
                  <div
                    key={`${ev.event_type}-${ev.created_at}-${i}`}
                    style={{
                      padding: '10px 14px',
                      borderBottom: i < feed.length - 1 ? '0.5px solid var(--admin-border)' : 'none',
                    }}
                  >
                    {/* Line 1: dot + event text (truncated) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: ev.event_type === 'signup'
                          ? 'var(--admin-blue)'
                          : 'var(--admin-accent)',
                      }} />
                      <span style={{
                        fontSize: 13,
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--admin-ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        minWidth: 0,
                      }}>
                        {eventText}
                      </span>
                    </div>
                    {/* Line 2: time ago, indented to align with text (6px dot + 10px gap = 16px) */}
                    <div style={{ paddingLeft: 16, marginTop: 2 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--admin-muted)' }}>
                        {timeAgo(ev.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginTop: 6, paddingLeft: 2 }}>
            Refreshes every 60s
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div style={{ marginBottom: 32 }}>
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
