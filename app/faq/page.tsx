import type { Metadata } from 'next'
import Link from 'next/link'
import { FAQPageSchema, BreadcrumbSchema, WebPageSchema } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'FAQ — TradeSaath | Trading Psychology Questions Answered',
  description:
    'Frequently asked questions about TradeSaath, AI trading psychology analysis, Decision Quality Score, revenge trading, FOMO detection, and more. Answers for Indian F&O traders.',
  keywords: [
    'TradeSaath FAQ',
    'trading psychology questions',
    'what is revenge trading',
    'what is FOMO in trading',
    'decision quality score',
    'trading journal FAQ',
    'AI trading analysis FAQ',
  ],
  openGraph: {
    title: 'FAQ — TradeSaath',
    description: 'Answers to common questions about AI trading psychology analysis.',
    url: 'https://tradesaath.com/faq',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: 'https://tradesaath.com/faq' },
}

/* ── FAQ Data ──────────────────────────────────────────────────── */

interface FAQItem {
  q: string
  a: string
}

interface FAQCategory {
  id: string
  title: string
  items: FAQItem[]
}

const categories: FAQCategory[] = [
  {
    id: 'about',
    title: 'About TradeSaath',
    items: [
      {
        q: 'What is TradeSaath?',
        a: 'TradeSaath is an AI-powered trading psychology analysis platform that identifies emotional patterns like revenge trading, FOMO entries, and panic exits in your trade history. It gives you a Decision Quality Score (DQS) and personalised coaching to improve your trading discipline.',
      },
      {
        q: 'How does TradeSaath work?',
        a: 'Upload your tradebook (CSV, Excel, or PDF from any broker), and TradeSaath\u2019s AI analyses every trade for psychological patterns. In 60 seconds, you get your DQS score, a session story showing where emotions took over, and specific coaching to fix your patterns.',
      },
      {
        q: 'Which brokers does TradeSaath support?',
        a: 'TradeSaath supports 21+ brokers including Zerodha (Kite), Upstox, Angel One, Groww, Fyers, ICICI Direct, Kotak Neo, 5paisa, Interactive Brokers (IBKR), Robinhood, TD Ameritrade, and more. If your broker isn\u2019t listed, our smart parser auto-detects the format.',
      },
      {
        q: 'Is my trading data safe?',
        a: 'Yes. Your data is encrypted in transit (TLS) and at rest. We use Supabase (PostgreSQL) with row-level security. We never share your individual trading data. Our AI analysis runs server-side and results are stored only in your account.',
      },
      {
        q: 'How much does TradeSaath cost?',
        a: 'Your first analysis is free. After that, plans start at \u20B999 for a single report. Pro Monthly is \u20B9499/month and Pro Yearly is \u20B9399/month (billed annually at \u20B97,999/year). All prices are in INR.',
      },
      {
        q: 'Does TradeSaath give buy/sell signals or stock tips?',
        a: 'No. TradeSaath is a trading psychology tool, not a signals service. It analyses HOW you trade (your emotional patterns, discipline, and decision-making) rather than WHAT to trade. We are not SEBI-registered advisors and never recommend specific trades.',
      },
      {
        q: 'How is TradeSaath different from Zerodha Console or other P&L trackers?',
        a: 'P&L trackers show you WHAT happened (profit/loss numbers). TradeSaath shows you WHY it happened \u2014 the psychological patterns behind your trades. It detects revenge trading, FOMO entries, panic exits, and overtrading that P&L trackers completely miss. It\u2019s your trading psychologist, not your accountant.',
      },
      {
        q: 'Is TradeSaath available on mobile?',
        a: 'TradeSaath is a responsive web application that works well on mobile browsers. You can upload your tradebook and view results on your phone. A dedicated mobile app is planned for the future.',
      },
    ],
  },
  {
    id: 'psychology',
    title: 'Trading Psychology',
    items: [
      {
        q: 'What is revenge trading and how do I stop it?',
        a: 'Revenge trading is entering a new trade immediately after a loss, driven by the desire to recover lost money rather than following a strategy. TradeSaath detects revenge trades by analysing re-entries on the same symbol within minutes of a loss, position size escalation, and losing streak patterns. The best fix: close your terminal for 15 minutes after any loss.',
      },
      {
        q: 'What is FOMO in trading?',
        a: 'FOMO (Fear of Missing Out) in trading is entering a position because the market is moving quickly and you\u2019re afraid of missing the opportunity. Signs include oversized positions, entries in the first 2 minutes of market open, and chasing price moves. TradeSaath\u2019s multi-signal detector identifies FOMO entries and calculates their exact cost in rupees.',
      },
      {
        q: 'What is the Decision Quality Score (DQS)?',
        a: 'The Decision Quality Score is TradeSaath\u2019s proprietary 0\u2013100 measure of HOW you trade, not just whether you profit. It evaluates 7 factors: Risk Management, Emotional Control, Position Sizing, Exit Discipline, Entry Quality, Exit Timing, and Rule Following. Average traders score 41. Consistently profitable traders score 58+. Top 10% score 72+.',
      },
      {
        q: 'What is the Vicious Cycle in trading?',
        a: 'The Vicious Cycle is TradeSaath\u2019s 8-stage model of emotional escalation in trading: (1) Disciplined Win \u2192 (2) Overconfidence Builds \u2192 (3) Oversized Position \u2192 (4) Market Reversal \u2192 (5) Hope & Hold \u2192 (6) Panic Exit \u2192 (7) Revenge Trade \u2192 (8) FOMO Re-entry. Understanding this cycle helps traders interrupt it before losses compound.',
      },
      {
        q: 'How do I improve my trading psychology?',
        a: 'Start by tracking your patterns. Upload your last month of trades to TradeSaath and identify your #1 emotional pattern. Then focus on one rule: if your biggest issue is revenge trading, implement the 15-minute break rule after every loss. TradeSaath\u2019s AI companion Saathi gives you daily coaching specific to your patterns.',
      },
      {
        q: 'What is overtrading and why is it dangerous?',
        a: 'Overtrading means taking more trades than your strategy or capital warrant, often driven by boredom, excitement, or the urge to \u201Cmake back\u201D losses. TradeSaath detects overtrading by analysing trade frequency spikes, declining win rates within sessions, and increasing position sizes late in the day. Overtrading is the #1 pattern that erodes profits for Indian F&O traders.',
      },
      {
        q: 'What is panic selling or a panic exit?',
        a: 'Panic selling is exiting a position prematurely due to fear when the market moves against you, often locking in a loss that would have recovered. TradeSaath identifies panic exits by looking at exit timing relative to intraday low points, position holding duration anomalies, and premature stop-loss triggers.',
      },
      {
        q: 'What does "excess loss from mistakes" mean?',
        a: 'Excess loss from mistakes is TradeSaath\u2019s calculation of how much money you lost specifically due to emotional trading errors (revenge trades, FOMO entries, panic exits) versus disciplined trades. It shows you the exact rupee cost of your psychological patterns \u2014 making the invisible visible.',
      },
    ],
  },
  {
    id: 'features',
    title: 'Features & Tools',
    items: [
      {
        q: 'Who or what is Saathi?',
        a: 'Saathi is TradeSaath\u2019s AI coaching companion. It analyses your trading patterns and provides personalised, contextual coaching based on YOUR specific data. Unlike generic trading advice, Saathi knows your history \u2014 your FOMO tendency, your revenge trading triggers, your risk management scores \u2014 and coaches you accordingly.',
      },
      {
        q: 'How does the trading heatmap work?',
        a: 'The heatmap visualises your trading performance across time-of-day and day-of-week. Green cells show profitable periods, red cells show loss-making periods. It reveals patterns like \u201CI consistently lose money in the first 15 minutes\u201D or \u201CFriday afternoons are my worst.\u201D This helps you avoid trading during your weakest windows.',
      },
      {
        q: 'Can I upload trades from multiple brokers?',
        a: 'Yes. Upload files from any broker in CSV, Excel, or PDF format. TradeSaath auto-detects the broker and maps columns automatically. You can upload multiple sessions from different brokers and they\u2019ll all be analysed.',
      },
      {
        q: 'How can I export my analysis?',
        a: 'Your full analysis report is available in your dashboard. You can view your DQS score, session story, pattern breakdown, and coaching recommendations on-screen. PDF export functionality is coming soon.',
      },
      {
        q: 'Does TradeSaath work for stocks (not just F&O)?',
        a: 'Yes. While TradeSaath specialises in Indian F&O (Futures & Options) trading on NSE, particularly Nifty and BankNifty options, it works for equity trades too. The psychological patterns \u2014 revenge trading, FOMO, overtrading \u2014 are the same across all instruments.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical',
    items: [
      {
        q: 'What file formats are supported?',
        a: 'CSV (.csv), Excel (.xlsx, .xls), PDF (tradebook/contract note), and image files (screenshots processed by AI). Most traders export CSV from their broker\u2019s tradebook section.',
      },
      {
        q: 'How is P&L calculated?',
        a: 'TradeSaath pairs buy and sell trades on the same symbol within the same day using FIFO (First In, First Out) matching. P&L = (exit price \u2013 entry price) \u00D7 quantity for long trades, and (entry price \u2013 exit price) \u00D7 quantity for short trades.',
      },
      {
        q: 'Does TradeSaath work for options trading?',
        a: 'Yes. TradeSaath specialises in Indian F&O (Futures & Options) trading on NSE, particularly Nifty and BankNifty options. It auto-detects option symbols, strike prices, and lot sizes from your tradebook.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Account',
    items: [
      {
        q: 'What payment methods does TradeSaath accept?',
        a: 'TradeSaath uses Razorpay for payments. You can pay via UPI (Google Pay, PhonePe, Paytm), credit cards, debit cards, net banking, and popular wallets. All transactions are processed in Indian Rupees (INR).',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'You can cancel your Pro subscription anytime from your Account/Billing settings. Your access continues until the end of the current billing period. No partial refunds are given for unused days on monthly plans. Yearly plans have a 7-day refund window.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes. Your very first analysis is completely free \u2014 no credit card required. Upload your tradebook and see your Decision Quality Score, pattern analysis, and coaching recommendations before deciding to subscribe.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Single reports are non-refundable (instant digital delivery). Monthly subscriptions have no partial refunds. Yearly plans offer a full refund within 7 days of purchase if fewer than 3 reports have been generated. See our full refund policy for details.',
      },
    ],
  },
]

const allFaqs = categories.flatMap((cat) => cat.items)

/* ── Page Component ────────────────────────────────────────────── */

export default function FAQPage() {
  return (
    <main
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        paddingTop: '80px',
        paddingBottom: '80px',
      }}
    >
      {/* Structured data */}
      <FAQPageSchema faqs={allFaqs} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://tradesaath.com' },
          { name: 'FAQ', url: 'https://tradesaath.com/faq' },
        ]}
      />
      <WebPageSchema
        name="TradeSaath FAQ"
        description="Frequently asked questions about AI trading psychology analysis, Decision Quality Score, and more."
        url="https://tradesaath.com/faq"
      />

      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '0 24px',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <p
          style={{
            color: 'var(--accent)',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          FAQ
        </p>
        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 40px)',
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: '12px',
          }}
        >
          Frequently Asked Questions
        </h1>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: '15px',
            lineHeight: 1.6,
            marginBottom: '40px',
            maxWidth: '560px',
          }}
        >
          Everything you need to know about TradeSaath, AI trading psychology analysis, and improving your trading discipline.
        </p>

        {/* Category quick-links */}
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '48px',
          }}
        >
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text2)',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
            >
              {cat.title}
            </a>
          ))}
        </nav>

        {/* FAQ Categories */}
        {categories.map((cat) => (
          <section key={cat.id} id={cat.id} style={{ marginBottom: '48px' }}>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--text)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '10px',
                marginBottom: '24px',
              }}
            >
              {cat.title}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {cat.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--s2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '20px 24px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: '10px',
                      lineHeight: 1.4,
                    }}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--text2)',
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Internal links */}
        <section
          style={{
            marginTop: '48px',
            paddingTop: '32px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '16px',
            }}
          >
            Explore more
          </h2>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <InternalLink href="/glossary" label="Trading Psychology Glossary" desc="15 key terms defined" />
            <InternalLink href="/pricing" label="Pricing Plans" desc="Starting from \u20B999" />
            <InternalLink href="/" label="How It Works" desc="3-step analysis flow" />
          </div>
        </section>
      </div>
    </main>
  )
}

function InternalLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '14px 20px',
        background: 'var(--s2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        textDecoration: 'none',
        flex: '1 1 200px',
        minWidth: '200px',
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>{label}</span>
      <br />
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{desc}</span>
    </Link>
  )
}
