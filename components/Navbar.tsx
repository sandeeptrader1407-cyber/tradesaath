"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignUpButton, useUser } from '@clerk/nextjs'
import ClerkErrorBoundary from './ClerkErrorBoundary'
import { usePlan } from '@/lib/planStore'
import { useScroll, useTransform, motion } from 'framer-motion'

/* ─── Helpers ─────────────────────────────────────────────────────── */

function initials(name: string | null | undefined): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ─── Auth buttons ────────────────────────────────────────────────── */

function ClerkAuthButtons() {
  const { isSignedIn, isLoaded, user } = useUser()
  const pathname = usePathname()

  if (!isLoaded) return null

  if (isSignedIn) {
    const onSettings = pathname === '/settings'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Settings gear icon */}
        <Link href="/settings" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 6, textDecoration: 'none',
          color: onSettings ? 'var(--color-ink)' : 'var(--color-muted)',
          transition: 'color 0.15s',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-label="Settings">
            <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M14.25 9c0 .31-.03.61-.08.9l1.95 1.52-.9 1.56-2.29-.77a5.24 5.24 0 0 1-1.56.9l-.37 2.39h-1.8l-.37-2.39a5.24 5.24 0 0 1-1.56-.9l-2.29.77-.9-1.56 1.95-1.52A5.3 5.3 0 0 1 6 9c0-.31.03-.61.08-.9L4.13 6.58l.9-1.56 2.29.77a5.24 5.24 0 0 1 1.56-.9L9.25 2.6h1.8l.37 2.39c.56.22 1.08.52 1.56.9l2.29-.77.9 1.56-1.95 1.52c.05.29.08.59.08.9Z"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        {/* SA avatar — links to settings */}
        <Link
          href="/settings"
          className="nav-initials"
          title={user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''}
          style={{ textDecoration: 'none' }}
        >
          {initials(user?.fullName ?? user?.firstName)}
        </Link>
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
        <Link
          href="/dashboard"
          className={`nav-app-link${pathname === '/dashboard' ? ' nav-active' : ''}`}
        >
          Dashboard
        </Link>
        <Link
          href={isPaid ? '/journal' : '#'}
          className={`nav-app-link${pathname === '/journal' ? ' nav-active' : ''}${!isPaid ? ' opacity-50 cursor-not-allowed' : ''}`}
        >
          Journal
        </Link>
        <Link
          href={isPaid ? '/journey' : '#'}
          className={`nav-app-link${pathname === '/journey' ? ' nav-active' : ''}${!isPaid ? ' opacity-50 cursor-not-allowed' : ''}`}
        >
          Journey
        </Link>
        <Link
          href={isPro ? '/coach' : '#'}
          className={`nav-app-link${pathname === '/coach' ? ' nav-active' : ''}${!isPro ? ' opacity-50 cursor-not-allowed' : ''}`}
        >
          Saathi
        </Link>
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

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" onClick={closeMenu} className="nav-app-link">Dashboard</Link>
        <Link href={isPaid ? '/journal' : '#'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-50' : ''}`}>Journal</Link>
        <Link href={isPaid ? '/journey' : '#'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-50' : ''}`}>Journey</Link>
        <Link href={isPro ? '/coach' : '#'} onClick={closeMenu} className={`nav-app-link${!isPro ? ' opacity-50' : ''}`}>Saathi</Link>
        <Link href="/settings" onClick={closeMenu} className="nav-app-link">Settings</Link>
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
        <Link className="nav-logo" href="/" style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, letterSpacing: '-0.02em' }}>TradeSaath</Link>

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
