/**
 * Shared template for /glossary/[slug] SEO pages.
 * Consumes a GlossaryTerm from lib/seo/glossaryRegistry.ts.
 */

import Link from 'next/link'
import type { GlossaryTerm } from '@/lib/seo/glossaryRegistry'
import { getTerm } from '@/lib/seo/glossaryRegistry'
import { getPattern } from '@/lib/seo/patternRegistry'
import { JsonLd, BreadcrumbSchema } from '@/lib/schema'
import { SITE_URL } from '@/lib/seo/siteUrl'

interface Props {
  term: GlossaryTerm
}

const CATEGORY_LABEL: Record<GlossaryTerm['category'], string> = {
  metrics: 'Performance Metric',
  orders: 'Order Type',
  options: 'Options',
  technical: 'Technical Analysis',
  psychology: 'Trading Psychology',
  risk: 'Risk Management',
  crypto: 'Crypto',
  general: 'General',
}

export default function GlossaryEntryTemplate({ term }: Props) {
  const pageUrl = `${SITE_URL}/glossary/${term.slug}`

  const relatedTerms = term.relatedTerms
    .map((slug) => getTerm(slug))
    .filter((t): t is GlossaryTerm => Boolean(t))
  const relatedPatterns = term.relatedPatterns
    .map((slug) => getPattern(slug))
    .filter((p): p is NonNullable<ReturnType<typeof getPattern>> => Boolean(p))

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'DefinedTerm',
          name: term.term,
          description: term.shortDef,
          url: pageUrl,
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            name: 'TradeSaath Trading Glossary',
            url: `${SITE_URL}/glossary`,
          },
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Glossary', url: `${SITE_URL}/glossary` },
          { name: term.term, url: pageUrl },
        ]}
      />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '96px 24px 80px' }}>
        {/* Hero */}
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 12px' }}>
          {CATEGORY_LABEL[term.category]}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 400, color: '#0F172A', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 16px' }}>
          {term.term} — Definition &amp; Example
        </h1>

        {/* Short-def callout */}
        <div style={{ marginTop: 8, padding: '16px 20px', background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 500, color: '#0F172A', margin: 0, lineHeight: 1.5 }}>
            {term.shortDef}
          </p>
        </div>

        {/* Full def */}
        <section style={{ marginTop: 36 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F2937', lineHeight: 1.8, margin: 0 }}>
            {term.fullDef}
          </p>
        </section>

        {/* Formula */}
        {term.formula && (
          <section style={{ marginTop: 32 }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 8px' }}>Formula</p>
            <div style={{ background: '#F1F5F9', border: '0.5px solid #CBD5E1', borderRadius: 8, padding: '14px 18px' }}>
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#0F172A', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {term.formula}
              </code>
            </div>
          </section>
        )}

        {/* Example */}
        <section style={{ marginTop: 32 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 8px' }}>Example</p>
          <div style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderLeft: '3px solid #10B981', borderRadius: '0 8px 8px 0', padding: '16px 20px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#1F2937', lineHeight: 1.7, margin: 0 }}>
              {term.example}
            </p>
          </div>
        </section>

        {/* Related */}
        {(relatedTerms.length > 0 || relatedPatterns.length > 0) && (
          <section style={{ marginTop: 48, padding: '20px 18px', background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: '#0F172A', margin: '0 0 10px' }}>Related</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {relatedTerms.map((t) => (
                <Link key={t.slug} href={`/glossary/${t.slug}`} style={{ background: '#F1F5F9', color: '#0F172A', borderRadius: 6, padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, textDecoration: 'none' }}>
                  {t.term}
                </Link>
              ))}
              {relatedPatterns.map((p) => (
                <Link key={p.slug} href={`/patterns/${p.slug}`} style={{ background: 'rgba(245,158,11,0.08)', color: '#92400E', border: '0.5px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, textDecoration: 'none' }}>
                  {p.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section style={{ marginTop: 48, padding: '28px 24px', background: '#0F172A', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            See {term.term.toLowerCase()} in your own trades
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(241,245,249,0.6)', margin: '0 0 18px' }}>
            Upload your tradebook — TradeSaath calculates this automatically.
          </p>
          <Link href="/upload" style={{ display: 'inline-block', background: '#F59E0B', color: '#080C14', padding: '10px 24px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Try it free →
          </Link>
        </section>
      </div>
    </main>
  )
}
