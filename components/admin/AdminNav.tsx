'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',           label: 'Overview',  exact: true },
  { href: '/admin/users',     label: 'Users',     exact: false },
  { href: '/admin/retention', label: 'Retention', exact: false },
  { href: '/admin/revenue',   label: 'Revenue',   exact: false },
  { href: '/admin/sessions',  label: 'Sessions',  exact: false },
  { href: '/admin/ai-usage',  label: 'AI Usage',  exact: false },
  { href: '/admin/coupons',   label: 'Coupons',   exact: false },
  { href: '/admin/flags',     label: 'Flags',     exact: false },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    // Use div instead of nav — the global CSS rule `nav { position: fixed; ... }`
    // would rip a <nav> out of the sidebar flex layout and overlay it on the page.
    <div role="navigation" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0' }}>
      {NAV.map(item => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 400,
              fontFamily: 'var(--font-sans)',
              color: active ? 'var(--admin-nav-active)' : 'var(--admin-nav-inactive)',
              textDecoration: 'none',
              borderLeft: active
                ? '3px solid var(--admin-nav-active)'
                : '3px solid transparent',
              background: active ? 'var(--admin-nav-hover)' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => {
              if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--admin-nav-hover)'
            }}
            onMouseLeave={e => {
              if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
