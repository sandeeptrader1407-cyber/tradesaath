import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/upload',
  '/results',
  '/pricing',
  '/faq',
  '/glossary',
  '/privacy',
  '/terms',
  '/refund',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/parse',
  '/api/analyse',
  '/api/extract',
  '/api/health',
  '/api/payments/(.*)',
  '/api/webhooks/(.*)',
  '/api/og',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  const path = req.nextUrl.pathname

  // Redirect authenticated users away from landing page and auth pages to dashboard
  if (userId && (path === '/' || path.startsWith('/sign-in') || path.startsWith('/sign-up'))) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (!isPublicRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL('/sign-in', req.url).toString(),
    })
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
