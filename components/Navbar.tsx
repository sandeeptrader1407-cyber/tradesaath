'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/nextjs'

export default function Navbar() {
  const { isSignedIn, isLoaded } = useUser()
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
        <Link className="nav-logo" href="/">
          <div className="nav-logo-dot"></div>TradeSaath
        </Link>
        <div className="nav-links">
          <a href="#how" className="nav-landing-link">How It Works</a>
          <a href="#features" className="nav-landing-link">Features</a>
          <a href="#pricing" className="nav-landing-link">Pricing</a>
          <a href="#faq" className="nav-landing-link">FAQ</a>
        </div>
        <div className="nav-right">
          <button className="theme-btn" onClick={toggleTheme}>
            <span>{isDayMode ? '☀️' : '🌙'}</span>
            <span>{isDayMode ? 'Night' : 'Day'}</span>
          </button>

          {isLoaded && isSignedIn ? (
            <>
              <Link href="/upload" className="btn btn-accent btn-sm">
                Upload Trades
              </Link>
              <UserButton />
            </>
          ) : isLoaded ? (
            <>
              <SignInButton mode="redirect">
                <button className="btn btn-ghost btn-sm nav-auth-btn">Sign In</button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <button className="btn btn-accent btn-sm nav-getstarted-btn">Get Started</button>
              </SignUpButton>
            </>
          ) : null}

          <button
            className={`hamburger${menuOpen ? ' open' : ''}`}
            onClick={toggleMenu}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <a href="#how" onClick={closeMenu} className="nav-landing-link">How It Works</a>
        <a href="#features" onClick={closeMenu} className="nav-landing-link">Features</a>
        <a href="#pricing" onClick={closeMenu} className="nav-landing-link">Pricing</a>
        <a href="#faq" onClick={closeMenu} className="nav-landing-link">FAQ</a>
        {isLoaded && !isSignedIn && (
          <Link href="/sign-in" onClick={closeMenu} className="nav-signin-link">Sign In</Link>
        )}
      </div>
    </>
  )
}
