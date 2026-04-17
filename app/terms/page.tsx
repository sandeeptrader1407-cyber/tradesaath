import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — TradeSaath',
  description: 'Terms and conditions for using the TradeSaath platform.',
}

export default function TermsPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: '80px', paddingBottom: '80px' }}>
      <div
        style={{
          maxWidth: '700px',
          margin: '0 auto',
          padding: '0 24px',
          color: 'var(--text)',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
          Legal
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, lineHeight: 1.15, marginBottom: '12px' }}>
          Terms of Service
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '48px' }}>
          Last updated: April 18, 2026
        </p>

        {/* Prominent disclaimer */}
        <div
          style={{
            background: 'rgba(240,93,108,0.08)',
            border: '1px solid rgba(240,93,108,0.25)',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            marginBottom: '40px',
          }}
        >
          <p style={{ color: '#f05d6c', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
            NOT Investment Advice
          </p>
          <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
            TradeSaath provides trading psychology insights for <strong>educational and self-reflection
            purposes only</strong>. Nothing on this platform constitutes investment advice, financial advice,
            trading advice, or any recommendation to buy, sell, or hold any security, cryptocurrency, or
            financial instrument. Always consult a SEBI-registered investment adviser before making financial
            decisions.
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using TradeSaath (&ldquo;the Service&rdquo;) at <strong>tradesaath.com</strong>, you agree to
            be bound by these Terms of Service (&ldquo;Terms&rdquo;) and our{' '}
            <a href="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</a>. If you do not agree,
            you must not use the Service.
          </p>
          <p>
            These Terms form a legally binding agreement between you and TradeSaath, operated from India.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            TradeSaath is an AI-powered trading psychology analysis platform. You can upload brokerage trade
            reports and receive AI-generated insights about your trading behaviour, emotional patterns, and
            psychological tendencies. The Service includes:
          </p>
          <ul>
            <li>AI psychology analysis of uploaded trade data.</li>
            <li>A personal trading journal and reflection tools.</li>
            <li>An AI coaching chat interface.</li>
            <li>A trading journey tracker.</li>
          </ul>
          <p>
            Plans available: <strong>Free</strong>, <strong>Single Report</strong>,{' '}
            <strong>Pro Monthly</strong> (₹799/month), and <strong>Pro Yearly</strong> (₹7,999/year).
          </p>
        </Section>

        <Section title="3. Not Investment or Financial Advice">
          <p>
            <strong>TradeSaath is not a SEBI-registered investment adviser, research analyst, or financial
            intermediary.</strong> The AI-generated reports and insights are based on pattern recognition in
            your own historical trade data and are intended solely to help you reflect on your trading psychology.
          </p>
          <p>
            Nothing produced by TradeSaath should be construed as:
          </p>
          <ul>
            <li>A recommendation to enter or exit any trade or investment.</li>
            <li>A prediction of future market performance.</li>
            <li>Research or analysis under the SEBI (Research Analysts) Regulations, 2014.</li>
            <li>Portfolio management advice under the SEBI (Portfolio Managers) Regulations, 2020.</li>
            <li>Investment advisory services under the SEBI (Investment Advisers) Regulations, 2013.</li>
          </ul>
          <p>
            You accept full responsibility for all trading and investment decisions you make. Past performance
            reflected in your uploaded data is not indicative of future results.
          </p>
        </Section>

        <Section title="4. SEBI Disclaimer">
          <p>
            TradeSaath is <strong>not registered with or regulated by the Securities and Exchange Board of
            India (SEBI)</strong>. We do not provide stock tips, calls, or signals. If you receive any
            communication claiming to be from TradeSaath that recommends specific trades, please report it
            to us immediately as it is fraudulent.
          </p>
        </Section>

        <Section title="5. Eligibility &amp; Account">
          <p>
            You must be at least 18 years old and legally capable of entering into a binding contract under
            Indian law to use TradeSaath. By using the Service, you represent that you meet these requirements.
          </p>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all
            activity that occurs under your account. Notify us immediately at{' '}
            <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--accent)' }}>
              sandeep.trader1407@gmail.com
            </a>{' '}
            if you suspect unauthorised access.
          </p>
        </Section>

        <Section title="6. Acceptable Use">
          <p>You agree <strong>not</strong> to:</p>
          <ul>
            <li>Upload files containing malware, exploits, or content that could harm our systems.</li>
            <li>Attempt to reverse-engineer, scrape, or extract data from the Service at scale.</li>
            <li>Use automated bots or scripts to interact with the Service without our written permission.</li>
            <li>Upload data belonging to another person without their consent.</li>
            <li>Resell, redistribute, or publicly republish AI analysis reports without attribution.</li>
            <li>Use the Service for any unlawful purpose or in violation of applicable Indian law.</li>
            <li>Circumvent any usage limits, authentication, or payment requirements.</li>
          </ul>
        </Section>

        <Section title="7. Intellectual Property">
          <p>
            <strong>Our IP:</strong> The TradeSaath platform, brand, design, AI prompt architecture, and all
            content created by us are owned by TradeSaath and protected by applicable intellectual property laws.
            You may not copy, reproduce, or create derivative works without our express written consent.
          </p>
          <p>
            <strong>Your data:</strong> You retain ownership of the trade data you upload. By uploading data,
            you grant TradeSaath a limited, non-exclusive licence to process it for the sole purpose of
            providing the Service to you.
          </p>
          <p>
            <strong>Generated reports:</strong> AI-generated analysis reports are provided to you for your
            personal use. You may export and use them for personal reflection but may not commercially
            distribute them.
          </p>
        </Section>

        <Section title="8. Payments &amp; Subscriptions">
          <p>
            Payments are processed by Razorpay and are subject to Razorpay&apos;s terms. Subscription plans
            renew automatically unless cancelled. Prices are in Indian Rupees (INR) and inclusive of applicable
            taxes. We reserve the right to change pricing with 30 days&apos; notice.
          </p>
          <p>
            Refunds are governed by our{' '}
            <a href="/refund" style={{ color: 'var(--accent)' }}>Refund Policy</a>.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, TradeSaath and its operators shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages, including but
            not limited to:
          </p>
          <ul>
            <li>Trading losses arising from reliance on AI-generated insights.</li>
            <li>Loss of data due to technical failures.</li>
            <li>Interruptions or errors in the Service.</li>
          </ul>
          <p>
            Our total aggregate liability to you for any claim arising under these Terms shall not exceed the
            amount you paid us in the <strong>three months</strong> preceding the event giving rise to the claim.
          </p>
        </Section>

        <Section title="10. Disclaimer of Warranties">
          <p>
            The Service is provided <strong>&ldquo;as is&rdquo;</strong> and <strong>&ldquo;as available&rdquo;</strong> without
            warranties of any kind, express or implied, including merchantability, fitness for a particular
            purpose, or non-infringement. We do not warrant that the AI outputs are accurate, complete, or
            suitable for any specific purpose.
          </p>
        </Section>

        <Section title="11. Account Termination">
          <p>
            We may suspend or terminate your account if you violate these Terms, engage in fraudulent activity,
            or abuse the Service. You may delete your account at any time from your account settings or by
            emailing us. Upon termination, your right to access the Service ceases immediately.
          </p>
        </Section>

        <Section title="12. Modifications to the Service">
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Service at any time.
            We will provide reasonable notice for material changes that affect paid subscribers.
          </p>
        </Section>

        <Section title="13. Governing Law &amp; Dispute Resolution">
          <p>
            These Terms are governed by the laws of <strong>India</strong>. Any disputes shall first be
            attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes
            shall be subject to the exclusive jurisdiction of the courts located in India.
          </p>
        </Section>

        <Section title="14. Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will notify you of material changes by updating
            the &ldquo;Last updated&rdquo; date and, where appropriate, by email. Continued use of the Service after
            changes constitutes your acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="15. Contact Us">
          <p>For any questions about these Terms, please contact:</p>
          <address style={{ fontStyle: 'normal', lineHeight: 1.8, color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text)' }}>TradeSaath</strong><br />
            India<br />
            Email:{' '}
            <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--accent)' }}>
              sandeep.trader1407@gmail.com
            </a>
          </address>
        </Section>
      </div>
    </main>
  )
}

/* ── Helpers ────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '10px',
          marginBottom: '16px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          color: 'var(--text2)',
          fontSize: '15px',
          lineHeight: '1.7',
        }}
      >
        {children}
      </div>
    </section>
  )
}
