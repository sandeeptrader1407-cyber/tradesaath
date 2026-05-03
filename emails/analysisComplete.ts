/**
 * TradeSaath — Analysis Complete email template
 * Sent after a fresh upload is analysed (not batch re-analysis).
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tradesaath.com'

export interface AnalysisEmailData {
  name?: string
  sessionDate: string
  tradeCount: number
  netPnl: number
  dqsScore: number
  topIssue?: string
  topIssueCost?: number
  currency?: string
}

function fmtPnl(v: number, currency: string): string {
  const sign = v >= 0 ? '+' : ''
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : '\u20B9'
  return `${sign}${symbol}${Math.abs(Math.round(v)).toLocaleString('en-IN')}`
}

export function analysisCompleteHtml(data: AnalysisEmailData): string {
  const {
    // Destructured for shape-completeness; HTML body doesn't currently personalise greeting.
    name: _name = 'Trader',
    sessionDate,
    tradeCount,
    netPnl,
    dqsScore,
    topIssue,
    topIssueCost,
    currency = 'INR',
  } = data

  const pnlColor = netPnl >= 0 ? '#22c55e' : '#ef4444'
  const dqsColor = dqsScore >= 65 ? '#22c55e' : dqsScore >= 45 ? '#eab308' : '#ef4444'
  const pnlStr = fmtPnl(netPnl, currency)
  const costStr = topIssueCost ? fmtPnl(-Math.abs(topIssueCost), currency) : ''

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
  <h1 style="margin:0 0 8px;font-size:22px;color:#ffffff;">Your analysis is ready</h1>
  <p style="margin:0 0 28px;font-size:14px;color:#4a5568;">${sessionDate} &middot; ${tradeCount} trade${tradeCount === 1 ? '' : 's'}</p>

  <!-- Stat boxes -->
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="33%" style="padding:4px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:8px;">
      <tr><td style="padding:16px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;color:#4a5568;text-transform:uppercase;letter-spacing:0.5px;">Net P&amp;L</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:${pnlColor};">${pnlStr}</p>
      </td></tr>
      </table>
    </td>
    <td width="33%" style="padding:4px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:8px;">
      <tr><td style="padding:16px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;color:#4a5568;text-transform:uppercase;letter-spacing:0.5px;">DQS Score</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:${dqsColor};">${dqsScore}/100</p>
      </td></tr>
      </table>
    </td>
    <td width="33%" style="padding:4px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border-radius:8px;">
      <tr><td style="padding:16px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;color:#4a5568;text-transform:uppercase;letter-spacing:0.5px;">#1 Issue</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#f59e0b;">${topIssue || 'None'}</p>
      </td></tr>
      </table>
    </td>
  </tr>
  </table>

  ${topIssue && topIssueCost ? `
  <!-- Pattern callout -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
  <tr><td style="padding:16px;background:rgba(239,68,68,0.08);border-radius:8px;border-left:3px solid #ef4444;">
    <p style="margin:0;font-size:14px;line-height:1.5;color:#a0aec0;">
      <strong style="color:#ef4444;">${topIssue}</strong> cost you
      <strong style="color:#ef4444;">${costStr}</strong> this session.
      Review your analysis to see which trades were affected and how to fix it.
    </p>
  </td></tr>
  </table>` : ''}

  <!-- CTA -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
  <tr><td align="center">
    <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:14px 32px;background:#3ee8c4;color:#0f1729;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
      View Full Analysis &rarr;
    </a>
  </td></tr>
  </table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
  <p style="margin:0;font-size:12px;color:#4a5568;">
    You received this because you uploaded trades to TradeSaath.<br>
    <a href="${BASE_URL}/unsubscribe" style="color:#3ee8c4;text-decoration:underline;">Unsubscribe</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export function analysisCompleteText(data: AnalysisEmailData): string {
  const { name = 'Trader', sessionDate, tradeCount, netPnl, dqsScore, topIssue, topIssueCost, currency = 'INR' } = data
  const pnlStr = fmtPnl(netPnl, currency)
  const costStr = topIssueCost ? fmtPnl(-Math.abs(topIssueCost), currency) : ''

  return `Hey ${name}, your ${sessionDate} analysis is ready!

${tradeCount} trades | Net P&L: ${pnlStr} | DQS: ${dqsScore}/100
${topIssue ? `#1 Issue: ${topIssue}${costStr ? ` (cost: ${costStr})` : ''}` : ''}

View your full analysis: ${BASE_URL}/dashboard

---
You received this because you uploaded trades to TradeSaath.
Unsubscribe: ${BASE_URL}/unsubscribe`
}
