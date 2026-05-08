/**
 * /patterns — index page listing all 26 trading-psychology patterns,
 * grouped by category. Server component, statically rendered.
 *
 * Mirrors the /brokers index (app/brokers/page.tsx) for consistency.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  PATTERNS,
  type PatternInfo,
} from '@/lib/seo/patternRegistry'
import { JsonLd, BreadcrumbSchema } from '@/lib/schema'

const SITE_URL = 'https://tradesaath.com'
const PAGE_URL = `${SITE_URL}/patterns`

const META_DESCRIPTION =
  'Complete reference for 26 trading psychology patterns: revenge trading, FOMO, panic exits, the Vicious Cycle stages, and cognitive biases. Each pattern explained with examples, costs, and fixes.'

export const metadata: Metadata = {
  title: 'Trading Psychology Patterns — TradeSaath | 26 Behavioural Patterns Explained',
  description: META_DESCRIPTION,
  keywords: [
    'trading patterns',
    'trading psychology patterns',
    'revenge trading',
    'FOMO trading',
    'trader cognitive biases',
    'vicious cycle',
    'behavioural trading',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Trading Psychology Patterns — TradeSaath',
    description: META_DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
    siteName: 'TradeSaath',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'TradeSaath trading patterns' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trading Psychology Patterns — TradeSaath',
    description: META_DESCRIPTION,
    images: ['/api/og'],
  },
}

interface PatternGroup {
  category: PatternInfo['category']
  label: string
  filter: (p: PatternInfo) => boolean
  sort?: (a: PatternInfo, b: PatternInfo) => number
}

const PATTERN_GROUPS: PatternGroup[] = [
  {
    category: 'cycle-stage',
    label: 'The Vicious Cycle',
    filter: (p) => p.category === 'cycle-stage',
    // Stages 1 → 10 in cycle order; missing cycleStage falls to the end.
    sort: (a, b) => (a.cycleStage ?? 999) - (b.cycleStage ?? 999),
  },
  {
    category: 'cognitive-bias',
    label: 'Cognitive Biases',
    filter: (p) => p.category === 'cognitive-bias',
  },
  {
    category: 'behavioral',
    label: 'Behavioural Patterns',
    filter: (p) => p.category === 'behavioral',
  },
]

const CATEGORY_TAG_LABEL: Record<PatternInfo['category'], string> = {
  'cycle-stage': 'Vicious Cycle',
  'cognitive-bias': 'Cognitive Bias',
  emotional: 'Emotional',
  behavioral: 'Behavioural',
}

const GROUP_SUFFIX_LABEL: Record<PatternGroup['category'], string> = {
  'cycle-stage': '10 stages',
  'cognitive-bias': '8',
  emotional: '0',
  behavioral: '8',
}

export default function PatternsIndexPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Trading Psychology Patterns — TradeSaath',
          description: META_DESCRIPTION,
          url: PAGE_URL,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: PATTERNS.length,
            itemListElement: PATTERNS.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/patterns/${p.slug}`,
              name: p.name,
            })),
          },
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Patterns', url: PAGE_URL },
        ]}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 24px 80px' }}>
        {/* ─── Hero ─── */}
        <section style={{ marginBottom: 56 }}>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94A3B8',
            margin: '0 0 12px',
          }}>
            Patterns · 26 behavioural patterns
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
            The patterns you don&apos;t see, but feel.
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            color: '#475569',
            lineHeight: 1.7,
            margin: '0 0 24px',
            maxWidth: 680,
          }}>
            Every trader runs into these. We map them in your trade history.
          </p>
          <Link
            href="/upload"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#F59E0B',
              color: '#080C14',
              padding: '11px 22px',
              borderRadius: 8,
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            See your patterns &rarr;
          </Link>
        </section>

        {/* ─── Per-category sections ─── */}
        {PATTERN_GROUPS.map((group) => {
          const items = PATTERNS.filter(group.filter)
          if (items.length === 0) return null
          if (group.sort) items.sort(group.sort)
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
                  ({GROUP_SUFFIX_LABEL[group.category]})
                </span>
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
              }}>
                {items.map((pattern) => (
                  <PatternCard key={pattern.slug} pattern={pattern} />
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
            Find your patterns in your own trades.
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
            Upload your tradebook — TradeSaath maps every trade to one of these patterns.
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
            Upload your file &rarr;
          </Link>
        </section>
      </div>
    </main>
  )
}

/* ── Card component for a single pattern ── */
function PatternCard({ pattern }: { pattern: PatternInfo }) {
  const stageBadge = pattern.cycleStage
    ? String(pattern.cycleStage).padStart(2, '0')
    : null

  return (
    <Link
      href={`/patterns/${pattern.slug}`}
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {stageBadge && (
          <span style={{
            display: 'inline-block',
            background: 'rgba(245,158,11,0.08)',
            color: '#F59E0B',
            border: '0.5px solid rgba(245,158,11,0.3)',
            borderRadius: 6,
            padding: '2px 7px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            flexShrink: 0,
            lineHeight: 1.5,
          }}>
            {stageBadge}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 400,
            color: '#0F172A',
            letterSpacing: '-0.01em',
          }}>
            {pattern.name}
          </div>
        </div>
      </div>

      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: '#475569',
        lineHeight: 1.55,
        margin: 0,
      }}>
        {pattern.shortDef}
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
          {CATEGORY_TAG_LABEL[pattern.category]}
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
        Read full definition &rarr;
      </div>
    </Link>
  )
}
