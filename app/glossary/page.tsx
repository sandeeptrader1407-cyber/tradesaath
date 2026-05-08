import type { Metadata } from 'next'
import Link from 'next/link'
import {
  GLOSSARY_TERMS,
  type GlossaryTerm,
} from '@/lib/seo/glossaryRegistry'
import { JsonLd, BreadcrumbSchema } from '@/lib/schema'
import { SITE_URL } from '@/lib/seo/siteUrl'

const PAGE_URL = `${SITE_URL}/glossary`

const META_DESCRIPTION =
  'Complete trading glossary: 60 essential trader terms with definitions, formulas, and examples. From drawdown and Sharpe ratio to options Greeks, RSI, and trading psychology.'

export const metadata: Metadata = {
  title: 'Trading Glossary — TradeSaath | 60+ Trading Terms Defined',
  description: META_DESCRIPTION,
  keywords: [
    'trading glossary',
    'trader terms',
    'trading definitions',
    'trading metrics',
    'trading psychology terms',
    'options glossary',
    'technical analysis terms',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Trading Glossary — TradeSaath | 60+ Trading Terms Defined',
    description: META_DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
    siteName: 'TradeSaath',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'TradeSaath trading glossary' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trading Glossary — TradeSaath',
    description: META_DESCRIPTION,
    images: ['/api/og'],
  },
}

interface CategoryGroup {
  category: GlossaryTerm['category']
  label: string
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  { category: 'metrics',    label: 'Metrics' },
  { category: 'orders',     label: 'Orders' },
  { category: 'options',    label: 'Options' },
  { category: 'technical',  label: 'Technical Analysis' },
  { category: 'psychology', label: 'Psychology' },
  { category: 'risk',       label: 'Risk' },
  { category: 'crypto',     label: 'Crypto' },
  { category: 'general',    label: 'General' },
]

