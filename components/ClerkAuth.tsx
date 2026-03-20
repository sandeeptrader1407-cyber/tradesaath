'use client'

import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'

const hasKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default function ClerkAuth() {
  // If Clerk isn't configured, show plain link fallbacks
  if (!hasKey) {
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

  return (
    <>
      <SignedOut>
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
      </SignedOut>

      <SignedIn>
        <Link
          href="/upload"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full transition-colors"
        >
          Upload Trades
        </Link>
        <UserButton />
      </SignedIn>
    </>
  )
}
