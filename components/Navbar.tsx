"use client"

import { useState, useRef, useEffect } from 'react'
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

/* ─── Auth buttons ────────────────────────────────────────────────── */

function ClerkAuthButtons() {
  const { isSignedIn, isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Settings gear */}
        <Link href="/settings" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 6, textDecoration: 'none',
          color: pathname === '/settings' ? 'var(--color-ink)' : 'var(--color-muted)',
          transition: 'color 0.15s',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-label="Settings">
            <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M14.25 9c0 .31-.03.61-.08.9l1.95 1.52-.9 1.56-2.29-.77a5.24 5.24 0 0 1-1.56.9l-.37 2.39h-1.8l-.37-2.39a5.24 5.24 0 0 1-1.56-.9l-2.29.77-.9-1.56 1.95-1.52A5.3 5.3 0 0 1 6 9c0-.31.03-.61.08-.9L4.13 6.58l.9-1.56 2.29.77a5.24 5.24 0 0 1 1.56-.9L9.25 2.6h1.8l.37 2.39c.56.22 1.08.52 1.56.9l2.29-.77.9 1.56-1.95 1.52c.05.29.08.59.08.9Z"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

        {/* Avatar with dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(p => !p)}
            className="nav-initials"
            title={user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
          >
            {initials(user?.fullName ?? user?.firstName)}
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#FFFFFF', border: '0.5px solid #E2E8F0',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              minWidth: 180, zIndex: 200, overflow: 'hidden',
            }}>
              {/* User info */}
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #F1F5F9' }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: '#0F172A',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.fullName ?? user?.firstName ?? 'Trader'}
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: 11, color: '#94A3B8', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.primaryEmailAddress?.emailAddress ?? ''}
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '6px 0' }}>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', textDecoration: 'none',
                    fontFamily: 'var(--font-sans)', fontSize: 13, color: '#0F172A',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M14.25 9c0 .31-.03.61-.08.9l1.95 1.52-.9 1.56-2.29-.77a5.24 5.24 0 0 1-1.56.9l-.37 2.39h-1.8l-.37-2.39a5.24 5.24 0 0 1-1.56-.9l-2.29.77-.9-1.56 1.95-1.52A5.3 5.3 0 0 1 6 9c0-.31.03-.61.08-.9L4.13 6.58l.9-1.56 2.29.77a5.24 5.24 0 0 1 1.56-.9L9.25 2.6h1.8l.37 2.39c.56.22 1.08.52 1.56.9l2.29-.77.9 1.56-1.95 1.52c.05.29.08.59.08.9Z" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  Settings
                </Link>

                <div style={{ height: '0.5px', background: '#F1F5F9', margin: '4px 0' }} />

                <button
                  onClick={() => { setMenuOpen(false); signOut(() => router.push('/')) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontSize: 13, color: '#DC2626',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Link href="/sign-in" className="nav-auth-btn">Sign in</Link>
      <SignUpButton mode="redirect">
        <button className="nav-getstarted-btn">Get started</button>
      </SignUpButton>
    </>
  )
}

function ClerkMobileAuth({ closeMenu }: { closeMenu: () => void }) {
  const { isSignedIn, isLoaded } = useUser()
  if (!isLoaded || isSignedIn) return null
  return (
    <Link href="/sign-in" onClick={closeMenu} className="nav-signin-link">
      Sign in
    </Link>
  )
}

/* ─── Nav links ───────────────────────────────────────────────────── */