const CATEGORY_TAG_LABEL: Record<GlossaryTerm['category'], string> = {
  metrics: 'Metric',
  orders: 'Order',
  options: 'Options',
  technical: 'Technical',
  psychology: 'Psychology',
  risk: 'Risk',
  crypto: 'Crypto',
  general: 'General',
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Per-letter index: first term (alphabetically across the whole registry)
 *  whose name starts with that letter. Powers the alpha-nav strip — clicking
 *  "D" jumps to the first card with id `term-${slug}`. */
function buildFirstSlugByLetter(): Map<string, string> {
  const sorted = [...GLOSSARY_TERMS].sort((a, b) => a.term.localeCompare(b.term))
  const map = new Map<string, string>()
  for (const t of sorted) {
    const letter = t.term[0].toUpperCase()
    if (!map.has(letter)) map.set(letter, t.slug)
  }
  return map
}

function termsForCategory(cat: GlossaryTerm['category']): GlossaryTerm[] {
  return GLOSSARY_TERMS
    .filter((t) => t.category === cat)
    .sort((a, b) => a.term.localeCompare(b.term))
}

/* ── Page Component ────────────────────────────────────────────── */

export default function GlossaryIndexPage() {
  const firstSlugByLetter = buildFirstSlugByLetter()

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* DefinedTermSet schema covering all 60 terms */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'DefinedTermSet',
          name: 'TradeSaath Trading Glossary',
          description: META_DESCRIPTION,
          url: PAGE_URL,
          hasDefinedTerm: GLOSSARY_TERMS.map((t) => ({
            '@type': 'DefinedTerm',
            name: t.term,
            description: t.shortDef,
            url: `${SITE_URL}/glossary/${t.slug}`,
          })),
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Glossary', url: PAGE_URL },
        ]}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px 80px' }}>
        {/* ─── Hero ─── */}
        <section style={{ marginBottom: 40 }}>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94A3B8',
            margin: '0 0 12px',
          }}>
            Glossary · {GLOSSARY_TERMS.length} trading terms
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 400,
            color: '#0F172A',
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            margin: '0 0 18px',
            maxWidth: 760,
          }}>
            Every word a trader uses, defined.
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            color: '#475569',
            lineHeight: 1.7,
            margin: '0 0 24px',
            maxWidth: 680,
          }}>
            Definitions, formulas, and worked examples for the {GLOSSARY_TERMS.length} terms
            traders run into across metrics, orders, options, technicals, psychology, and risk.
          </p>
        </section>

        {/* ─── A–Z navigation strip ─── */}
        <nav
          aria-label="Alphabetical glossary navigation"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 56,
            padding: '14px 16px',
            background: '#FFFFFF',
            border: '0.5px solid #E2E8F0',
            borderRadius: 10,
          }}
        >
          {ALPHABET.map((letter) => {
            const slug = firstSlugByLetter.get(letter)
            const enabled = Boolean(slug)
            const baseStyle = {
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: 6,
              textDecoration: 'none',
              minWidth: 28,
              textAlign: 'center' as const,
            }
            return enabled ? (
              <a
                key={letter}
                href={`#term-${slug}`}
                style={{
                  ...baseStyle,
                  color: '#F59E0B',
                  background: 'rgba(245,158,11,0.08)',
                }}
              >
                {letter}
              </a>
            ) : (
              <span
                key={letter}
                aria-disabled="true"
                style={{
                  ...baseStyle,
                  color: '#CBD5E1',
                  background: 'transparent',
                }}
              >
                {letter}
              </span>
            )
          })}
        </nav>

        {/* ─── Per-category sections ─── */}
        {CATEGORY_GROUPS.map((group) => {
          const items = termsForCategory(group.category)
          if (items.length === 0) return null
          return (
            <section key={group.category} style={{ marginBottom: 56 }}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 400,
                color: '#0F172A',
                letterSpacing: '-0.015em',
                margin: '0 0 20px',
              }}>
                {group.label}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 400,
                  color: '#94A3B8',
                  marginLeft: 10,
                }}>
                  ({items.length})
                </span>
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
              }}>
                {items.map((term) => (
                  <GlossaryCard key={term.slug} term={term} />
                ))}
              </div>
            </section>
          )
        })}

        {/* ─── Bottom CTA ─── */}
        <section style={{
          marginTop: 64,
          padding: '40px 32px',
          background: '#0F172A',
          borderRadius: 14,
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 400,
            color: '#F1F5F9',
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
          }}>
            See these terms in your own trading.
          </p>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            color: 'rgba(241,245,249,0.6)',
            margin: '0 0 22px',
            maxWidth: 520,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Upload your tradebook — TradeSaath measures the metrics, flags the patterns, and
            shows the formulas applied to your real trades.
          </p>
          <Link
            href="/upload"
            style={{
              display: 'inline-block',
              background: '#F59E0B',
              color: '#080C14',
              padding: '11px 28px',
              borderRadius: 8,
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Upload your file →
          </Link>
        </section>
      </div>
    </main>
  )
}

/* ── Card component for a single glossary term ── */
function GlossaryCard({ term }: { term: GlossaryTerm }) {
  return (
    <Link
      id={`term-${term.slug}`}
      href={`/glossary/${term.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#FFFFFF',
        border: '0.5px solid #E2E8F0',
        borderRadius: 10,
        padding: 18,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        fontWeight: 400,
        color: '#0F172A',
        letterSpacing: '-0.01em',
      }}>
        {term.term}
      </div>

      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: '#475569',
        lineHeight: 1.55,
        margin: 0,
      }}>
        {term.shortDef}
      </p>

      {/* Category pill */}
      <div>
        <span style={{
          background: '#F1F5F9',
          color: '#475569',
          borderRadius: 20,
          padding: '2px 9px',
          fontFamily: 'var(--font-sans)',
          fontSize: 11,
        }}>
          {CATEGORY_TAG_LABEL[term.category]}
        </span>
      </div>

      <div style={{
        marginTop: 'auto',
        paddingTop: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 500,
        color: '#F59E0B',
      }}>
        View definition →
      </div>
    </Link>
  )
}
