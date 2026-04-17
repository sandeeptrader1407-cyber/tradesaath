/**
 * TradeSaath — Welcome email template
 * Sent once when a new user signs up via Clerk webhook.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tradesaath.com'

export function welcomeEmailHtml(firstName?: string): string {
  const name = firstName || 'Trader'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f1729;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(62,232,196,0.15);">
  <span style="font-size:28px;font-weight:800;color:#3ee8c4;letter-spacing:-0.5px;">TradeSaath</span>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px;">
  <h1 style="margin:0 0 16px;font-size:24px;color:#ffffff;">Welcome, ${name}!</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a0aec0;">
    TradeSaath is your AI-powered trading psychology coach. We analyse every trade you make,
    score your decision quality across 7 factors, and help you break the emotional patterns
    that destroy trading accounts.
  </p>
  <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#a0aec0;">
    No more guessing why you lost money. Upload a broker statement and get your first
    Decision Quality Score in under 60 seconds.
  </p>

  <!-- CTA -->
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 32px;background:#3ee8c4;color:#0f1729;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
      Upload Your First Trades &rarr;
    </a>
  </td></tr>
  </table>

  <!-- Steps -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;">
    <tr>
      <td style="padding:16px;background:rgba(62,232,196,0.06);border-radius:8px;border-left:3px solid #3ee8c4;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#3ee8c4;">Step 1</p>
        <p style="margin:0;font-size:14px;color:#a0aec0;">Upload your broker statement (CSV, Excel, or PDF)</p>
      </td>
    </tr>
    <tr><td style="height:8px;"></td></tr>
    <tr>
      <td style="padding:16px;background:rgba(62,232,196,0.06);border-radius:8px;border-left:3px solid #3ee8c4;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#3ee8c4;">Step 2</p>
        <p style="margin:0;font-size:14px;color:#a0aec0;">Get your Decision Quality Score across 7 psychology factors</p>
      </td>
    </tr>
    <tr><td style="height:8px;"></td></tr>
    <tr>
      <td style="padding:16px;background:rgba(62,232,196,0.06);border-radius:8px;border-left:3px solid #3ee8c4;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#3ee8c4;">Step 3</p>
        <p style="margin:0;font-size:14px;color:#a0aec0;">Meet Saathi, your AI coach &mdash; brutally honest, always in your corner</p>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
  <p style="margin:0;font-size:12px;color:#4a5568;">
    You received this because you signed up for TradeSaath.<br>
    <a href="${BASE_URL}/unsubscribe" style="color:#3ee8c4;text-decoration:underline;">Unsubscribe</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export function welcomeEmailText(firstName?: string): string {
  const name = firstName || 'Trader'
  return `Welcome to TradeSaath, ${name}!

TradeSaath is your AI-powered trading psychology coach. We analyse every trade you make, score your decision quality across 7 factors, and help you break the emotional patterns that destroy trading accounts.

Get started in 3 steps:
1. Upload your broker statement (CSV, Excel, or PDF)
2. Get your Decision Quality Score across 7 psychology factors
3. Meet Saathi, your AI coach

Upload your first trades: ${BASE_URL}/dashboard

---
You received this because you signed up for TradeSaath.
Unsubscribe: ${BASE_URL}/unsubscribe`
}
