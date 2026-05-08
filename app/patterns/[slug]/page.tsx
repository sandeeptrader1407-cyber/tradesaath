/**
 * Dynamic pattern SEO route — /patterns/[slug]
 *
 * One statically-built page per pattern in the registry. Mirrors the
 * /brokers/[slug] structure: generateStaticParams seeds all 26 slugs,
 * generateMetadata produces per-pattern title/desc/keywords/OG/canonical,
 * and the page server-component renders the shared PatternPageTemplate.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PatternPageTemplate from '@/components/seo/PatternPageTemplate'
import {
  getPattern,
  getPatternSlugs,
  type PatternInfo,
} from '@/lib/seo/patternRegistry'
import { SITE_URL } from '@/lib/seo/siteUrl'

interface RouteParams {
  params: { slug: string }
}

const META_DESCRIPTION_MAX = 155

/* ── Static-site generation: emit all 26 pattern slugs at build time. */
export function generateStaticParams(): { slug: string }[] {
  return getPatternSlugs().map((slug) => ({ slug }))
}

/* ── Per-page metadata — title / desc / keywords / OG / canonical. */
export function generateMetadata({ params }: RouteParams): Metadata {
  const pattern = getPattern(params.slug)
  if (!pattern) {
    return { title: 'Pattern not found · TradeSaath' }
  }

  const description = truncate(pattern.fullDef, META_DESCRIPTION_MAX)
  const keywords = buildKeywords(pattern)
  const canonical = `${SITE_URL}/patterns/${pattern.slug}`
  const title = `${pattern.name} — Definition, Examples & How to Fix | TradeSaath`

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'TradeSaath',
      images: [{ url: '/api/og', width: 1200, height: 630, alt: `${pattern.name} on TradeSaath` }],
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
export default function PatternPage({ params }: RouteParams) {
  const pattern = getPattern(params.slug)
  if (!pattern) notFound()
  return <PatternPageTemplate pattern={pattern} />
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Truncate `text` to `max` characters at a word boundary, appending '...'. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const sliced = text.slice(0, max - 3)
  const lastSpace = sliced.lastIndexOf(' ')
  const cut = lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced
  return `${cut.trimEnd()}...`
}

/** Build a keywords array per the spec — name, definition, examples, fix, psychology, comparisons. */
function buildKeywords(pattern: PatternInfo): string[] {
  const lower = pattern.name.toLowerCase()
  const out: string[] = [
    lower,
    `${lower} definition`,
    `${lower} examples`,
    `${lower} trading`,
    `how to fix ${lower}`,
    `${lower} psychology`,
  ]
  // "{name} vs {related-name}" comparison keywords — drives intent-rich
  // longtail traffic. Only added for related patterns that resolve.
  for (const slug of pattern.relatedPatterns) {
    const related = getPattern(slug)
    if (related) out.push(`${lower} vs ${related.name.toLowerCase()}`)
  }
  return out
}
