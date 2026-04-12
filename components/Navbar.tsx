"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/nextjs'
import ClerkErrorBoundary from './ClerkErrorBoundary'
import { usePlan } from '@/lib/hooks/usePlan'

function ClerkAuthButtons() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <UserButton />
      </>
    )
  }

  return (
    <>
      <SignInButton mode="redirect">
        <button className="btn btn-ghost btn-sm nav-auth-btn">Sign In</button>
      </SignInButton>
      <SignUpButton mode="redirect">
        <button className="btn btn-accent btn-sm nav-getstarted-btn">Get Started</button>
      </SignUpButton>
    </>
  )
}

function ClerkMobileAuth({ closeMenu }: { closeMenu: () => void }) {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded || isSignedIn) return null

  return (
    <Link href="/sign-in" onClick={closeMenu} className="nav-signin-link">Sign In</Link>
  )
}

function NavLinks() {
  const { isSignedIn, isLoaded } = useUser()
  const pathname = usePathname()
  const { isPro, isPaid } = usePlan()

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" className={`nav-app-link${pathname === '/dashboard' ? ' nav-active' : ''}`}>{'\uD83D\uDCCA'} Dashboard</Link>
        <Link href={isPaid ? '/journal' : '#'} className={`nav-app-link${pathname === '/journal' ? ' nav-active' : ''}${!isPaid ? ' opacity-50' : ''}`}>
          {'\uD83D\uDCD3'} Journal{!isPaid && ' \uD83D\uDD12'}
        </Link>
        <Link href={isPaid ? '/journey' : '#'} className={`nav-app-link${pathname === '/journey' ? ' nav-active' : ''}${!isPaid ? ' opacity-50' : ''}`}>
          {'\uD83D\uDDFA\uFE0F'} Journey{!isPaid && ' \uD83D\uDD12'}
        </Link>
        <Link href={isPro ? '/coach' : '#'} className={`nav-app-link${pathname === '/coach' ? ' nav-active' : ''}${!isPro ? ' opacity-50' : ''}`}>
          {'\uD83E\uDD1D'} Saathi{!isPro && ' \uD83D\uDD12'}
        </Link>
      </>
    )
  }

  return (
    <>
      <a href="#how" className="nav-landing-link">How It Works</a>
      <a href="#features" className="nav-landing-link">Features</a>
      <a href="#pricing" className="nav-landing-link">Pricing</a>
      <a href="#faq" className="nav-landing-link">FAQ</a>
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
        <Link href="/dashboard" onClick={closeMenu} className="nav-app-link">{'\uD83D\uDCCA'} Dashboard</Link>
        <Link href={isPaid ? '/journal' : '#'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-50' : ''}`}>
          {'\uD83D\uDCD3'} Journal{!isPaid && ' \uD83D\uDD12'}
        </Link>
        <Link href={isPaid ? '/journey' : '#'} onClick={closeMenu} className={`nav-app-link${!isPaid ? ' opacity-50' : ''}`}>
          {'\uD83D\uDDFA\uFE0F'} Journey{!isPaid && ' \uD83D\uDD12'}
        </Link>
        <Link href={isPro ? '/coach' : '#'} onClick={closeMenu} className={`nav-app-link${!isPro ? ' opacity-50' : ''}`}>
          {'\uD83E\uDD1D'} Saathi{!isPro && ' \uD83D\uDD12'}
        </Link>
      </>
    )
  }

  return (
    <>
      <a href="#how" onClick={closeMenu} className="nav-landing-link">How It Works</a>
      <a href="#features" onClick={closeMenu} className="nav-landing-link">Features</a>
      <a href="#pricing" onClick={closeMenu} className="nav-landing-link">Pricing</a>
      <a href="#faq" onClick={closeMenu} className="nav-landing-link">FAQ</a>
    </>
  )
}

function LogoLink() {
  // Per V12 spec: logo always goes to landing page (goHome behavior)
  return (
    <Link className="nav-logo" href="/">
      TradeSaath<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3ee8c4', marginLeft: 6, animation: 'pulse-dot 2s ease-in-out infinite', verticalAlign: 'middle' }} />
    </Link>
  )
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDayMode, setIsDayMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'day') {
      document.body.classList.add('day')
      setIsDayMode(true)
    }
  }, [])

  function toggleTheme() {
    const isDay = document.body.classList.toggle('day')
    setIsDayMode(isDay)
    localStorage.setItem('theme', isDay ? 'day' : 'night')
  }

  function toggleMenu() {
    setMenuOpen((prev) => !prev)
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
      <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }`}</style>
      <nav>
        <LogoLink />
        <div className="nav-links">
          <ClerkErrorBoundary fallback={
            <>
              <a href="#how" className="nav-landing-link">How It Works</a>
              <a href="#features" className="nav-landing-link">Features</a>
              <a href="#pricing" className="nav-landing-link">Pricing</a>
              <a href="#faq" className="nav-landing-link">FAQ</a>
            </>
          }>
            <NavLinks />
          </ClerkErrorBoundary>
        </div>
        <div className="nav-right">
          <button className="theme-btn" onClick={toggleTheme}>
            <span>{isDayMode ? '☀️' : '🌙'}</span>
            <span>{isDayMode ? 'Night' : 'Day'}</span>
          </button>

          <ClerkErrorBoundary
            fallback={
              <>
                <Link href="/sign-in" className="btn btn-ghost btn-sm nav-auth-btn">Sign In</Link>
                <Link href="/sign-up" className="btn btn-accent btn-sm nav-getstarted-btn">Get Started</Link>
              </>
            }
          >
            <ClerkAuthButtons />
          </ClerkErrorBoundary>

          <button
            className={`hamburger${menuOpen ? ' open' : ''}`}
            onClick={toggleMenu}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <ClerkErrorBoundary fallback={
          <>
            <a href="#how" onClick={closeMenu} className="nav-landing-link">How It Works</a>
            <a href="#features" onClick={closeMenu} className="nav-landing-link">Features</a>
            <a href="#pricing" onClick={closeMenu} className="nav-landing-link">Pricing</a>
            <a href="#faq" onClick={closeMenu} className="nav-landing-link">FAQ</a>
          </>
        }>
          <MobileNavLinks closeMenu={closeMenu} />
        </ClerkErrorBoundary>
        <ClerkErrorBoundary>
          <ClerkMobileAuth closeMenu={closeMenu} />
        </ClerkErrorBoundary>
      </div>
    </>
  )
}