function NavLinks() {
  const { isSignedIn, isLoaded } = useUser()
  const pathname = usePathname()
  const { isPro, isPaid } = usePlan()

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" className={`nav-app-link${pathname === '/dashboard' ? ' nav-active' : ''}`}>Dashboard</Link>
        <Link href={isPaid ? '/journal' : '#'} className={`nav-app-link${pathname === '/journal' ? ' nav-active' : ''}${!isPaid ? ' opacity-50 cursor-not-allowed' : ''}`}>Journal</Link>
        <Link href={isPaid ? '/journey' : '#'} className={`nav-app-link${pathname === '/journey' ? ' nav-active' : ''}${!isPaid ? ' opacity-50 cursor-not-allowed' : ''}`}>Journey</Link>
        <Link href={isPro ? '/coach' : '#'} className={`nav-app-link${pathname === '/coach' ? ' nav-active' : ''}${!isPro ? ' opacity-50 cursor-not-allowed' : ''}`}>Saathi</Link>
      </>
    )
  }

  return (
    <>
      <a href="#how"      className="nav-landing-link">How it works</a>
      <a href="#features" className="nav-landing-link">Features</a>
      <a href="#pricing"  className="nav-landing-link">Pricing</a>
      <a href="#faq"      className="nav-landing-link">FAQ</a>
    </>
  )
}

function MobileNavLinks({ closeMenu }: { closeMenu: () => void }) {
  const { isSignedIn, isLoaded } = useUser()
  const { isPro, isPaid } = usePlan()
  const { signOut } = useClerk()
  const router = useRouter()

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" onClick={closeMenu} className="nav-app-link">Dashboard</Link>
        <Link href={isPaid ? '/journal' : '#'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-50' : ''}`}>Journal</Link>
        <Link href={isPaid ? '/journey' : '#'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-50' : ''}`}>Journey</Link>
        <Link href={isPro ? '/coach' : '#'} onClick={closeMenu} className={`nav-app-link${!isPro ? ' opacity-50' : ''}`}>Saathi</Link>
        <Link href="/settings" onClick={closeMenu} className="nav-app-link">Settings</Link>
        <button
          onClick={() => { closeMenu(); signOut(() => router.push('/')) }}
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
    <>
      <a href="#how"      onClick={closeMenu} className="nav-landing-link">How it works</a>
      <a href="#features" onClick={closeMenu} className="nav-landing-link">Features</a>
      <a href="#pricing"  onClick={closeMenu} className="nav-landing-link">Pricing</a>
      <a href="#faq"      onClick={closeMenu} className="nav-landing-link">FAQ</a>
    </>
  )
}

/* ─── Navbar ──────────────────────────────────────────────────────── */

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  const borderOpacity = useTransform(scrollY, [0, 20], [0, 1])
  const navBorder = useTransform(borderOpacity, (v) => `0.5px solid rgba(209,213,219,${v})`)

  return (
    <>
      <motion.nav style={{ borderBottom: navBorder }}>
        <Link className="nav-logo" href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em' }}>TradeSaath</Link>

        <div className="nav-links">
          <ClerkErrorBoundary fallback={
            <>
              <a href="#how"      className="nav-landing-link">How it works</a>
              <a href="#features" className="nav-landing-link">Features</a>
              <a href="#pricing"  className="nav-landing-link">Pricing</a>
              <a href="#faq"      className="nav-landing-link">FAQ</a>
            </>
          }>
            <NavLinks />
          </ClerkErrorBoundary>
        </div>

        <div className="nav-right">
          <ClerkErrorBoundary fallback={
            <>
              <Link href="/sign-in"  className="nav-auth-btn">Sign in</Link>
              <Link href="/sign-up"  className="nav-getstarted-btn">Get started</Link>
            </>
          }>
            <ClerkAuthButtons />
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

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <ClerkErrorBoundary fallback={
          <>
            <a href="#how"      onClick={() => setMenuOpen(false)} className="nav-landing-link">How it works</a>
            <a href="#features" onClick={() => setMenuOpen(false)} className="nav-landing-link">Features</a>
            <a href="#pricing"  onClick={() => setMenuOpen(false)} className="nav-landing-link">Pricing</a>
            <a href="#faq"      onClick={() => setMenuOpen(false)} className="nav-landing-link">FAQ</a>
          </>
        }>
          <MobileNavLinks closeMenu={() => setMenuOpen(false)} />
        </ClerkErrorBoundary>
        <ClerkErrorBoundary>
          <ClerkMobileAuth closeMenu={() => setMenuOpen(false)} />
        </ClerkErrorBoundary>
      </div>
    </>
  )
}
