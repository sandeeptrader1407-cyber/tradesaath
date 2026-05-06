/* ── JSON-LD Structured Data for SEO + AEO ─────────────────────── */

type JsonLdProps = { data: Record<string, unknown> }

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data, null, 0) }}
    />
  )
}

/* ── Organization (every page via layout or landing) ──────────── */

export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'TradeSaath',
        url: 'https://tradesaath.com',
        // TODO: replace with dedicated logo when designed (currently using og-image.svg as placeholder).
        logo: 'https://tradesaath.com/og-image.svg',
        description:
          'AI-powered trading psychology analysis platform that helps retail traders identify emotional patterns like revenge trading, FOMO entries, and panic exits in their trade history.',
        foundingDate: '2025',
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'sandeep.trader1407@gmail.com',
          contactType: 'customer support',
        },
        sameAs: [
          'https://x.com/tradesaath',
          'https://linkedin.com/company/tradesaath',
          'https://www.producthunt.com/products/tradesaath',
        ],
      }}
    />
  )
}

/* ── SoftwareApplication (pricing page) ───────────────────────── */

export function SoftwareApplicationSchema() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'TradeSaath',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        url: 'https://tradesaath.com',
        description:
          'AI-powered trading psychology analysis for Indian retail traders. Detects revenge trading, FOMO, panic exits, and overtrading patterns.',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: '99',
          highPrice: '799',
          offerCount: '3',
          offers: [
            {
              '@type': 'Offer',
              name: 'Single Report',
              price: '99',
              priceCurrency: 'INR',
              description: 'One-time AI psychology analysis report',
            },
            {
              '@type': 'Offer',
              name: 'Pro Monthly',
              price: '499',
              priceCurrency: 'INR',
              description: 'Unlimited AI analyses, trading journal, AI coaching — billed monthly',
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: '499',
                priceCurrency: 'INR',
                billingDuration: 'P1M',
              },
            },
            {
              '@type': 'Offer',
              name: 'Pro Yearly',
              price: '399',
              priceCurrency: 'INR',
              description: 'Unlimited AI analyses, trading journal, AI coaching — billed annually at \u20B97,999/year',
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: '399',
                priceCurrency: 'INR',
                billingDuration: 'P1M',
                referenceQuantity: {
                  '@type': 'QuantitativeValue',
                  value: '12',
                  unitCode: 'MON',
                },
              },
            },
          ],
        },
        featureList: [
          'AI-powered Decision Quality Score (DQS)',
          'Revenge trading detection',
          'FOMO entry pattern analysis',
          'Panic exit identification',
          'Overtrading detection',
          'Position sizing analysis',
          'AI coaching companion (Saathi)',
          'Interactive trading journal',
          'Vicious Cycle stage mapping',
          'Support for 21+ Indian and global brokers',
        ],
        screenshot: 'https://tradesaath.com/og-image.svg',
      }}
    />
  )
}

/* ── FAQPage ──────────────────────────────────────────────────── */

export function FAQPageSchema({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a,
          },
        })),
      }}
    />
  )
}

/* ── Article (for future blog posts) ──────────────────────────── */

export function ArticleSchema({
  title,
  description,
  url,
  datePublished,
  dateModified,
  image,
}: {
  title: string
  description: string
  url: string
  datePublished: string
  dateModified?: string
  image?: string
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        url,
        datePublished,
        dateModified: dateModified ?? datePublished,
        image: image ?? 'https://tradesaath.com/og-image.svg',
        author: {
          '@type': 'Organization',
          name: 'TradeSaath',
          url: 'https://tradesaath.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'TradeSaath',
          // TODO: replace with dedicated logo when designed (currently using og-image.svg as placeholder).
          logo: { '@type': 'ImageObject', url: 'https://tradesaath.com/og-image.svg' },
        },
      }}
    />
  )
}

/* ── HowTo ────────────────────────────────────────────────────── */

export function HowToSchema({
  name,
  description,
  steps,
}: {
  name: string
  description: string
  steps: { name: string; text: string }[]
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name,
        description,
        step: steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      }}
    />
  )
}

/* ── Breadcrumb ───────────────────────────────────────────────── */

export function BreadcrumbSchema({
  items,
}: {
  items: { name: string; url: string }[]
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  )
}

/* ── WebPage ──────────────────────────────────────────────────── */

export function WebPageSchema({
  name,
  description,
  url,
}: {
  name: string
  description: string
  url: string
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name,
        description,
        url,
        isPartOf: {
          '@type': 'WebSite',
          name: 'TradeSaath',
          url: 'https://tradesaath.com',
        },
      }}
    />
  )
}

/* ── DefinedTerm (for glossary) ───────────────────────────────── */

export function DefinedTermSchema({
  name,
  description,
  url,
}: {
  name: string
  description: string
  url: string
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        name,
        description,
        url,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'Trading Psychology Glossary',
          url: 'https://tradesaath.com/glossary',
        },
      }}
    />
  )
}
