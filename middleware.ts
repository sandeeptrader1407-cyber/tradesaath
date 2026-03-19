import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * Routes that are ALWAYS protected regardless of query params.
 */
const isAlwaysProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/journal(.*)',
  '/report(.*)',
])

export default clerkMiddleware((auth, req) => {
  const { pathname, searchParams } = req.nextUrl

  // /results is protected only when a session_id query param is present.
  // Without it the empty shell page is publicly visible.
  const isProtectedResults =
    pathname === '/results' && searchParams.has('session_id')

  if (isAlwaysProtected(req) || isProtectedResults) {
    auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
