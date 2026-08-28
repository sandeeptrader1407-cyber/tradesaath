"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { SignUpButton, useUser, useClerk } from '@clerk/nextjs'
import ClerkErrorBoundary from './ClerkErrorBoundary'
import { usePlan } from '@/lib/planStore'
import { useScroll, useTransform, motion } from 'framer-motion'

/* ─── Helpers ─────────────────────────────────────────────────────── */

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Single source of truth for the public nav — add a line here to add an item.
// These are marketing anchors, identical for every visitor, so nothing that
// renders them may depend on auth state.
const NAV_LINKS = [
  { label: 'How it works',    href: '/#how' },
  { label: 'What it detects', href: '/patterns' },
  { label: 'Markets',         href: '/#markets' },
  { label: 'The report',      href: '/results' },
  { label: 'Pricing',         href: '/#pricing' },
  { label: 'FAQ',             href: '/#faq' },
] as const

const INSTRUMENTS = ['Equities', 'Options', 'Futures', 'Forex', 'Commodities', 'Crypto'] as const

// If Clerk hasn't resolved isLoaded within this window (blocked by an ad
// blocker, network trouble, or just slow), stop waiting and render the
// signed-out auth UI instead of leaving the slot blank forever.
const AUTH_FAILOPEN_MS = 2500

/* ─── Auth resolution (fails open) ───────────────────────────────────
   The only thing in this file that waits on Clerk. Everything else —
   the public nav links, the instrument strip, the logo — renders with
   zero dependency on this. ──────────────────────────────────────── */

function useAuthState() {
  const { isSignedIn, isLoaded, user } = useUser()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (isLoaded) return
    const t = window.setTimeout(() => setTimedOut(true), AUTH_FAILOPEN_MS)
    return () => window.clearTimeout(t)
  }, [isLoaded])

  const resolved = isLoaded || timedOut
  // Once we've given up waiting (timed out without ever loading), treat the
  // visitor as signed-out rather than stalling the UI indefinitely.
  const signedIn = isLoaded ? !!isSignedIn : false

  return { resolved, signedIn, user }
}

/* ─── Public nav links — no auth dependency, same for everyone ──────── */

function PublicNavLinks({ onLinkClick }: { onLinkClick?: () => void }) {
  return (
    <>
      {NAV_LINKS.map(({ label, href }) => (
        <Link key={label} href={href} onClick={onLinkClick} className="nav-landing-link">{label}</Link>
      ))}
    </>
  )
}

/* ─── Auth slot (desktop) ─────────────────────────────────────────── */

