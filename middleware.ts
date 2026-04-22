import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const ADMIN_CLERK_IDS = [process.env.ADMIN_CLERK_USER_ID_1].filter(Boolean) as string[]

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

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  const path = req.nextUrl.pathname

  // Redirect authenticated users away from landing page and auth pages to dashboard
  if (userId && (path === '/' || path.startsWith('/sign-in') || path.startsWith('/sign-up'))) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Admin routes: must be authenticated AND in the admin list
  if (isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    if (!ADMIN_CLERK_IDS.includes(userId)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
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
