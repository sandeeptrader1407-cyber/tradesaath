import type { Metadata } from 'next'
import Link from 'next/link'
import { BreadcrumbSchema, WebPageSchema, JsonLd } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Trading Psychology Glossary — TradeSaath | 15 Key Terms Defined',
  description:
    'Trading psychology glossary: clear definitions for revenge trading, FOMO, panic selling, overtrading, Decision Quality Score, tilt, and more. Learn what these terms mean and how TradeSaath detects them.',
  keywords: [
    'revenge trading definition',
    'FOMO trading meaning',
    'panic selling definition',
    'overtrading definition',
    'trading psychology terms',
    'decision quality score',
    'trading discipline glossary',
  ],
  openGraph: {
    title: 'Trading Psychology Glossary — TradeSaath',
    description: '15 key trading psychology terms defined with AI detection insights.',
    url: 'https://tradesaath.com/glossary',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: 'https://tradesaath.com/glossary' },
}

/* ── Glossary Data ─────────────────────────────────────────────── */

interface GlossaryTerm {
  id: string
  term: string
  definition: string
  explanation: string
  howTradeSaathHelps: string
  relatedLink?: { href: string; label: string }
}

const terms: GlossaryTerm[] = [
  {
    id: 'revenge-trading',
    term: 'Revenge Trading',
    definition:
      'Revenge trading is the impulsive act of entering a new trade immediately after a loss with the sole motivation of recovering the lost money, bypassing strategy and risk management rules in the process.',
    explanation:
      'Revenge trading is one of the most destructive emotional patterns in trading. After a loss, the brain\u2019s fight-or-flight response kicks in. Instead of stepping back to reassess, the trader doubles down \u2014 often increasing position size, switching to a different instrument, or entering without a clear setup. The result is typically a larger loss that compounds the original damage. Studies of retail F&O traders in India show that revenge trades have a win rate 23% lower than planned trades.',
    howTradeSaathHelps:
      'TradeSaath detects revenge trades by analysing re-entries on the same symbol within minutes of a loss, sudden position size increases after losing trades, and losing streak patterns. Your DQS score reflects the impact, and Saathi coaches you on implementing a 15-minute cooling-off rule.',
  },
  {
    id: 'fomo-trading',
    term: 'FOMO Trading (Fear of Missing Out)',
    definition:
      'FOMO trading is entering a position because the market is moving rapidly and you fear missing a profitable opportunity, rather than because your strategy signals an entry.',
    explanation:
      'FOMO is triggered by seeing large candles, social media hype, or hearing that others are making money on a particular move. The trader abandons their plan and chases price, often buying near the top or selling near the bottom. Classic signs include entries in the first 2 minutes of market open, oversized positions relative to normal, and trades on instruments the trader doesn\u2019t usually trade. FOMO entries in Nifty options on expiry days are among the costliest mistakes Indian traders make.',
    howTradeSaathHelps:
      'TradeSaath\u2019s multi-signal FOMO detector analyses entry timing, position size anomalies, and symbol deviation from your usual watchlist. It calculates the exact rupee cost of FOMO entries in your trading history.',
  },
  {
    id: 'panic-selling',
    term: 'Panic Selling / Panic Exit',
    definition:
      'Panic selling is the premature closure of a position driven by fear when the market moves against you, often resulting in locking in a loss that the trade would have recovered from.',
    explanation:
      'Panic exits happen when a trader\u2019s pain threshold is reached before their stop loss is hit. The trade moves against them, anxiety builds, and they exit manually at a worse price than their planned stop. Ironically, panic sellers often watch the price reverse moments after they exit. This pattern is especially common in options trading where premium decay and volatility spikes amplify fear.',
    howTradeSaathHelps:
      'TradeSaath identifies panic exits by analysing exit timing relative to intraday low points, comparing actual exit price versus planned stop loss (if detectable), and measuring holding duration anomalies across your trades.',
  },
  {
    id: 'overtrading',
    term: 'Overtrading',
    definition:
      'Overtrading is taking significantly more trades than your strategy warrants, often driven by boredom, excitement, or the compulsion to be constantly active in the market.',
    explanation:
      'Overtrading erodes profits through excessive brokerage, slippage, and the compounding effect of taking low-quality setups. A trader with a solid 60% win rate on planned trades might see it drop to 40% when they add impulsive trades. The pattern is especially dangerous for Indian F&O traders where STT and brokerage costs are significant. Overtrading often intensifies late in the trading session as desperation to end the day profitable sets in.',
    howTradeSaathHelps:
      'TradeSaath detects overtrading by analysing trade frequency spikes (comparing your current session to your historical average), declining win rate within sessions, and increasing position sizes late in the day.',
  },
  {
    id: 'averaging-down',
    term: 'Averaging Down',
    definition:
      'Averaging down is the practice of buying more of a losing position to reduce your average entry price, often without a strategic basis and driven by the hope that the position will recover.',
    explanation:
      'While averaging down can be a valid strategy when planned in advance with clear rules, emotional averaging is dangerous. It\u2019s typically driven by loss aversion \u2014 the trader can\u2019t accept the loss and keeps adding to the position. In options trading, this is especially risky as time decay works against the position. Many large blowups in Indian retail trading come from averaging down on losing options positions on expiry day.',
    howTradeSaathHelps:
      'TradeSaath flags instances where you added to losing positions without a pre-planned averaging strategy, quantifying the extra loss incurred from emotional averaging versus cutting losses at the original stop.',
  },
  {
    id: 'trading-psychology',
    term: 'Trading Psychology',
    definition:
      'Trading psychology is the study of how cognitive biases, emotions, and mental states influence a trader\u2019s decision-making, discipline, and ultimately their profitability.',
    explanation:
      'Trading psychology encompasses everything from well-known biases like loss aversion and confirmation bias to the emotional rollercoaster of fear, greed, hope, and regret that traders experience daily. Research consistently shows that the difference between profitable and unprofitable traders is rarely strategy \u2014 it\u2019s psychological execution. A trader who follows their rules 90% of the time will dramatically outperform one who follows them 70% of the time, even with an inferior strategy.',
    howTradeSaathHelps:
      'TradeSaath is built entirely around trading psychology. Every metric, from the DQS score to the pattern breakdown, measures HOW you trade rather than just whether you profit. It makes the invisible psychological dimension visible and actionable.',
    relatedLink: { href: '/faq#psychology', label: 'Trading Psychology FAQ' },
  },
  {
    id: 'decision-quality-score',
    term: 'Decision Quality Score (DQS)',
    definition:
      'The Decision Quality Score is TradeSaath\u2019s proprietary 0\u2013100 metric that measures the quality of your trading decisions across seven dimensions, independent of P&L outcomes.',
    explanation:
      'DQS separates process from outcome. A trade can be profitable despite being a bad decision (luck), and a trade can be a loss despite being a good decision (variance). DQS evaluates: Risk Management (position sizing, stop losses), Emotional Control (absence of revenge/FOMO trades), Position Sizing (consistency), Exit Discipline (sticking to planned exits), Entry Quality (timing and setup), Exit Timing (not panicking), and Rule Following (overall discipline). Average traders score around 41. Consistently profitable traders score 58+. The top 10% score 72+.',
    howTradeSaathHelps:
      'DQS is TradeSaath\u2019s core metric. After uploading your tradebook, you receive your DQS score with a breakdown of all seven factors, specific coaching on your weakest dimension, and tracking over time to measure improvement.',
  },
  {
    id: 'vicious-cycle',
    term: 'Vicious Cycle (Trading)',
    definition:
      'The Vicious Cycle is TradeSaath\u2019s 8-stage model that maps the emotional escalation pattern most traders fall into: from disciplined trading to emotional destruction and back.',
    explanation:
      'The eight stages are: (1) Disciplined Win \u2192 (2) Overconfidence Builds \u2192 (3) Oversized Position \u2192 (4) Market Reversal \u2192 (5) Hope & Hold \u2192 (6) Panic Exit \u2192 (7) Revenge Trade \u2192 (8) FOMO Re-entry. Most traders cycle through this pattern repeatedly without realising it. The key insight is that the cycle often starts from a WIN, not a loss \u2014 success breeds overconfidence, which leads to the eventual blowup. Recognising which stage you\u2019re in is the first step to breaking the cycle.',
    howTradeSaathHelps:
      'TradeSaath maps your trades onto the Vicious Cycle, showing you exactly which stage your session reached and where you could have interrupted it. Your session story narrates the escalation in plain language.',
    relatedLink: { href: '/faq#psychology', label: 'What is the Vicious Cycle?' },
  },
  {
    id: 'position-sizing',
    term: 'Position Sizing',
    definition:
      'Position sizing is the discipline of determining how much capital to allocate to each individual trade, based on your account size, risk tolerance, and the specific setup\u2019s risk/reward ratio.',
    explanation:
      'Proper position sizing is arguably the most important aspect of risk management. Even a strategy with a 70% win rate can blow up an account if position sizes are too large during the 30% of losses. The general rule is to risk no more than 1\u20132% of your trading capital on any single trade. Emotional traders often violate this after wins (overconfidence) or losses (revenge), dramatically increasing exposure.',
    howTradeSaathHelps:
      'TradeSaath analyses your position sizing consistency across all trades, flagging anomalies where you deviated significantly from your average size. It correlates size changes with win/loss streaks to show if emotions are driving your sizing decisions.',
  },
  {
    id: 'risk-management',
    term: 'Risk Management (Trading)',
    definition:
      'Risk management in trading is the practice of identifying, assessing, and controlling potential losses through tools like stop losses, position sizing, portfolio diversification, and daily loss limits.',
    explanation:
      'Risk management is what keeps you in the game long enough for your edge to play out. It includes setting stop losses for every trade, defining maximum daily loss limits, maintaining consistent position sizes, avoiding overexposure to correlated trades, and having a plan for adverse market events. Professional traders focus on risk management before profit targets \u2014 protecting capital is job #1.',
    howTradeSaathHelps:
      'Risk Management is one of the seven DQS factors TradeSaath evaluates. It analyses whether your trades had implicit stop losses, whether you respected them, and how your risk/reward ratio compared to your historical average.',
  },
  {
    id: 'stop-loss',
    term: 'Stop Loss',
    definition:
      'A stop loss is a predetermined price level at which a trader exits a losing position to limit their loss, serving as a risk management tool that removes emotion from the exit decision.',
    explanation:
      'Stop losses work because they make the exit decision in advance, when you\u2019re thinking clearly, rather than in the heat of the moment when fear and hope cloud judgment. The two main types are hard stops (orders placed with the broker) and mental stops (price levels where you plan to exit manually). Mental stops are less reliable because emotions can override them. Common mistakes include setting stops too tight (getting stopped out by normal volatility) or too wide (taking unnecessarily large losses).',
    howTradeSaathHelps:
      'TradeSaath analyses your exit patterns to determine if you\u2019re using effective stop losses. It detects trades where you held through significant drawdowns without exiting (no stop) and trades where you exited at the worst possible moment (panic exit overriding the stop).',
  },
  {
    id: 'trading-journal',
    term: 'Trading Journal',
    definition:
      'A trading journal is a systematic record of every trade you take, including the rationale for entry and exit, emotions felt during the trade, and lessons learned, used to identify patterns and improve over time.',
    explanation:
      'Keeping a trading journal is consistently cited by professional traders as one of the most impactful habits for improvement. A good journal goes beyond P&L records to capture your emotional state, confidence level, and whether you followed your rules. Reviewing your journal weekly reveals patterns invisible in real-time: you might discover you always overtrade on Tuesdays, or that your win rate drops after 2 PM.',
    howTradeSaathHelps:
      'TradeSaath includes a built-in trading journal where you can add reflections to each analysis session. Combined with AI-detected patterns, it creates a comprehensive view of your psychological evolution as a trader.',
    relatedLink: { href: '/faq#features', label: 'Features & Tools FAQ' },
  },
  {
    id: 'emotional-trading',
    term: 'Emotional Trading',
    definition:
      'Emotional trading is any trade execution driven primarily by feelings such as fear, greed, hope, frustration, or excitement rather than by a pre-defined strategy and objective criteria.',
    explanation:
      'Every trader experiences emotions \u2014 the goal isn\u2019t to eliminate them but to prevent them from driving decisions. Emotional trading manifests as larger-than-normal positions (greed), holding losers too long (hope), cutting winners too early (fear), and rapid-fire trades after losses (frustration). The key indicator is deviation from your trading plan. If you can\u2019t articulate why you entered a trade in strategic terms, it was likely emotional.',
    howTradeSaathHelps:
      'TradeSaath\u2019s Emotional Control metric in the DQS directly measures the presence of emotional trading patterns. It identifies specific trades flagged as emotional and calculates their aggregate cost to your P&L.',
  },
  {
    id: 'tilt',
    term: 'Tilt (Trading)',
    definition:
      'Tilt in trading is a state of emotional frustration or mental imbalance, borrowed from poker, where a series of negative outcomes causes a trader to abandon discipline and make increasingly irrational decisions.',
    explanation:
      'Tilt is the extreme end of emotional trading \u2014 a cascading failure where each bad decision feeds the next. It typically starts with an unexpected loss, escalates through revenge trading, and can end with account-damaging decisions like removing stop losses, going all-in, or trading through end of day with huge exposure. Recognising tilt early is critical. Warning signs include elevated heart rate, inability to step away from the screen, and thinking \u201Cjust one more trade.\u201D',
    howTradeSaathHelps:
      'TradeSaath detects tilt sessions by analysing the escalation pattern: increasing trade frequency, growing position sizes, declining win rates, and shortening holding periods within a single session. It pinpoints the exact trade where tilt began.',
  },
  {
    id: 'trading-discipline',
    term: 'Trading Discipline',
    definition:
      'Trading discipline is the consistent ability to follow your pre-defined trading rules, risk management parameters, and strategy regardless of emotional state, market conditions, or recent outcomes.',
    explanation:
      'Discipline is the bridge between strategy and results. A mediocre strategy executed with perfect discipline will outperform a brilliant strategy executed with poor discipline. Building trading discipline is a skill, not a trait \u2014 it can be developed through practice, journaling, and accountability. The most effective approach is to focus on one rule at a time: if your biggest problem is overtrading, commit to a maximum of 5 trades per day for a month before addressing other issues.',
    howTradeSaathHelps:
      'TradeSaath\u2019s DQS directly measures discipline through its Rule Following factor. Over time, your DQS trend shows whether your discipline is improving. Saathi provides personalised coaching focused on your weakest discipline area.',
    relatedLink: { href: '/faq#psychology', label: 'How to improve trading psychology' },
  },
]