function AuthSlot() {
  const { resolved, signedIn, user } = useAuthState()
  const { signOut } = useClerk()
  const router = useRouter()
  const pathname = usePathname()
  const { isPro, isPaid } = usePlan()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('[data-avatar-dropdown]')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // While Clerk is still resolving, reserve the space a resolved state would
  // take so nothing shifts once it settles — never render nothing.
  if (!resolved) {
    return <div className="nav-auth-placeholder" aria-hidden="true" />
  }

  if (signedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link
          href="/dashboard"
          className={`nav-app-link${pathname === '/dashboard' ? ' nav-active' : ''}`}
        >
          Dashboard
        </Link>

        {/* Avatar with dropdown */}
        <div data-avatar-dropdown="" style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(p => !p)}
            className="nav-initials"
            style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
            title={user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''}
          >
            {initials(user?.fullName ?? user?.firstName)}
          </button>

          {open && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 200,
              background: '#FFFFFF',
              border: '0.5px solid #E2E8F0',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              minWidth: 200,
              overflow: 'hidden',
            }}>
              {/* User info */}
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F1F5F9' }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  fontWeight: 500, color: '#0F172A', marginBottom: 2,
                }}>
                  {user?.fullName ?? user?.firstName ?? 'Trader'}
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11,
                  color: '#94A3B8',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', maxWidth: 168,
                }}>
                  {user?.primaryEmailAddress?.emailAddress}
                </div>
              </div>

              {[
                { label: 'Journal', href: isPaid ? '/journal' : '/pricing' },
                { label: 'Journey', href: isPaid ? '/journey' : '/pricing' },
                { label: 'Saathi',  href: isPro ? '/coach' : '/pricing' },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    fontFamily: 'var(--font-sans)', fontSize: 13,
                    color: '#374151', textDecoration: 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {label}
                </Link>
              ))}

              {/* Settings */}
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  color: '#374151', textDecoration: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
                    stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M14.25 9c0 .31-.03.61-.08.9l1.95 1.52-.9 1.56-2.29-.77a5.24 5.24 0 0 1-1.56.9l-.37 2.39h-1.8l-.37-2.39a5.24 5.24 0 0 1-1.56-.9l-2.29.77-.9-1.56 1.95-1.52A5.3 5.3 0 0 1 6 9c0-.31.03-.61.08-.9L4.13 6.58l.9-1.56 2.29.77a5.24 5.24 0 0 1 1.56-.9L9.25 2.6h1.8l.37 2.39c.56.22 1.08.52 1.56.9l2.29-.77.9 1.56-1.95 1.52c.05.29.08.59.08.9Z"
                    stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Settings
              </Link>

              <div style={{ height: '0.5px', background: '#F1F5F9' }} />

              {/* Sign out */}
              <button
                onClick={() => {
                  setOpen(false)
                  signOut().then(() => router.push('/'))
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 16px',
                  fontFamily: 'var(--font-sans)', fontSize: 13,
                  color: '#DC2626', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                    stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="16 17 21 12 16 7"
                    stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="21" y1="12" x2="9" y2="12"
                    stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Resolved and signed out — same UI covers a real "signed out" answer and
  // the fail-open (timed out without ever loading) case.
  return (
    <>
      <Link href="/sign-in" className="nav-auth-btn">Sign in</Link>
      <SignUpButton mode="redirect">
        <button className="nav-getstarted-btn">Start free</button>
      </SignUpButton>
    </>
  )
}

/* ─── Auth slot (mobile) ──────────────────────────────────────────── */

function MobileAuthSlot({ closeMenu }: { closeMenu: () => void }) {
  const { resolved, signedIn } = useAuthState()
  const { signOut } = useClerk()
  const router = useRouter()
  const { isPro, isPaid } = usePlan()

  if (!resolved) {
    return <div className="mobile-auth-placeholder" aria-hidden="true" />
  }

  if (signedIn) {
    return (
      <>
        <Link href="/dashboard" onClick={closeMenu} className="nav-app-link">Dashboard</Link>
        <Link href={isPaid ? '/journal' : '/pricing'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-60' : ''}`}>Journal</Link>
        <Link href={isPaid ? '/journey' : '/pricing'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-60' : ''}`}>Journey</Link>
        <Link href={isPro ? '/coach' : '/pricing'} onClick={closeMenu} className={`nav-app-link${!isPro ? ' opacity-60' : ''}`}>Saathi</Link>
        <Link href="/settings" onClick={closeMenu} className="nav-app-link">Settings</Link>
        <button
          onClick={() => { closeMenu(); signOut().then(() => router.push('/')) }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 16,
            color: '#DC2626', padding: '16px 24px',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}
        >
          Sign out
        </button>
      </>
    )
  }

  return (
    <Link href="/sign-in" onClick={closeMenu} className="nav-signin-link">
      Sign in
    </Link>
  )
}

/* ─── Navbar ──────────────────────────────────────────────────────── */

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const isLanding = pathname === '/'
  const { scrollY } = useScroll()
  const borderOpacity = useTransform(scrollY, [0, 20], [0, 1])
  const navBorder = useTransform(borderOpacity, (v) => `0.5px solid rgba(209,213,219,${v})`)

  return (
    <>
      <motion.nav style={{ borderBottom: navBorder }}>
        <Link
          className="nav-logo"
          href="/"
          aria-label="tradesaath — home"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em' }}
        >
          <img src="/brand/icon.svg" alt="" width={24} height={24} aria-hidden="true" />
          <span>TradeSaath</span>
        </Link>

        <div className="nav-links">
          <PublicNavLinks />
        </div>

        <div className="nav-right">
          <ClerkErrorBoundary fallback={
            <>
              <Link href="/sign-in"  className="nav-auth-btn">Sign in</Link>
              <Link href="/sign-up"  className="nav-getstarted-btn">Start free</Link>
            </>
          }>
            <AuthSlot />
          </ClerkErrorBoundary>

          <button
            className={`hamburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </motion.nav>

      {isLanding && (
        <div className="instruments">
          <div className="inst-in">
            {INSTRUMENTS.map((label) => (
              <span key={label}>{label}</span>
            ))}
            <span className="inst-note">detected automatically from your file</span>
          </div>
        </div>
      )}

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <PublicNavLinks onLinkClick={() => setMenuOpen(false)} />
        <ClerkErrorBoundary fallback={
          <Link href="/sign-in" onClick={() => setMenuOpen(false)} className="nav-signin-link">
            Sign in
          </Link>
        }>
          <MobileAuthSlot closeMenu={() => setMenuOpen(false)} />
        </ClerkErrorBoundary>
      </div>
    </>
  )
}
