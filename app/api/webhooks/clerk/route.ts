import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { welcomeEmailHtml, welcomeEmailText } from '@/emails/welcome'

// ─── Supabase admin client (bypasses RLS via service role key) ───────────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

// ─── Clerk webhook event types we care about ─────────────────────────────────
interface ClerkEmailAddress {
  email_address: string
  id: string
}

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses: ClerkEmailAddress[]
    first_name: string | null
    last_name: string | null
  }
}

type ClerkWebhookEvent = ClerkUserCreatedEvent | { type: string; data: unknown }

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Verify the Svix signature so only Clerk can trigger this endpoint
  const headerPayload = headers()
  const svixId        = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()

  let event: ClerkWebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only handle user.created — ignore all other event types
  if (event.type !== 'user.created') {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 })
  }

  // After the guard above we know this is a user.created event
  const { id: clerkId, email_addresses, first_name, last_name } =
    (event as ClerkUserCreatedEvent).data

  const primaryEmail = email_addresses?.[0]?.email_address ?? ''
  const name = [first_name, last_name].filter(Boolean).join(' ') || null

  const supabase = getSupabaseAdmin()

  // First try INSERT; on duplicate (Clerk retry or payment-verify race), just update name/email
  const { error } = await supabase.from('users').insert({
    clerk_id: clerkId,
    email: primaryEmail,
    name,
    plan: 'free',
  })

  if (error && error.code === '23505') {
    // Duplicate key — user already exists (Clerk retry or payment-verify created them first)
    // Update name/email but DON'T overwrite their plan
    const { error: updateErr } = await supabase
      .from('users')
      .update({ email: primaryEmail, name })
      .eq('clerk_id', clerkId)

    if (updateErr) {
      console.error('Supabase update on duplicate error:', updateErr.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    console.log(`Updated existing Supabase user for Clerk ID: ${clerkId} (duplicate handled)`)
    return NextResponse.json({ message: 'User updated' }, { status: 200 })
  }

  if (error) {
    console.error('Supabase insert error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  console.log(`Upserted Supabase user for Clerk ID: ${clerkId}`)

  // Fire-and-forget welcome email (only on fresh creation, not duplicate update)
  if (primaryEmail) {
    const displayName = first_name || primaryEmail.split('@')[0]
    sendEmail({
      to: primaryEmail,
      subject: `Welcome to TradeSaath, ${displayName}!`,
      html: welcomeEmailHtml(displayName),
      text: welcomeEmailText(displayName),
    }).catch(err => console.error('[WELCOME_EMAIL_FAILED]', err))
  }

  return NextResponse.json({ message: 'User created' }, { status: 201 })
}
