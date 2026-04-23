'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminTable from '@/components/admin/AdminTable'

type RiskLevel = 'at_risk' | 'cooling' | 'new' | 'active' | 'inactive'
type FilterKey = 'all' | RiskLevel

interface AdminUser {
  clerk_id: string
  email: string
  name: string
  plan: string
  session_quota: number | null
  sessions_used: number
  session_count: number
  last_active: string | null
  risk: RiskLevel
  total_paid_rupees: number
  created_at: string
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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

const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; border: string }> = {
  at_risk:  { label: 'At risk',  bg: 'var(--risk-at-risk-bg)',  text: 'var(--risk-at-risk-text)',  border: 'var(--risk-at-risk-border)' },
  cooling:  { label: 'Cooling',  bg: 'var(--risk-cooling-bg)',  text: 'var(--risk-cooling-text)',  border: 'var(--risk-cooling-border)' },
  active:   { label: 'Active',   bg: 'var(--risk-active-bg)',   text: 'var(--risk-active-text)',   border: 'var(--risk-active-border)' },
  new:      { label: 'New',      bg: 'var(--risk-new-bg)',      text: 'var(--risk-new-text)',      border: 'var(--risk-new-border)' },
  inactive: { label: 'Inactive', bg: 'var(--risk-inactive-bg)', text: 'var(--risk-inactive-text)', border: 'var(--risk-inactive-border)' },
}

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  at_risk: 'At risk',
  cooling: 'Cooling',
  active: 'Active',
  new: 'New',
  inactive: 'Inactive',
}

const FILTERS: FilterKey[] = ['all', 'at_risk', 'cooling', 'active', 'new', 'inactive']

type ActionKey = 'reset_quota' | 'set_pro' | 'set_free'

const ACTION_LABELS: Record<ActionKey, string> = {
  reset_quota: 'Reset quota',
  set_pro: 'Set Pro',
  set_free: 'Set Free',
}

