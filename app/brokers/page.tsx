/**
 * /brokers — index page listing all 32 supported brokers, grouped by market.
 *
 * Server component, statically rendered. Each card links to the
 * statically-generated /brokers/[slug] page from app/brokers/[slug]/page.tsx.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BROKERS,
  type BrokerInfo,
} from '@/lib/seo/brokerRegistry'
import { JsonLd, BreadcrumbSchema } from '@/lib/schema'
import { SITE_URL } from '@/lib/seo/siteUrl'

const PAGE_URL = `${SITE_URL}/brokers`

const META_DESCRIPTION =
  'TradeSaath analyzes trades from 30+ brokers worldwide: Zerodha, Robinhood, Binance, Interactive Brokers, MetaTrader, and more. Find your broker and start your psychology analysis.'

export const metadata: Metadata = {
  title: 'All Supported Brokers — TradeSaath | 30+ Global Trading Platforms',
  description: META_DESCRIPTION,
  keywords: [
    'supported brokers',
    'trading journal brokers',
    'tradebook analysis',
    'global trading platforms',
    'broker integration',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'All Supported Brokers — TradeSaath | 30+ Global Trading Platforms',
    description: META_DESCRIPTION,
    url: PAGE_URL,
    type: 'website',
    siteName: 'TradeSaath',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'TradeSaath supported brokers' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Supported Brokers — TradeSaath',
    description: META_DESCRIPTION,
    images: ['/api/og'],
  },
}

const ASSET_LABELS: Record<string, string> = {
  equity: 'Equity',
  options: 'Options',
  futures: 'Futures',
  forex: 'Forex',
  crypto: 'Crypto',
}

interface MarketGroup {
  market: BrokerInfo['market']
  label: string
}

const MARKET_GROUPS: MarketGroup[] = [
  { market: 'india',  label: 'Indian Brokers' },
  { market: 'us',     label: 'US Brokers' },
  { market: 'global', label: 'Global Brokers' },
  { market: 'forex',  label: 'Forex Brokers' },
  { market: 'crypto', label: 'Crypto Exchanges' },
]

export default function BrokersIndexPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* CollectionPage + ItemList schema */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'All Supported Brokers — TradeSaath',
          description: META_DESCRIPTION,
          url: PAGE_URL,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: BROKERS.length,
            itemListElement: BROKERS.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/brokers/${b.slug}`,
              name: b.name,
            })),
          },
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Brokers', url: PAGE_URL },
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
            Brokers · 30+ supported
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
            Every broker. Every market. One analysis.
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            color: '#475569',
            lineHeight: 1.7,
            margin: '0 0 24px',
            maxWidth: 680,
          }}>
            Upload your tradebook from any broker worldwide. We auto-detect the format and run psychology analysis on every trade.
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
            Don&apos;t see yours? Try uploading anyway &rarr;
          </Link>
        </section>

        {/* ─── Per-market sections ─── */}
        {MARKET_GROUPS.map((group) => {
          const items = BROKERS.filter((b) => b.market === group.market)
          if (items.length === 0) return null
          return (
            <section key={group.market} style={{ marginBottom: 56 }}>
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
                {items.map((broker) => (
                  <BrokerCard key={broker.slug} broker={broker} />
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
            Don&apos;t see your broker?
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
            TradeSaath auto-detects 100+ broker file formats — try uploading.
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

/* ── Card component for a single broker ── */
function BrokerCard({ broker }: { broker: BrokerInfo }) {
  return (
    <Link
      href={`/brokers/${broker.slug}`}
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
      <div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 400,
          color: '#0F172A',
          letterSpacing: '-0.01em',
          marginBottom: 2,
        }}>
          {broker.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: '#64748B',
        }}>
          {broker.headquarters}
        </div>
      </div>

      {/* Asset class chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {broker.asset_classes.map((c) => (
          <span
            key={c}
            style={{
              background: '#F1F5F9',
              color: '#475569',
              borderRadius: 20,
              padding: '2px 9px',
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
            }}
          >
            {ASSET_LABELS[c] ?? c}
          </span>
        ))}
      </div>

      {/* Bottom CTA-style affordance */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 8,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 500,
        color: '#F59E0B',
      }}>
        Analyse {broker.name} trades &rarr;
      </div>
    </Link>
  )
}
