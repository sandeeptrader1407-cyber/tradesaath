import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/coach',
        '/journal',
        '/journey',
        '/sign-in',
        '/sign-up',
        '/api',
      ],
    },
    sitemap: 'https://tradesaath.com/sitemap.xml',
  }
}
