import type { MetadataRoute } from 'next'
import { BROKERS } from '@/lib/seo/brokerRegistry'
import { PATTERNS } from '@/lib/seo/patternRegistry'
import { GLOSSARY_TERMS } from '@/lib/seo/glossaryRegistry'

/**
 * Next.js 15 file-based sitemap.
 * Public, indexable routes only — auth-gated app pages, admin routes,
 * and Clerk catch-all sign-in/sign-up are excluded (matched by the
 * disallow list in app/robots.ts).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://tradesaath.com'
  const lastModified = new Date()
  const brokerRoutes: MetadataRoute.Sitemap = BROKERS.map((b) => ({
    url: `${baseUrl}/brokers/${b.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  const patternRoutes: MetadataRoute.Sitemap = PATTERNS.map((p) => ({
    url: `${baseUrl}/patterns/${p.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  const glossaryRoutes: MetadataRoute.Sitemap = GLOSSARY_TERMS.map((t) => ({
    url: `${baseUrl}/glossary/${t.slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))
  return [
    { url: baseUrl,                lastModified, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/pricing`,   lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/brokers`,   lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/patterns`,  lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/faq`,       lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/glossary`,  lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`,   lastModified, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,     lastModified, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/refund`,    lastModified, changeFrequency: 'yearly',  priority: 0.3 },
    ...brokerRoutes,
    ...patternRoutes,
    ...glossaryRoutes,
  ]
}
