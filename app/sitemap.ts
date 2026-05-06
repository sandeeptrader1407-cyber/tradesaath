import type { MetadataRoute } from 'next'

/**
 * Next.js 15 file-based sitemap.
 * Public, indexable routes only — auth-gated app pages, admin routes,
 * and Clerk catch-all sign-in/sign-up are excluded (matched by the
 * disallow list in app/robots.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://tradesaath.com'
  const lastModified = new Date()
  return [
    { url: baseUrl,                lastModified, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/pricing`,   lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/faq`,       lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/glossary`,  lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`,   lastModified, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,     lastModified, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/refund`,    lastModified, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
