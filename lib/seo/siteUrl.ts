/**
 * Canonical site URL for all SEO metadata, JSON-LD schema, OpenGraph,
 * canonical tags, sitemap entries, and email templates.
 *
 * Use the www subdomain because production serves the www version.
 * Non-www requests are 307-redirected to www; hardcoding non-www in
 * canonical/schema fields creates redirect chains that confuse
 * Google's indexer.
 */
export const SITE_URL = 'https://www.tradesaath.com'
