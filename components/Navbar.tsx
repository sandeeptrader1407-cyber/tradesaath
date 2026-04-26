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

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <div
        className="nav-initials"
        title={user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? ''}
      >
        {initials(user?.fullName ?? user?.firstName)}
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
        <Link
          href="/settings"
          className={`nav-app-link${pathname === '/settings' ? ' nav-active' : ''}`}
        >
          Settings
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
  const navBorder = useTransform(borderOpacity, (v) => `1px solid rgba(229,226,217,${v})`)

  return (
    <>
      <motion.nav style={{ borderBottom: navBorder }}>
        <Link className="nav-logo" href="/">TradeSaath</Link>

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
