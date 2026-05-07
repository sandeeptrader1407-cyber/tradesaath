/**
 * Shared template for /patterns/[slug] SEO pages.
 * Consumes a PatternInfo from lib/seo/patternRegistry.ts.
 */

import Link from 'next/link'
import type { PatternInfo } from '@/lib/seo/patternRegistry'
import { getPattern } from '@/lib/seo/patternRegistry'
import { getTerm } from '@/lib/seo/glossaryRegistry'
import { JsonLd, BreadcrumbSchema } from '@/lib/schema'

interface Props {
  pattern: PatternInfo
}

const CATEGORY_LABEL: Record<PatternInfo['category'], string> = {
  'cycle-stage': 'Vicious Cycle Stage',
  'cognitive-bias': 'Cognitive Bias',
  emotional: 'Emotional Pattern',
  behavioral: 'Behavioural Pattern',
}

export default function PatternPageTemplate({ pattern }: Props) {
  const pageUrl = `https://tradesaath.com/patterns/${pattern.slug}`

  const relatedPatterns = pattern.relatedPatterns
    .map((slug) => getPattern(slug))
    .filter((p): p is PatternInfo => Boolean(p))
  const relatedTerms = pattern.relatedTerms
    .map((slug) => getTerm(slug))
    .filter((t): t is NonNullable<ReturnType<typeof getTerm>> => Boolean(t))

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* JSON-LD: DefinedTerm for the pattern */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'DefinedTerm',
          name: pattern.name,
          description: pattern.shortDef,
          url: pageUrl,
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            name: 'TradeSaath Trading Psychology Patterns',
            url: 'https://tradesaath.com/patterns',
          },
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://tradesaath.com' },
          { name: 'Patterns', url: 'https://tradesaath.com/patterns' },
          { name: pattern.name, url: pageUrl },
        ]}
      />

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '96px 24px 80px' }}>
        {/* Hero */}
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 12px' }}>
          {CATEGORY_LABEL[pattern.category]}
          {pattern.cycleStage ? ` · Stage ${pattern.cycleStage} of 10` : ''}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5.5vw, 48px)', fontWeight: 400, color: '#0F172A', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 16px' }}>
          {pattern.name} — Definition, Examples, How to Fix
        </h1>

        {/* Short-def callout */}
        <div style={{ marginTop: 8, padding: '16px 20px', background: '#FFFBEB', borderLeft: '3px solid #F59E0B', borderRadius: '0 8px 8px 0' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 500, color: '#0F172A', margin: 0, lineHeight: 1.5 }}>
            {pattern.shortDef}
          </p>
        </div>

        {/* Full def */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>What it is</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F2937', lineHeight: 1.8, margin: 0 }}>
            {pattern.fullDef}
          </p>
        </section>

        {/* Examples */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>What it looks like</h2>
          <ul style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F2937', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            {pattern.examples.map((ex, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{ex}</li>
            ))}
          </ul>
        </section>

        {/* Cost */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>Why it costs you money</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F2937', lineHeight: 1.8, margin: 0 }}>
            {pattern.costToTrader}
          </p>
        </section>

        {/* Detection */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>How TradeSaath detects this</h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F2937', lineHeight: 1.8, margin: 0 }}>
            {pattern.howDetected}
          </p>
        </section>

        {/* Fix */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>How to fix it</h2>
          <ol style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#1F2937', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            {pattern.howToFix.map((fix, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{fix}</li>
            ))}
          </ol>
        </section>

        {/* Related patterns + terms */}
        {(relatedPatterns.length > 0 || relatedTerms.length > 0) && (
          <section style={{ marginTop: 56, padding: '24px 20px', background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: '#0F172A', margin: '0 0 12px' }}>Related</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {relatedPatterns.map((p) => (
                <Link key={p.slug} href={`/patterns/${p.slug}`} style={{ background: '#F1F5F9', color: '#0F172A', borderRadius: 6, padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, textDecoration: 'none' }}>
                  {p.name}
                </Link>
              ))}
              {relatedTerms.map((t) => (
                <Link key={t.slug} href={`/glossary/${t.slug}`} style={{ background: 'rgba(245,158,11,0.08)', color: '#92400E', border: '0.5px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '4px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, textDecoration: 'none' }}>
                  {t.term}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section style={{ marginTop: 56, padding: '32px 28px', background: '#0F172A', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Is {pattern.name.toLowerCase()} costing you money?
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.6)', margin: '0 0 20px' }}>
            Upload your trade history and find out — first analysis is free.
          </p>
          <Link href="/upload" style={{ display: 'inline-block', background: '#F59E0B', color: '#080C14', padding: '11px 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Analyse my trades →
          </Link>
        </section>
      </div>
    </main>
  )
}