const DESTRUCTIVE = new Set<ActionKey>(['set_free'])

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ userId: string; action: ActionKey } | null>(null)

  const load = useCallback((q = search) => {
    setLoading(true)
    fetch(`/api/admin/users?search=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [search])

  useEffect(() => { load('') }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load(search)
  }

  async function execAction(userId: string, action: ActionKey) {
    setActionLoading(`${userId}:${action}`)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const d = await res.json()
      if (!res.ok) { setActionError(d.error || 'Action failed'); return }
      load(search)
    } catch {
      setActionError('Network error')
    } finally {
      setActionLoading(null)
      setConfirm(null)
    }
  }

  function requestAction(userId: string, action: ActionKey) {
    if (DESTRUCTIVE.has(action)) {
      setConfirm({ userId, action })
    } else {
      execAction(userId, action)
    }
  }

  // Client-side filter
  const allUsers = data?.users ?? []
  const filteredUsers = useMemo(() =>
    activeFilter === 'all' ? allUsers : allUsers.filter(u => u.risk === activeFilter),
    [allUsers, activeFilter],
  )

  // Risk counts for summary bar
  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { at_risk: 0, cooling: 0, active: 0, new: 0, inactive: 0 }
    for (const u of allUsers) {
      counts[u.risk] = (counts[u.risk] || 0) + 1
    }
    return counts
  }, [allUsers])

  function renderExpanded(row: Record<string, unknown>) {
    const userId = String(row.clerk_id)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '8px 24px', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--admin-ink-secondary)' }}>
          <span>Clerk ID: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--admin-ink)' }}>{userId}</strong></span>
          <span>Sessions: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--admin-ink)' }}>{String(row.session_count)}</strong></span>
          <span>Total paid: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--admin-ink)' }}>₹{String(row.total_paid_rupees)}</strong></span>
        </div>

        {actionError && (
          <div style={{ fontSize: 12, color: 'var(--admin-red)', fontFamily: 'var(--font-sans)' }}>{actionError}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {(['reset_quota', 'set_pro', 'set_free'] as ActionKey[]).map(action => {
            const busy = actionLoading === `${userId}:${action}`
            return (
              <button
                key={action}
                disabled={!!actionLoading}
                onClick={() => requestAction(userId, action)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  fontSize: 11,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  border: '1px solid var(--admin-border)',
                  borderRadius: 4,
                  background: 'var(--admin-card-bg)',
                  color: DESTRUCTIVE.has(action) ? 'var(--admin-red)' : 'var(--admin-ink)',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading && !busy ? 0.5 : 1,
                }}
              >
                {busy ? 'Working...' : ACTION_LABELS[action]}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Risk badge colour tokens — scoped inline to avoid touching globals.css */}
      <style>{`
        .admin-shell {
          --risk-at-risk-bg: #FCEBEB; --risk-at-risk-text: #A32D2D; --risk-at-risk-border: #F09595;
          --risk-cooling-bg: #FAEEDA; --risk-cooling-text: #854F0B; --risk-cooling-border: #EF9F27;
          --risk-active-bg:  #EAF3DE; --risk-active-text:  #3B6D11; --risk-active-border:  #97C459;
          --risk-new-bg:     #E6F1FB; --risk-new-text:     #185FA5; --risk-new-border:     #85B7EB;
          --risk-inactive-bg:#F1EFE8; --risk-inactive-text:#5F5E5A; --risk-inactive-border:#D3D1C7;
        }
      `}</style>

      <AdminPageHeader title="Users" subtitle={`${data?.total ?? 0} total`} />

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 320,
            height: 32,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            border: '1px solid var(--admin-border)',
            borderRadius: 4,
            background: 'var(--admin-card-bg)',
            color: 'var(--admin-ink)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            height: 32,
            padding: '0 14px',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            border: '1px solid var(--admin-border)',
            borderRadius: 4,
            background: 'var(--admin-card-bg)',
            color: 'var(--admin-ink)',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </form>

      {/* Summary bar */}
      {!loading && allUsers.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginBottom: 10 }}>
          {(Object.entries(riskCounts) as [RiskLevel, number][])
            .filter(([, n]) => n > 0)
            .map(([risk, n], i, arr) => (
              <span key={risk}>
                <span style={{ color: RISK_CONFIG[risk].text }}>{n}</span>
                {' '}{RISK_CONFIG[risk].label.toLowerCase()}
                {i < arr.length - 1 && <span style={{ margin: '0 6px' }}>&middot;</span>}
              </span>
            ))}
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            style={{
              height: 28,
              padding: '0 12px',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              fontWeight: 400,
              border: '1px solid var(--admin-border)',
              borderRadius: 6,
              background: activeFilter === f ? 'var(--admin-ink)' : 'var(--admin-card-bg)',
              color: activeFilter === f ? 'var(--admin-page-bg)' : 'var(--admin-ink)',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
          >
            {FILTER_LABELS[f]}
            {f !== 'all' && riskCounts[f] > 0 && (
              <span style={{ marginLeft: 5, fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7 }}>
                {riskCounts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <AdminTable
          loading={loading}
          keyField="clerk_id"
          pageSize={20}
          expandedId={expandedId}
          onExpand={setExpandedId}
          renderExpanded={renderExpanded}
          columns={[
            { key: 'name', label: 'Name', sortable: true, width: '120px' },
            { key: 'email', label: 'Email', sortable: true },
            {
              key: 'plan',
              label: 'Plan',
              sortable: true,
              width: '100px',
              render: v => fmtPlan(String(v)),
            },
            {
              key: 'sessions_used',
              label: 'Sessions',
              mono: true,
              width: '110px',
              render: (_, row) => {
                const used = Number(row.sessions_used)
                const plan = String(row.plan ?? '')
                const isPro = plan === 'pro_monthly' || plan === 'pro_yearly'
                const quota = row.session_quota
                if (isPro || quota === null) return `${used} / Unlimited`
                return `${used} / ${quota}`
              },
            },
            {
              key: 'last_active',
              label: 'Last Active',
              sortable: true,
              width: '110px',
              render: v => v ? fmtDate(String(v)) : '—',
            },
            {
              key: 'risk',
              label: 'Status',
              sortable: true,
              width: '90px',
              render: v => {
                const cfg = RISK_CONFIG[v as RiskLevel]
                if (!cfg) return String(v)
                return (
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 400,
                    background: cfg.bg,
                    color: cfg.text,
                    border: `1px solid ${cfg.border}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {cfg.label}
                  </span>
                )
              },
            },
            {
              key: 'created_at',
              label: 'Joined',
              sortable: true,
              width: '110px',
              render: v => fmtDate(String(v)),
            },
            {
              key: 'total_paid_rupees',
              label: 'Total Paid',
              mono: true,
              sortable: true,
              width: '90px',
              render: v => `₹${Number(v).toLocaleString('en-IN')}`,
            },
          ]}
          rows={filteredUsers as unknown as Record<string, unknown>[]}
        />
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setConfirm(null)}
        >
          <div
            style={{
              background: 'var(--admin-card-bg)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              padding: '24px 28px',
              minWidth: 300,
              maxWidth: 400,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 400, fontFamily: 'var(--font-display)', marginBottom: 8, color: 'var(--admin-ink)' }}>
              Confirm action
            </div>
            <div style={{ fontSize: 13, color: 'var(--admin-ink-secondary)', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
              Run <strong>{ACTION_LABELS[confirm.action]}</strong> on this user? This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirm(null)}
                style={{ height: 28, padding: '0 14px', fontSize: 12, fontFamily: 'var(--font-sans)', border: '1px solid var(--admin-border)', borderRadius: 4, background: 'transparent', color: 'var(--admin-muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => execAction(confirm.userId, confirm.action)}
                style={{ height: 28, padding: '0 14px', fontSize: 12, fontFamily: 'var(--font-sans)', border: 'none', borderRadius: 4, background: 'var(--admin-red)', color: '#fff', cursor: 'pointer' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
