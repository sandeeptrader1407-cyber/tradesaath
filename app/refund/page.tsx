import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refund Policy — TradeSaath',
  description: 'TradeSaath cancellation and refund policy for all plans.',
}

export default function RefundPage() {
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
          Refund &amp; Cancellation Policy
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '48px' }}>
          Last updated: April 18, 2026
        </p>

        <Section title="1. Overview">
          <p>
            We want you to be satisfied with TradeSaath. This policy explains the refund and cancellation
            rules for each of our plans. Please read it before making a purchase.
          </p>
          <p>
            All payments are processed in Indian Rupees (INR) through <strong>Razorpay</strong>. Refunds,
            where applicable, are returned via the original payment method.
          </p>
        </Section>

        {/* Plan cards */}
        <section style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '10px',
              marginBottom: '24px',
            }}
          >
            2. Refund Rules by Plan
          </h2>

          {/* Single Report */}
          <PlanCard
            badge="One-time"
            name="Single Report"
            badgeColor="var(--blue)"
            items={[
              { label: 'Refund eligibility', value: 'No refunds', highlight: true },
              { label: 'Reason', value: 'The AI analysis report is generated and delivered instantly upon purchase. Because digital delivery is immediate and the service is fully consumed at that point, we are unable to offer refunds for Single Report purchases.' },
              { label: 'Exception', value: 'If you are charged but no report is generated due to a technical error on our end, you are entitled to a full refund. Please contact us within 7 days with your order details.' },
            ]}
          />

          {/* Pro Monthly */}
          <PlanCard
            badge="₹799 / month"
            name="Pro Monthly"
            badgeColor="var(--accent)"
            items={[
              { label: 'Cancellation', value: 'Cancel anytime from your account settings. Your Pro access continues until the end of the current billing period.' },
              { label: 'Refund eligibility', value: 'No partial refunds for unused days in the current billing month.', highlight: true },
              { label: 'Auto-renewal', value: 'Your subscription renews automatically each month. You will receive a reminder email before renewal. Cancel before the renewal date to avoid being charged.' },
            ]}
          />

          {/* Pro Yearly */}
          <PlanCard
            badge="₹7,999 / year"
            name="Pro Yearly"
            badgeColor="var(--gold)"
            items={[
              { label: 'Refund window', value: '7 days from the date of purchase.' },
              { label: 'Refund eligibility', value: 'Full refund available if you request within 7 days of purchase and have generated fewer than 3 AI reports.', highlight: false },
              { label: 'After 7 days', value: 'No refunds are available after the 7-day window has passed.', highlight: true },
              { label: 'Cancellation', value: 'You can cancel auto-renewal at any time. Your Pro access continues until the end of the annual period.' },
            ]}
          />

          {/* Free */}
          <PlanCard
            badge="Free"
            name="Free Plan"
            badgeColor="var(--muted)"
            items={[
              { label: 'Refund eligibility', value: 'Not applicable — the Free plan has no charges.' },
            ]}
          />
        </section>

        <Section title="3. How to Request a Refund">
          <p>
            To request a refund, email us at{' '}
            <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--accent)' }}>
              sandeep.trader1407@gmail.com
            </a>{' '}
            with the subject line <strong>&ldquo;Refund Request — [Your Plan]&rdquo;</strong> and include:
          </p>
          <ul>
            <li>The email address associated with your TradeSaath account.</li>
            <li>Your Razorpay Order ID or Payment ID (found in your payment confirmation email).</li>
            <li>A brief reason for the refund request.</li>
          </ul>
          <p>
            We will acknowledge your request within <strong>2 business days</strong>.
          </p>
        </Section>

        <Section title="4. Refund Processing Time">
          <p>
            Approved refunds are processed within <strong>5–7 business days</strong>. The refund is
            issued to the original payment method used at the time of purchase:
          </p>
          <ul>
            <li><strong>Credit / Debit card:</strong> 5–7 business days to reflect on your statement.</li>
            <li><strong>UPI:</strong> Usually within 1–3 business days.</li>
            <li><strong>Net banking:</strong> 5–7 business days.</li>
            <li><strong>Wallets:</strong> 1–3 business days to the originating wallet.</li>
          </ul>
          <p>
            Processing timelines are subject to your bank or payment provider. TradeSaath is not responsible
            for delays caused by banks or payment networks after we initiate the refund.
          </p>
        </Section>

        <Section title="5. Non-Refundable Situations">
          <p>Refunds will not be issued in the following circumstances:</p>
          <ul>
            <li>You changed your mind after the applicable refund window has closed.</li>
            <li>Your account was suspended or terminated due to a violation of our Terms of Service.</li>
            <li>You purchased a Single Report and the report was successfully delivered.</li>
            <li>Partial months or unused days of a Pro Monthly subscription.</li>
            <li>Pro Yearly purchases where the 7-day window has passed.</li>
          </ul>
        </Section>

        <Section title="6. Subscription Cancellation Steps">
          <ol style={{ paddingLeft: '20px', lineHeight: 2 }}>
            <li>Sign in to your TradeSaath account.</li>
            <li>Go to your <strong>Account / Billing</strong> settings.</li>
            <li>Click <strong>&ldquo;Cancel Subscription&rdquo;</strong> and confirm.</li>
            <li>You will receive a cancellation confirmation email.</li>
          </ol>
          <p>
            If you have trouble cancelling, email us at{' '}
            <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--accent)' }}>
              sandeep.trader1407@gmail.com
            </a>{' '}
            and we will handle it promptly.
          </p>
        </Section>

        <Section title="7. Contact Us">
          <p>For refund or cancellation queries:</p>
          <address style={{ fontStyle: 'normal', lineHeight: 1.8, color: 'var(--text2)' }}>
            <strong style={{ color: 'var(--text)' }}>TradeSaath</strong><br />
            India<br />
            Email:{' '}
            <a href="mailto:sandeep.trader1407@gmail.com" style={{ color: 'var(--accent)' }}>
              sandeep.trader1407@gmail.com
            </a><br />
            Response time: within 2 business days
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

interface PlanItem {
  label: string
  value: string
  highlight?: boolean
}

function PlanCard({
  badge,
  name,
  badgeColor,
  items,
}: {
  badge: string
  name: string
  badgeColor: string
  items: PlanItem[]
}) {
  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px 24px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{name}</h3>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: badgeColor,
            background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${badgeColor} 30%, transparent)`,
            padding: '2px 10px',
            borderRadius: '999px',
          }}
        >
          {badge}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td
                style={{
                  padding: '8px 0',
                  paddingRight: '16px',
                  verticalAlign: 'top',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--muted2)',
                  whiteSpace: 'nowrap',
                  width: '140px',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {item.label}
              </td>
              <td
                style={{
                  padding: '8px 0',
                  verticalAlign: 'top',
                  fontSize: '14px',
                  color: item.highlight ? '#f05d6c' : 'var(--text2)',
                  lineHeight: 1.6,
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {item.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
