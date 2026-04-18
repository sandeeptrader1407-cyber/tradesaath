/**
 * TEMPORARY test endpoint — DELETE after debugging.
 * GET /api/test-email → sends a test welcome email to verify Resend works.
 */
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { welcomeEmailHtml, welcomeEmailText } from '@/emails/welcome'

export async function GET() {
  const to = 'sandeep.trader1407@gmail.com'

  console.log('[TEST_EMAIL] Starting test email send...')
  console.log('[TEST_EMAIL] RESEND_API_KEY set:', !!process.env.RESEND_API_KEY)

  try {
    const result = await sendEmail({
      to,
      subject: 'TradeSaath Test Email — Ignore',
      html: welcomeEmailHtml('Sandeep'),
      text: welcomeEmailText('Sandeep'),
    })

    console.log('[TEST_EMAIL] Result:', result)
    return NextResponse.json({
      success: result,
      to,
      resendKeySet: !!process.env.RESEND_API_KEY,
      message: result ? 'Email sent — check your inbox' : 'Email failed — check Vercel logs for [EMAIL] errors',
    })
  } catch (err) {
    console.error('[TEST_EMAIL] Error:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
