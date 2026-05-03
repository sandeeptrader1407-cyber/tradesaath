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

const EU_COUNTRIES: ReadonlySet<string> = new Set([
  'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'LU',
])

type Currency = 'USD' | 'EUR' | 'GBP' | 'INR'

function mapCountryToCurrency(country: string | undefined): Currency {
  if (!country) return 'USD'
  const c = country.toUpperCase()
  if (c === 'IN') return 'INR'
  if (c === 'GB') return 'GBP'
  if (EU_COUNTRIES.has(c)) return 'EUR'
  return 'USD'
}

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

  // Set per-visitor currency cookie on landing & pricing if not already set.
  // Reads Vercel Edge geo data; falls back to USD if geo is unavailable (local dev).
  if (path === '/' || path === '/pricing' || path.startsWith('/pricing/')) {
    const existing = req.cookies.get('tradesaath-currency')?.value
    if (!existing) {
      const currency = mapCountryToCurrency(req.geo?.country)
      const response = NextResponse.next()
      response.cookies.set('tradesaath-currency', currency, {
        maxAge: 60 * 60 * 24, // 24h
        path: '/',
        sameSite: 'lax',
      })
      return response
    }
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
