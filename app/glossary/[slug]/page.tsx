/**
 * Dynamic glossary SEO route — /glossary/[slug]
 *
 * One statically-built page per term in the registry. Mirrors the
 * /brokers/[slug] and /patterns/[slug] structure: generateStaticParams
 * seeds all 60 slugs, generateMetadata produces per-term title/desc/
 * keywords/OG/canonical, and the page server-component renders the
 * shared GlossaryEntryTemplate.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GlossaryEntryTemplate from '@/components/seo/GlossaryEntryTemplate'
import {
  getTerm,
  getTermSlugs,
  type GlossaryTerm,
} from '@/lib/seo/glossaryRegistry'

interface RouteParams {
  params: { slug: string }
}

const META_DESCRIPTION_MAX = 155
const SITE_URL = 'https://tradesaath.com'

/* ── Static-site generation: emit all 60 term slugs at build time. */
export function generateStaticParams(): { slug: string }[] {
  return getTermSlugs().map((slug) => ({ slug }))
}

/* ── Per-page metadata — title / desc / keywords / OG / canonical. */
export function generateMetadata({ params }: RouteParams): Metadata {
  const term = getTerm(params.slug)
  if (!term) {
    return { title: 'Term not found · TradeSaath' }
  }

  const description = truncate(term.fullDef, META_DESCRIPTION_MAX)
  const keywords = buildKeywords(term)
  const canonical = `${SITE_URL}/glossary/${term.slug}`
  const title = `${term.term} — Trading Definition, Formula & Example | TradeSaath`

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
      images: [{ url: '/api/og', width: 1200, height: 630, alt: `${term.term} on TradeSaath` }],
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
export default function GlossaryEntryPage({ params }: RouteParams) {
  const term = getTerm(params.slug)
  if (!term) notFound()
  return <GlossaryEntryTemplate term={term} />
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

/** Build a keywords array per the spec — name, definition, meaning, formula (if present), example, "what is". */
function buildKeywords(term: GlossaryTerm): string[] {
  const lower = term.term.toLowerCase()
  const out: string[] = [
    lower,
    `${lower} definition`,
    `${lower} meaning`,
    `${lower} trading`,
    `${lower} example`,
    `what is ${lower}`,
  ]
  if (term.formula) out.push(`${lower} formula`)
  return out
}
