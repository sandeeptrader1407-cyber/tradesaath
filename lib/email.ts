/**
 * TradeSaath — Email utility (Resend)
 * Fire-and-forget pattern: never blocks the main flow, never throws.
 */

import { Resend } from 'resend'

const FROM = 'TradeSaath <hello@tradesaath.com>'

let resend: Resend | null = null
function getClient(): Resend | null {
  if (resend) return resend
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[EMAIL] RESEND_API_KEY not set — emails disabled')
    return null
  }
  resend = new Resend(key)
  return resend
}

export interface SendEmailOpts {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send an email via Resend. Fire-and-forget — logs errors, never throws.
 */
export async function sendEmail(opts: SendEmailOpts): Promise<boolean> {
  try {
    const client = getClient()
    if (!client) return false

    const { error } = await client.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })

    if (error) {
      console.error('[EMAIL] Resend error:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[EMAIL] Send failed:', err)
    return false
  }
}
