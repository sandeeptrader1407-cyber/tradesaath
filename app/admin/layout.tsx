import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/isAdmin'
import AdminNav from '@/components/admin/AdminNav'

export const metadata = { title: 'Admin — TradeSaath' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  return (
    <div
      className="admin-shell"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--admin-sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo/Header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid rgba(248,246,241,.08)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 400,
              color: 'var(--admin-nav-active)',
              letterSpacing: '.01em',
            }}
          >
            Admin
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(248,246,241,.35)',
              fontFamily: 'var(--font-sans)',
              marginTop: 2,
            }}
          >
            TradeSaath
          </div>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <AdminNav />
        </div>

        {/* Back to app */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(248,246,241,.08)',
          }}
        >
          <Link
            href="/dashboard"
            style={{
              fontSize: 12,
              color: 'rgba(248,246,241,.4)',
              fontFamily: 'var(--font-sans)',
              textDecoration: 'none',
            }}
          >
            Back to app
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          background: 'var(--admin-page-bg)',
          overflow: 'auto',
          padding: '48px 40px 40px 40px',
        }}
      >
        {children}
      </main>
    </div>
  )
}
