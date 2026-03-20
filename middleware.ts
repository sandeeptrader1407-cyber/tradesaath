import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Routes that are ALWAYS protected regardless of query params.
 */
const isAlwaysProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/journal(.*)',
  '/report(.*)',
])

/**
 * If CLERK_SECRET_KEY is not set, skip Clerk middleware entirely
 * so the site doesn't return 500 on every request.
 */
const clerkSecretKey = process.env.CLERK_SECRET_KEY

function fallbackMiddleware(req: NextRequest) {
  // Without Clerk, redirect protected routes to /sign-in
  const { pathname, searchParams } = req.nextUrl

  const protectedPaths = ['/dashboard', '/journal', '/report']
  const isProtected =
    protectedPaths.some((p) => pathname.startsWith(p)) ||
    (pathname === '/results' && searchParams.has('session_id'))

  if (isProtected) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  const { pathname, searchParams } = req.nextUrl

  // /results is protected only when a session_id query param is present.
  const isProtectedResults =
    pathname === '/results' && searchParams.has('session_id')

  if (isAlwaysProtected(req) || isProtectedResults) {
    await auth.protect()
  }
})

export default function middleware(req: NextRequest) {
  if (!clerkSecretKey) {
    return fallbackMiddleware(req)
  }
  return clerkHandler(req, {} as any)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
