import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — TradeSaath',
  description: 'How TradeSaath collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '48px' }}>
          Last updated: April 18, 2026
        </p>

        <Section title="1. Overview">
          <p>
            TradeSaath (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is an AI-powered trading psychology analysis platform operated from India.
            This Privacy Policy explains what personal data we collect, why we collect it, and how we handle it when
            you use our website at <strong>tradesaath.com</strong>.
          </p>
          <p>
            By using TradeSaath you agree to the practices described in this policy. If you do not agree, please stop
            using the service.
          </p>
        </Section>

        <Section title="2. Data We Collect">
          <SubHeading>2.1 Account Information</SubHeading>
          <p>
            We use <strong>Clerk</strong> for authentication. When you sign up or sign in, Clerk collects your
            email address (and optionally your name / profile picture if you use a social login such as Google).
            We receive your Clerk user ID and email address to identify your account within TradeSaath.
          </p>

          <SubHeading>2.2 Trade Data</SubHeading>
          <p>
            When you upload a trade report (CSV, Excel, PDF, or image), the file is stored temporarily in
            <strong> Cloudflare R2</strong> object storage and processed by our AI models. The file may contain
            trade dates, instrument names, quantities, prices, P&amp;L, and other brokerage data you choose to share.
            We do not ask for or want your demat account credentials, passwords, or Aadhaar/PAN details — please
            do not include these in uploads.
          </p>

          <SubHeading>2.3 AI Analysis Results</SubHeading>
          <p>
            The psychological analysis generated from your trade data is stored in our <strong>Supabase</strong> database
            and associated with your account so you can revisit past reports.
          </p>

          <SubHeading>2.4 Payment Information</SubHeading>
          <p>
            Subscription and one-time payments are processed by <strong>Razorpay</strong>. We do not store your card
            number, UPI VPA, or any sensitive payment credentials. We retain the Razorpay order ID, payment ID, and
            plan details for billing records.
          </p>

          <SubHeading>2.5 Usage &amp; Analytics Data</SubHeading>
          <p>
            We may collect anonymised usage data (pages visited, features used, session duration) to improve the
            product. This data is not linked to personally identifiable information.
          </p>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul>
            <li>To authenticate you and maintain your account.</li>
            <li>To process your uploaded trade files and generate AI psychology reports.</li>
            <li>To store and display your past analyses.</li>
            <li>To manage your subscription and send billing-related emails via <strong>Resend</strong>.</li>
            <li>To send product updates or important service notices (you can unsubscribe at any time).</li>
            <li>To detect and prevent fraud or abuse.</li>
            <li>To comply with applicable Indian laws.</li>
          </ul>
          <p>We do not sell your personal data to any third party.</p>
        </Section>

        <Section title="4. AI Processing Disclosure">
          <p>
            Your trade data is sent to large language model (LLM) APIs operated by <strong>Anthropic</strong> (Claude)
            and/or <strong>Google</strong> (Gemini) solely for the purpose of generating the psychology analysis you
            requested. These providers process data according to their own enterprise data-use policies and, to the
            best of our knowledge, do not use your data to train their models under our API agreements.
          </p>
          <p>
            The analysis produced by AI is for <strong>educational and self-reflection purposes only</strong>. It is
            not financial advice, investment advice, or a recommendation to buy or sell any security.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Purpose</Th>
                <Th>Data Shared</Th>
              </tr>
            </thead>
            <tbody>
              <Tr cells={['Clerk', 'Authentication', 'Email, name, social profile']} />
              <Tr cells={['Supabase', 'Database', 'User ID, analysis results, plan info']} />
              <Tr cells={['Anthropic Claude', 'AI analysis', 'Trade data (file contents)']} />
              <Tr cells={['Google Gemini', 'AI analysis', 'Trade data (file contents)']} />
              <Tr cells={['Razorpay', 'Payments', 'Order amount, contact email']} />
              <Tr cells={['Resend', 'Transactional email', 'Your email address']} />
              <Tr cells={['Cloudflare R2', 'File storage', 'Uploaded trade files']} />
            </tbody>
          </table>
        </Section>

        <Section title="6. Cookies &amp; Local Storage">
          <SubHeading>Cookies</SubHeading>
          <ul>
            <li>
              <strong>Clerk session cookie</strong> — set by Clerk to maintain your authenticated session.
              It is essential for the service to function and cannot be disabled while you are signed in.
            </li>
          </ul>
          <SubHeading>Local Storage</SubHeading>
          <ul>
            <li>
              <strong>tradesaath_anon_id</strong> — a randomly generated anonymous identifier stored in your
              browser&apos;s local storage before you sign up. It is used to associate any pre-login activity
              (e.g., a free report) with your account after you sign in. It contains no personal information.
            </li>
          </ul>
          <p>
            We do not use advertising or cross-site tracking cookies.
          </p>
        </Section>

        <Section title="7. Data Retention">
          <p>
            We retain your account data and analysis results for <strong>12 months</strong> after your last login or
            the expiry of your subscription, whichever is later. Uploaded trade files are deleted from Cloudflare R2
            within <strong>30 days</strong> of processing. Payment records are kept for <strong>7 years</strong> as
            required by Indian tax regulations.
          </p>
          <p>
            When you delete your account, all associated personal data is removed from our systems within 30 days,
            except where retention is required by law.
          </p>
        </Section>

        <Section title="8. Data Security">
          <p>
            All data is transmitted over HTTPS. Data at rest in Supabase and Cloudflare R2 is encrypted using
            AES-256. Access to production systems is restricted to authorised personnel only. Despite these measures,
            no system is completely secure; please use a strong password and keep your Clerk session safe.
          </p>
        </Section>

        <Section title="9. Your Rights under DPDP Act 2023">
          <p>
            Under India&apos;s <strong>Digital Personal Data Protection Act, 2023</strong> you have the right to:
          </p>
          <ul>
            <li><strong>Access</strong> — request a summary of the personal data we hold about you.</li>
            <li><strong>Correction</strong> — ask us to correct inaccurate or incomplete data.</li>
            <li><strong>Erasure</strong> — request deletion of your personal data (subject to legal retention obligations).</li>
            <li><strong>Grievance Redressal</strong> — raise a complaint about how we process your data.</li>
            <li><strong>Nominate</strong> — nominate another individual to exercise these rights on your behalf.</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--accent)' }}>
              sandeep.trader1407@gmail.com
            </a>. We will respond within 30 days.
          </p>
        </Section>

        <Section title="10. Children's Privacy">
          <p>
            TradeSaath is not directed at individuals under the age of 18. We do not knowingly collect personal data
            from minors. If you believe a minor has provided us data, please contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this policy from time to time. When we make material changes, we will update the &ldquo;Last
            updated&rdquo; date at the top of this page and, where appropriate, notify you by email. Continued use of
            TradeSaath after changes take effect constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="12. Contact Us">
          <p>For any privacy-related questions or requests, please reach out to:</p>
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 600, color: 'var(--text)', marginTop: '8px', marginBottom: '-4px' }}>
      {children}
    </p>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        background: 'var(--s2)',
        color: 'var(--muted)',
        fontWeight: 600,
        fontSize: '12px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </th>
  )
}

function Tr({ cells }: { cells: string[] }) {
  return (
    <tr>
      {cells.map((cell, i) => (
        <td
          key={i}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            color: i === 0 ? 'var(--text)' : 'var(--text2)',
            fontSize: '14px',
          }}
        >
          {cell}
        </td>
      ))}
    </tr>
  )
}
