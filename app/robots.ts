import type { MetadataRoute } from 'next'

/**
 * Next.js 15 file-based robots.
 * Default-allow for `/` with explicit disallow for auth-gated app
 * routes, the API surface, and Clerk catch-all sign-in/sign-up. AI
 * crawlers are explicitly allow-listed for answer-engine citation.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/coach/',
          '/journal/',
          '/journey/',
          '/upload/',
          '/settings/',
          '/results/',
          '/sign-in/',
          '/sign-up/',
        ],
      },
      // Explicit AI crawler permissions for citation in answer engines
      { userAgent: 'GPTBot',            allow: '/' },
      { userAgent: 'ChatGPT-User',      allow: '/' },
      { userAgent: 'ClaudeBot',         allow: '/' },
      { userAgent: 'Claude-Web',        allow: '/' },
      { userAgent: 'PerplexityBot',     allow: '/' },
      { userAgent: 'Google-Extended',   allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'CCBot',             allow: '/' },
    ],
    sitemap: 'https://tradesaath.com/sitemap.xml',
    host: 'https://tradesaath.com',
  }
}
