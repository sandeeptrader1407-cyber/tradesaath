'use client'

import Link from 'next/link'

// Dynamically check if Clerk key exists — avoids crash when the key
// isn't present during Vercel's static page generation step.
const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Conditional imports aren't possible at the top level, so we import
// everything but only USE the Clerk components when the key is available.
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

function ClerkNavItems() {
  const { isSignedIn, isLoaded } = useAuth()
  const showUserUI = isLoaded && isSignedIn

  if (showUserUI) {
    return (
      <>
        <Link
          href="/upload"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full transition-colors"
        >
          Upload Trades
        </Link>
        <UserButton afterSignOutUrl="/" />
      </>
    )
  }

  return (
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
  )
}

function FallbackNavItems() {
  return (
    <>
      <Link
        href="/sign-in"
        className="border border-white/30 hover:border-white/60 hover:text-white px-4 py-1.5 rounded-full transition-colors"
      >
        Sign In
      </Link>
      <Link
        href="/sign-up"
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full transition-colors"
      >
        Sign Up
      </Link>
    </>
  )
}

export default function Navbar() {
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

        {hasClerk ? <ClerkNavItems /> : <FallbackNavItems />}
      </div>
    </nav>
  )
}
