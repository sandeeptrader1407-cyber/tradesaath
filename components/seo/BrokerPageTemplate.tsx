/**
 * Shared template for /brokers/[slug] SEO pages.
 * Consumes a BrokerInfo from lib/seo/brokerRegistry.ts.
 *
 * Styling follows existing TradeSaath aesthetic (light surfaces,
 * Fraunces display + sans body, inline styles using CSS vars). Internal
 * links to /patterns/[slug] are stable — those routes ship in Prompt 3.
 */

import Link from 'next/link'
import type { BrokerInfo } from '@/lib/seo/brokerRegistry'
import { getPattern } from '@/lib/seo/patternRegistry'
import { JsonLd, BreadcrumbSchema } from '@/lib/schema'

interface Props {
  broker: BrokerInfo
}

const ASSET_LABELS: Record<string, string> = {
  equity: 'Equity / Stocks',
  options: 'Options',
  futures: 'Futures',
  forex: 'Forex',
  crypto: 'Crypto',
}

export default function BrokerPageTemplate({ broker }: Props) {
  const pageUrl = `https://tradesaath.com/brokers/${broker.slug}`
  const exportSteps = broker.exportPath.split(' → ').map((s) => s.trim()).filter(Boolean)

  // Resolve related patterns to display name + link
  const relatedPatterns = broker.relatedPatterns
    .map((slug) => {
      const p = getPattern(slug)
      return p ? { slug: p.slug, name: p.name, shortDef: p.shortDef } : null
    })
    .filter((p): p is { slug: string; name: string; shortDef: string } => p !== null)

  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* JSON-LD: Organization schema for the broker */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: broker.fullName,
          alternateName: broker.name,
          url: broker.homepageUrl,
          foundingDate: String(broker.foundedYear),
          address: { '@type': 'PostalAddress', addressLocality: broker.headquarters },
        }}
      />
      {/* JSON-LD: Product schema for tradebook analysis on this broker */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `Tradebook Analysis for ${broker.name}`,
          description: `Upload your ${broker.name} trade book to TradeSaath and get AI-powered psychology analysis: revenge trading, FOMO, panic exits, position-sizing leaks.`,
          brand: { '@type': 'Brand', name: 'TradeSaath' },
          category: 'Trading Analytics',
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://tradesaath.com' },
          { name: 'Brokers', url: 'https://tradesaath.com/brokers' },
          { name: broker.name, url: pageUrl },
        ]}
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '96px 24px 80px' }}>
        {/* Hero */}
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 12px' }}>
          {broker.market === 'india' ? 'Indian broker'
            : broker.market === 'us' ? 'US broker'
            : broker.market === 'crypto' ? 'Crypto exchange'
            : broker.market === 'forex' ? 'Forex broker'
            : 'Global broker'}
          {' · '}{broker.headquarters}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 400, color: '#0F172A', lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 16px' }}>
          {broker.name} Trading Journal &amp; Psychology Analysis
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: '#475569', lineHeight: 1.7, maxWidth: 680, margin: 0 }}>
          {broker.description}
        </p>

        {/* Asset class chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
          {broker.asset_classes.map((c) => (
            <span key={c} style={{ background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontFamily: 'var(--font-sans)', color: '#475569' }}>
              {ASSET_LABELS[c] ?? c}
            </span>
          ))}
        </div>

        {/* How to export */}
        <section style={{ marginTop: 56 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>
            How to export your tradebook from {broker.name}
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#64748B', margin: '0 0 18px' }}>
            File formats supported: {broker.exportFormats.join(', ')}. Typical filename: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>{broker.fileNamePattern}</code>
          </p>
          <ol style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#0F172A', lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
            {exportSteps.map((step, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{step}</li>
            ))}
          </ol>
        </section>

        {/* What TradeSaath analyzes */}
        <section style={{ marginTop: 56 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>
            What TradeSaath analyses in your {broker.name} file
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#64748B', margin: '0 0 16px' }}>
            We map the columns your broker exports onto our standard schema, then run pattern detection across every trade.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {broker.columnsAnalyzed.map((col) => (
              <span key={col} style={{ background: '#0F172A', color: '#F8FAFC', borderRadius: 6, padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {col}
              </span>
            ))}
          </div>
        </section>

        {/* Related patterns */}
        {relatedPatterns.length > 0 && (
          <section style={{ marginTop: 56 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: '#0F172A', letterSpacing: '-0.015em', margin: '0 0 12px' }}>
              Patterns we commonly detect on {broker.name} traders
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {relatedPatterns.map((p) => (
                <Link
                  key={p.slug}
                  href={`/patterns/${p.slug}`}
                  style={{ display: 'block', background: '#FFFFFF', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '14px 18px', textDecoration: 'none' }}
                >
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: '#0F172A', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>{p.shortDef}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section style={{ marginTop: 64, padding: '32px 28px', background: '#0F172A', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            Ready to analyse your {broker.name} trades?
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(241,245,249,0.6)', margin: '0 0 20px' }}>
            Drop your tradebook — first analysis is free, no signup required.
          </p>
          <Link
            href="/upload"
            style={{ display: 'inline-block', background: '#F59E0B', color: '#080C14', padding: '11px 28px', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
          >
            Upload your {broker.name} file →
          </Link>
        </section>
      </div>
    </main>
  )
}
