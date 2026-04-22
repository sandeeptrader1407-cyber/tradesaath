'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminTable from '@/components/admin/AdminTable'

interface AdminUser {
  clerk_id: string
  email: string
  name: string
  plan: string
  session_quota: number | null
  sessions_used: number
  session_count: number
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
      <AdminPageHeader title="Users" subtitle={`${data?.total ?? 0} total`} />

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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

      <AdminTable
        loading={loading}
        keyField="clerk_id"
        pageSize={20}
        expandedId={expandedId}
        onExpand={setExpandedId}
        renderExpanded={renderExpanded}
        columns={[
          { key: 'name', label: 'Name', sortable: true },
          { key: 'email', label: 'Email', sortable: true },
          { key: 'plan', label: 'Plan', sortable: true },
          {
            key: 'sessions_used',
            label: 'Sessions Used/Quota',
            mono: true,
            render: (_, row) => {
              const used = Number(row.sessions_used)
              const quota = row.session_quota
              return quota != null ? `${used} / ${quota}` : `${used} / —`
            },
          },
          {
            key: 'created_at',
            label: 'Joined',
            sortable: true,
            render: v => fmtDate(String(v)),
          },
          {
            key: 'total_paid_rupees',
            label: 'Total Paid',
            mono: true,
            sortable: true,
            render: v => `₹${Number(v).toLocaleString('en-IN')}`,
          },
        ]}
        rows={(data?.users ?? []) as unknown as Record<string, unknown>[]}
      />

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
