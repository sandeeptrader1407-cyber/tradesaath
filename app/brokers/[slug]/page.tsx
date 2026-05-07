/**
 * Dynamic broker SEO route — /brokers/[slug]
 *
 * Generates one statically-built page per broker in the registry at
 * build time. All metadata (title / description / keywords / OG /
 * canonical) is derived from BrokerInfo so /brokers/zerodha and
 * /brokers/robinhood ship with broker-specific tags without hand-rolling
 * each page.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BrokerPageTemplate from '@/components/seo/BrokerPageTemplate'
import {
  getBroker,
  getBrokerSlugs,
  type BrokerInfo,
} from '@/lib/seo/brokerRegistry'
import { getPattern } from '@/lib/seo/patternRegistry'

interface RouteParams {
  params: { slug: string }
}

const META_DESCRIPTION_MAX = 160
const SITE_URL = 'https://tradesaath.com'

/* ── Static-site generation: emit all 32 broker slugs at build time. */
export function generateStaticParams(): { slug: string }[] {
  return getBrokerSlugs().map((slug) => ({ slug }))
}

/* ── Per-page metadata — title / desc / keywords / OG / canonical. */
export function generateMetadata({ params }: RouteParams): Metadata {
  const broker = getBroker(params.slug)
  if (!broker) {
    // Next.js will swap in 404 metadata when notFound() fires from the page.
    return { title: 'Broker not found · TradeSaath' }
  }

  const description = truncate(broker.description, META_DESCRIPTION_MAX)
  const keywords = buildKeywords(broker)
  const canonical = `${SITE_URL}/brokers/${broker.slug}`
  const title = `${broker.name} Trading Journal & Psychology Analysis | TradeSaath`

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'TradeSaath',
      images: [{ url: '/api/og', width: 1200, height: 630, alt: `${broker.name} on TradeSaath` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/api/og'],
    },
  }
}

/* ── Page server component — pure data lookup + template render. */
export default function BrokerPage({ params }: RouteParams) {
  const broker = getBroker(params.slug)
  if (!broker) notFound()
  return <BrokerPageTemplate broker={broker} />
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Truncate `text` to `max` characters at a word boundary, appending '...'. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  // Reserve 3 chars for the ellipsis.
  const sliced = text.slice(0, max - 3)
  const lastSpace = sliced.lastIndexOf(' ')
  const cut = lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced
  return `${cut.trimEnd()}...`
}

/** Build a keywords array per the spec: broker name + asset-class slants + pattern slants. */
function buildKeywords(broker: BrokerInfo): string[] {
  const lower = broker.name.toLowerCase()
  const out: string[] = [
    `${lower} tradebook analysis`,
    `${lower} psychology`,
    `${lower} trading journal`,
    `${lower} trade analytics`,
  ]
  // One "{broker} {asset} journal" per asset class.
  for (const ac of broker.asset_classes) {
    out.push(`${lower} ${ac} journal`)
  }
  // "{pattern} {broker}" — only for patterns that resolve in the registry.
  for (const slug of broker.relatedPatterns) {
    const pattern = getPattern(slug)
    if (pattern) out.push(`${pattern.name.toLowerCase()} ${lower}`)
  }
  return out
}