/* ── Page Component ────────────────────────────────────────────── */

export default function GlossaryPage() {
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
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://tradesaath.com' },
          { name: 'Glossary', url: 'https://tradesaath.com/glossary' },
        ]}
      />
      <WebPageSchema
        name="Trading Psychology Glossary"
        description="15 key trading psychology terms defined with AI detection insights."
        url="https://tradesaath.com/glossary"
      />
      {/* DefinedTerm schema for each term */}
      {terms.map((t) => (
        <JsonLd
          key={t.id}
          data={{
            '@context': 'https://schema.org',
            '@type': 'DefinedTerm',
            name: t.term,
            description: t.definition,
            url: `https://tradesaath.com/glossary#${t.id}`,
            inDefinedTermSet: {
              '@type': 'DefinedTermSet',
              name: 'Trading Psychology Glossary',
              url: 'https://tradesaath.com/glossary',
            },
          }}
        />
      ))}

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
          Glossary
        </p>
        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 40px)',
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: '12px',
          }}
        >
          Trading Psychology Glossary
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
          Clear, answer-first definitions of 15 key trading psychology terms. Each entry explains the concept, why it matters, and how TradeSaath detects or helps with it.
        </p>

        {/* Quick navigation */}
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '48px',
          }}
        >
          {terms.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text2)',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              {t.term}
            </a>
          ))}
        </nav>

        {/* Terms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {terms.map((t) => (
            <article
              key={t.id}
              id={t.id}
              style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '24px 28px',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--accent)',
                  marginBottom: '12px',
                }}
              >
                {t.term}
              </h2>

              {/* Answer-first definition */}
              <p
                style={{
                  fontSize: '15px',
                  color: 'var(--text)',
                  lineHeight: 1.7,
                  marginBottom: '16px',
                  fontWeight: 500,
                }}
              >
                {t.definition}
              </p>

              {/* Deeper explanation */}
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--text2)',
                  lineHeight: 1.7,
                  marginBottom: '16px',
                }}
              >
                {t.explanation}
              </p>

              {/* How TradeSaath helps */}
              <div
                style={{
                  background: 'rgba(0,207,130,0.06)',
                  border: '1px solid rgba(0,207,130,0.15)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  How TradeSaath Helps
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text2)',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {t.howTradeSaathHelps}
                </p>
              </div>

              {/* Related link */}
              {t.relatedLink && (
                <Link
                  href={t.relatedLink.href}
                  style={{
                    display: 'inline-block',
                    marginTop: '12px',
                    fontSize: '13px',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  \u2192 {t.relatedLink.label}
                </Link>
              )}
            </article>
          ))}
        </div>

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
            Related pages
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <InternalLink href="/faq" label="FAQ" desc="25+ questions answered" />
            <InternalLink href="/pricing" label="Pricing" desc="Plans from \u20B999" />
            <InternalLink href="/" label="Try TradeSaath" desc="Free first analysis" />
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
