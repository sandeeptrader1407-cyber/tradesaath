'use client'

import Link from 'next/link'
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export default function Navbar() {
  const { isSignedIn, isLoaded } = useAuth()

  // Show signed-in UI only once Clerk has loaded AND confirmed the user is authenticated.
  // In every other state (loading, signed-out) we show the Sign In / Get Started buttons
  // so they are always visible on first paint — both in production SSR and during hydration.
  const showUserUI = isLoaded && isSignedIn

  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
      <Link href="/" className="text-2xl font-bold text-blue-400">
        TradeSaath
      </Link>

      <div className="flex items-center gap-6 text-sm text-slate-300">
        <Link href="/pricing" className="hover:text-white transition-colors">
          Pricing
        </Link>
        <Link href="/journal" className="hover:text-white transition-colors">
          Journal
        </Link>
        <Link href="/dashboard" className="hover:text-white transition-colors">
          Dashboard
        </Link>

        {showUserUI ? (
          <>
            <Link
              href="/upload"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full transition-colors"
            >
              Upload Trades
            </Link>
            <UserButton afterSignOutUrl="/" />
          </>
        ) : (
          <>
            <SignInButton mode="redirect">
              <button className="border border-white/30 hover:border-white/60 hover:text-white px-4 py-1.5 rounded-full transition-colors">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full transition-colors">
                Sign Up
              </button>
            </SignUpButton>
          </>
        )}
      </div>
    </nav>
  )
}
