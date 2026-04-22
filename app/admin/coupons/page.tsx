'use client'

import { useEffect, useState } from 'react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminTable from '@/components/admin/AdminTable'

interface Redemption {
  user_id: string
  email: string
  redeemed_at: string
}

interface CouponRow {
  id: string
  code: string
  plan: string
  duration_days: number
  max_uses: number | null
  current_uses: number
  is_active: boolean
  created_at: string
  expires_at: string | null
  redemptions: Redemption[]
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PLAN_OPTIONS = ['pro_monthly', 'pro_yearly', 'single']

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({
    code: '',
    plan: 'pro_monthly',
    duration_days: '30',
    max_uses: '',
    expires_at: '',
  })

  function load() {
    setLoading(true)
    fetch('/api/admin/coupons')
      .then(r => r.json())
      .then(d => { setCoupons(d.coupons ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function toggleActive(id: string, current: boolean) {
    setToggleLoading(id)
    await fetch('/api/admin/coupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    load()
    setToggleLoading(null)
  }

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code.trim(),
        plan: form.plan,
        duration_days: Number(form.duration_days),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
      }),
    })
    const d = await res.json()
    setFormLoading(false)
    if (!res.ok) { setFormError(d.error || 'Failed'); return }
    setShowForm(false)
    setForm({ code: '', plan: 'pro_monthly', duration_days: '30', max_uses: '', expires_at: '' })
    load()
  }

  function renderExpanded(row: Record<string, unknown>) {
    const redemptions = (row.redemptions as Redemption[]) ?? []
    if (!redemptions.length) return <span style={{ fontSize: 12, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>No redemptions yet.</span>
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
          Redemptions
        </div>
        {redemptions.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 20, fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--admin-ink-secondary)', padding: '4px 0', borderBottom: i < redemptions.length - 1 ? '1px solid var(--admin-border)' : 'none' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{r.email}</span>
            <span>{fmtDate(r.redeemed_at)}</span>
          </div>
        ))}
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    height: 32, padding: '0 10px', fontSize: 12, fontFamily: 'var(--font-sans)',
    border: '1px solid var(--admin-border)', borderRadius: 4,
    background: 'var(--admin-card-bg)', color: 'var(--admin-ink)', outline: 'none',
  }

  return (
    <div>
      <AdminPageHeader
        title="Coupons"
        subtitle={`${coupons.length} codes`}
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              height: 32, padding: '0 16px', fontSize: 12,
              fontFamily: 'var(--font-sans)', border: '1px solid var(--admin-border)',
              borderRadius: 4, background: 'var(--admin-ink)', color: 'var(--admin-page-bg)',
              cursor: 'pointer',
            }}
          >
            New Coupon
          </button>
        }
      />

      {showForm && (
        <div style={{ background: 'var(--admin-card-bg)', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '20px 24px', marginBottom: 24, boxShadow: 'var(--admin-shadow)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-ink)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Create Coupon</div>
          <form onSubmit={createCoupon} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Code *</label>
              <input style={{ ...inputStyle, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="BETA2026" required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Plan *</label>
              <select style={inputStyle} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Duration (days) *</label>
              <input style={inputStyle} type="number" min="1" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Max Uses</label>
              <input style={inputStyle} type="number" min="1" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="unlimited" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--admin-muted)', fontFamily: 'var(--font-sans)' }}>Expires At</label>
              <input style={inputStyle} type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" disabled={formLoading} style={{ height: 32, padding: '0 16px', fontSize: 12, fontFamily: 'var(--font-sans)', border: 'none', borderRadius: 4, background: 'var(--admin-accent)', color: '#fff', cursor: 'pointer' }}>
                {formLoading ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: 32, padding: '0 12px', fontSize: 12, fontFamily: 'var(--font-sans)', border: '1px solid var(--admin-border)', borderRadius: 4, background: 'transparent', color: 'var(--admin-muted)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
            {formError && <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--admin-red)', fontFamily: 'var(--font-sans)' }}>{formError}</div>}
          </form>
        </div>
      )}

      <AdminTable
        loading={loading}
        keyField="id"
        expandedId={expandedId}
        onExpand={setExpandedId}
        renderExpanded={renderExpanded}
        columns={[
          { key: 'code', label: 'Code', mono: true, sortable: true },
          { key: 'plan', label: 'Plan', sortable: true },
          {
            key: 'duration_days',
            label: 'Duration',
            mono: true,
            render: v => `${v}d`,
          },
          {
            key: 'current_uses',
            label: 'Uses',
            mono: true,
            sortable: true,
            render: (_, row) => {
              const max = row.max_uses
              return max != null ? `${row.current_uses} / ${max}` : `${row.current_uses} / —`
            },
          },
          {
            key: 'expires_at',
            label: 'Expires',
            sortable: true,
            render: v => fmtDate(v as string | null),
          },
          {
            key: 'is_active',
            label: 'Active',
            render: (v, row) => (
              <button
                disabled={toggleLoading === String(row.id)}
                onClick={e => { e.stopPropagation(); toggleActive(String(row.id), Boolean(v)) }}
                style={{
                  height: 24, padding: '0 10px', fontSize: 11,
                  fontFamily: 'var(--font-sans)', border: '1px solid var(--admin-border)',
                  borderRadius: 4,
                  background: v ? 'var(--admin-accent-dim)' : 'transparent',
                  color: v ? 'var(--admin-accent)' : 'var(--admin-muted)',
                  cursor: 'pointer',
                }}
              >
                {toggleLoading === String(row.id) ? '...' : v ? 'Active' : 'Inactive'}
              </button>
            ),
          },
        ]}
        rows={coupons as unknown as Record<string, unknown>[]}
      />
    </div>
  )
}
