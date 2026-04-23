'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useClerk } from '@clerk/nextjs'
import Link from 'next/link'

interface SettingsData {
  plan: string
  session_quota: number | null
  sessions_used: number
  plan_expires_at: string | null
  plan_started_at: string | null
  session_count: number
}

const PLAN_LABELS: Record<string, string> = {
  free:        'Free',
  single:      'Starter',
  pro_monthly: 'Pro Monthly',
  pro_yearly:  'Pro Yearly',
}

function planLabel(plan: string) {
  return PLAN_LABELS[plan] ?? plan
}

function planBadgeStyle(plan: string): React.CSSProperties {
  if (plan === 'pro_monthly' || plan === 'pro_yearly') {
    return {
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      background: 'rgba(29,158,117,.1)',
      color: 'var(--color-profit)',
      border: '0.5px solid rgba(29,158,117,.3)',
    }
  }
  if (plan === 'single') {
    return {
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      background: 'rgba(15,76,129,.08)',
      color: 'var(--accent)',
      border: '0.5px solid rgba(15,76,129,.25)',
    }
  }
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    fontWeight: 400,
    background: 'var(--color-border)',
    color: 'var(--color-muted)',
    border: '0.5px solid var(--color-border)',
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Two-column row — collapses to single column on mobile via .settings-row class
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row" style={{
      display: 'flex',
      gap: 24,
      padding: '14px 0',
      borderBottom: '0.5px solid var(--color-border)',
      alignItems: 'flex-start',
    }}>
      <div className="settings-label" style={{
        width: 200,
        flexShrink: 0,
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        fontWeight: 400,
        color: 'var(--color-muted)',
        paddingTop: 2,
      }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

// Section card with a title header
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 10,
      border: '0.5px solid var(--color-border)',
      background: '#FFFFFF',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--color-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--color-ink)',
          margin: 0,
        }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: '0 20px' }}>
        {children}
      </div>
    </div>
  )
}

// Read-only value display
function ReadValue({ value }: { value: string }) {
  return (
    <span style={{
      fontSize: 14,
      fontFamily: 'var(--font-sans)',
      fontWeight: 400,
      color: 'var(--color-ink)',
    }}>
      {value}
    </span>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/settings')
      .then(r => r.json())
      .then(d => { setSettings(d); setLoadingSettings(false) })
      .catch(() => setLoadingSettings(false))
  }, [])

  if (!isLoaded) {
    return (
      <main style={{ minHeight: '100vh', paddingTop: 80, background: 'var(--color-canvas)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      </main>
    )
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setDeleteError(data.error || 'Deletion failed'); return }
      // Clerk user is gone — sign out client-side and redirect
      await signOut()
      router.push('/')
    } catch {
      setDeleteError('Network error. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const displayName = user?.fullName
    || user?.firstName
    || user?.primaryEmailAddress?.emailAddress?.split('@')[0]
    || '—'
  const email = user?.primaryEmailAddress?.emailAddress || '—'

  const plan = settings?.plan ?? 'free'
  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly'
  const isPaid = plan !== 'free'

  const sessionsText = settings
    ? settings.session_quota !== null
      ? `${settings.sessions_used} / ${settings.session_quota} sessions used`
      : `${settings.sessions_used} sessions (unlimited)`
    : '—'

  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-ink)',
  }

  const btnBase: React.CSSProperties = {
    height: 36,
    padding: '0 16px',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    fontWeight: 400,
    cursor: 'pointer',
    border: '0.5px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-ink)',
    transition: 'background 0.1s',
  }

  return (
    <main style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 64, background: 'var(--color-canvas)' }}>
      {/* Responsive row collapse */}
      <style>{`
        @media(max-width:600px){
          .settings-row{flex-direction:column;gap:6px}
          .settings-label{width:auto!important}
        }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        {/* Page header */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 400,
          color: 'var(--color-ink)',
          marginBottom: 28,
        }}>
          Settings
        </h1>

        {/* ── SECTION 1: Account ── */}
        <Section title="Account">
          <Row label="Name">
            {loadingSettings
              ? <span style={{ ...valueStyle, color: 'var(--color-muted)' }}>—</span>
              : <ReadValue value={displayName} />
            }
          </Row>
          <Row label="Email">
            <ReadValue value={email} />
          </Row>
        </Section>

        {/* ── SECTION 2: Plan ── */}
        <Section title="Plan">
          <Row label="Current plan">
            {loadingSettings
              ? <span style={{ ...valueStyle, color: 'var(--color-muted)' }}>—</span>
              : <span style={planBadgeStyle(plan)}>{planLabel(plan)}</span>
            }
          </Row>

          <Row label="Sessions">
            <span style={{ ...valueStyle, fontFamily: 'var(--font-mono)' }}>
              {loadingSettings ? '—' : sessionsText}
            </span>
          </Row>

          {settings?.plan_expires_at && (
            <Row label="Expires">
              <span style={{ ...valueStyle, fontFamily: 'var(--font-mono)' }}>
                {fmtDate(settings.plan_expires_at)}
              </span>
            </Row>
          )}

          {!isPro && (
            <Row label="Upgrade">
              <Link
                href="/#pricing"
                style={{
                  display: 'inline-block',
                  height: 36,
                  lineHeight: '36px',
                  padding: '0 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 400,
                  background: 'var(--accent)',
                  color: 'var(--color-canvas)',
                  textDecoration: 'none',
                }}
              >
                View plans &rarr;
              </Link>
            </Row>
          )}
        </Section>

        {/* ── SECTION 3: Data ── */}
        <Section title="Data">
          <Row label="Export sessions">
            <div>
              <a
                href="/api/user/export"
                download
                style={{
                  ...btnBase,
                  display: 'inline-block',
                  lineHeight: '34px',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-canvas)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Export as CSV
              </a>
              <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginTop: 6 }}>
                Downloads all your sessions as a CSV file.
              </p>
            </div>
          </Row>

          <Row label="Delete account">
            <div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  ...btnBase,
                  borderColor: 'rgba(192,57,43,.3)',
                  color: 'var(--color-loss)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Delete my account
              </button>
              <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', marginTop: 6 }}>
                Permanently removes all your data. This cannot be undone.
              </p>
            </div>
          </Row>
        </Section>
      </div>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '0.5px solid var(--color-border)',
              borderRadius: 10,
              padding: '28px 28px',
              maxWidth: 420,
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 400,
              color: 'var(--color-ink)',
              margin: '0 0 10px',
            }}>
              Delete account
            </h3>
            <p style={{ fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--color-muted)', lineHeight: 1.65, margin: '0 0 20px' }}>
              This will permanently delete your account, all sessions, trades,
              analysis, and journal data. This action cannot be undone.
            </p>

            {deleteError && (
              <div style={{
                fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-loss)',
                background: 'rgba(192,57,43,.06)', border: '0.5px solid rgba(192,57,43,.2)',
                borderRadius: 6, padding: '8px 12px', marginBottom: 16,
              }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  ...btnBase,
                  opacity: deleting ? 0.5 : 1,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = 'var(--color-canvas)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  height: 36, padding: '0 16px', borderRadius: 6, border: 'none',
                  background: deleting ? 'var(--color-border)' : 'var(--color-loss)',
                  color: deleting ? 'var(--color-muted)' : '#FFFFFF',
                  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 400,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
