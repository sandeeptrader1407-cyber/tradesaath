'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/nextjs'
import ClerkErrorBoundary from './ClerkErrorBoundary'

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

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" className="nav-app-link">📊 Dashboard</Link>
        <Link href="/upload" className="nav-app-link">📤 Upload</Link>
        <Link href="/journal" className="nav-app-link">📓 Journal</Link>
        <Link href="/coach" className="nav-app-link">🎯 AI Coach</Link>
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

  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" onClick={closeMenu} className="nav-app-link">📊 Dashboard</Link>
        <Link href="/upload" onClick={closeMenu} className="nav-app-link">📤 Upload</Link>
        <Link href="/journal" onClick={closeMenu} className="nav-app-link">📓 Journal</Link>
        <Link href="/coach" onClick={closeMenu} className="nav-app-link">🎯 AI Coach</Link>
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
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return <Link className="nav-logo" href="/"><div className="nav-logo-dot"></div>TradeSaath</Link>

  const href = isSignedIn ? '/dashboard' : '/'

  return (
    <Link className="nav-logo" href={href}>
      <div className="nav-logo-dot"></div>TradeSaath
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
