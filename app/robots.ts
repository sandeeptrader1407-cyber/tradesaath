import type { MetadataRoute } from 'next'

const PRIVATE_PATHS = [
  '/api/',
  '/dashboard/',
  '/journal/',
  '/coach/',
  '/journey/',
  '/upload/',
  '/results/',
  '/sign-in/',
  '/sign-up/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule for all crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      // Explicitly allow AI crawlers for AEO
      ...[
        'GPTBot',
        'ChatGPT-User',
        'Google-Extended',
        'PerplexityBot',
        'ClaudeBot',
        'anthropic-ai',
        'Applebot-Extended',
        'cohere-ai',
        'Meta-ExternalAgent',
        'CCBot',
        'Bytespider',
      ].map((bot) => ({
        userAgent: bot,
        allow: '/',
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: 'https://tradesaath.com/sitemap.xml',
  }
}
