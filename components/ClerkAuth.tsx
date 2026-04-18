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
  if (!hasKey) {
    return (
      <>
        <Link href="/sign-in" className="btn btn-ghost btn-sm nav-auth-btn">
          Sign In
        </Link>
        <Link href="/sign-up" className="btn btn-accent btn-sm nav-getstarted-btn">
          Get Started
        </Link>
      </>
    )
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="redirect">
          <button className="btn btn-ghost btn-sm nav-auth-btn">Sign In</button>
        </SignInButton>
        <SignUpButton mode="redirect">
          <button className="btn btn-accent btn-sm nav-getstarted-btn">Get Started</button>
        </SignUpButton>
      </SignedOut>

      <SignedIn>
        <Link href="/upload" className="btn btn-accent btn-sm">
          Upload Trades
        </Link>
        <UserButton />
      </SignedIn>
    </>
  )
}
