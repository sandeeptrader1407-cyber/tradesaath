// User data-accuracy audit — dumps everything needed to audit-output.json
// Run from repo root:
//   node scripts/user-audit.mjs <email-or-clerk_id>
// Examples:
//   node scripts/user-audit.mjs sandeep.trader1407@gmail.com
//   node scripts/user-audit.mjs user_3BDccKsUDZy98p92nq7cH7lZvSk
// Reads credentials from .env.local, no install required (uses native fetch).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!r.ok) {
    console.error(`FAIL ${path} → ${r.status} ${r.statusText}`)
    return { error: await r.text() }
  }
  return await r.json()
}

const output = {}

// Require an email or clerk_id — no more hard-coded defaults.
const ARG = process.argv[2]
if (!ARG) {
  console.error('Usage: node scripts/user-audit.mjs <email-or-clerk_id>')
  process.exit(1)
}
let CLERK_ID = ARG

if (!ARG.startsWith('user_')) {
  console.log(`Treating arg "${ARG}" as email, resolving clerk_id...`)
  const matches = await sb(`users?email=eq.${encodeURIComponent(ARG)}&select=clerk_id,email,name,created_at`)
  if (!Array.isArray(matches) || matches.length === 0) {
    console.error(`No user found for email ${ARG}. Dumping recent signups:`)
    const recent = await sb(`users?select=clerk_id,email,name,created_at&order=created_at.desc&limit=15`)
    console.error(JSON.stringify(recent, null, 2))
    process.exit(1)
  }
  CLERK_ID = matches[0].clerk_id
  console.log(`  Resolved to clerk_id ${CLERK_ID} (${matches[0].email})`)
}

console.log(`1. Looking up user by clerk_id ${CLERK_ID}...`)
output.users = await sb(`users?clerk_id=eq.${encodeURIComponent(CLERK_ID)}&select=*`)

if (!Array.isArray(output.users) || output.users.length === 0) {
  console.log('Clerk_id not found in users table — dumping recent signups so you can spot the right one.')
  output.recent_signups = await sb(`users?select=clerk_id,email,name,created_at,plan&order=created_at.desc&limit=15`)
  writeFileSync(resolve(__dirname, '..', 'audit-output.json'), JSON.stringify(output, null, 2))
  process.exit(0)
}

const clerk = CLERK_ID
console.log(`  Found: ${output.users[0].email} (${output.users[0].name || 'no name'}) → ${clerk}`)

const userUuid = output.users[0].id

console.log('2. Raw files (by clerk_id)...')
output.raw_files = await sb(
  `raw_files?user_id=eq.${encodeURIComponent(clerk)}&select=id,file_name,file_type,file_size_bytes,broker_id,broker_name,market,currency,total_rows,data_rows,skipped_rows,parser_version,has_time_column,date_range_start,date_range_end,file_hash,parsed_at,uploaded_at,warnings,headers,column_mapping,raw_data&order=uploaded_at.desc`
)

console.log('2b. Raw files count across table (sanity)...')
output.raw_files_total = await sb(`raw_files?select=id&limit=1`)

console.log('3. Trade sessions (by clerk_id)...')
output.trade_sessions = await sb(
  `trade_sessions?user_id=eq.${encodeURIComponent(clerk)}&select=id,trade_date,trade_count,net_pnl,win_count,loss_count,win_rate,profit_factor,best_trade,worst_trade,raw_file_id,session_key,broker,broker_name,file_name,raw_row_count,parsed_count,detected_market,detected_currency,detected_broker,context,analysis,trades,created_at,updated_at&order=trade_date.desc`
)

console.log('4. Payments (by user_id UUID)...')
output.payments = await sb(
  `payments?user_id=eq.${encodeURIComponent(userUuid)}&select=*&order=created_at.desc`
)

console.log('5. User plan (by user_id clerk)...')
output.user_plans = await sb(
  `user_plans?user_id=eq.${encodeURIComponent(clerk)}&select=*`
)

// ----- derived integrity checks so my next pass is fast -----
const integrity = {
  files_count: Array.isArray(output.raw_files) ? output.raw_files.length : null,
  sessions_count: Array.isArray(output.trade_sessions) ? output.trade_sessions.length : null,
  files: [],
  sessions: [],
  duplicates: [],
}

if (Array.isArray(output.raw_files)) {
  for (const f of output.raw_files) {
    const rawLen = Array.isArray(f.raw_data) ? f.raw_data.length : 0
    integrity.files.push({
      id: f.id,
      file_name: f.file_name,
      data_rows: f.data_rows,
      raw_data_len: rawLen,
      parse_integrity_ok: f.data_rows === rawLen,
      parser_version: f.parser_version,
      parsed_at: f.parsed_at,
      uploaded_at: f.uploaded_at,
    })
  }
}

if (Array.isArray(output.trade_sessions)) {
  for (const s of output.trade_sessions) {
    const trades = Array.isArray(s.trades) ? s.trades : []
    const jsonb_count = trades.length
    let jsonb_pnl = 0, jsonb_wins = 0, jsonb_losses = 0
    const seen = new Map()
    for (const t of trades) {
      const pnl = Number(t.pnl ?? 0)
      jsonb_pnl += pnl
      if (pnl > 0) jsonb_wins += 1
      else if (pnl < 0) jsonb_losses += 1
      const key = [
        t.symbol, t.side,
        t.qty ?? t.quantity,
        t.entry_price ?? t.entryPrice,
        t.exit_price ?? t.exitPrice,
        t.entry_time ?? t.entryTime,
        t.pnl,
      ].join('|')
      seen.set(key, (seen.get(key) || 0) + 1)
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1)
    if (dupes.length) {
      integrity.duplicates.push({ session_id: s.id, trade_date: s.trade_date, dup_count: dupes.length, sample: dupes.slice(0, 3) })
    }

    const firstDate = trades[0]?.date || null
    const lastDate = trades[trades.length - 1]?.date || null

    integrity.sessions.push({
      id: s.id,
      trade_date: s.trade_date,
      stored: {
        trade_count: s.trade_count,
        net_pnl: s.net_pnl,
        win_count: s.win_count,
        loss_count: s.loss_count,
      },
      from_jsonb: {
        trade_count: jsonb_count,
        net_pnl: Number(jsonb_pnl.toFixed(2)),
        win_count: jsonb_wins,
        loss_count: jsonb_losses,
      },
      count_ok: s.trade_count === jsonb_count,
      pnl_ok: Math.abs(Number(s.net_pnl || 0) - jsonb_pnl) < 0.01,
      wins_ok: s.win_count === jsonb_wins,
      losses_ok: s.loss_count === jsonb_losses,
      was_rewritten: new Date(s.updated_at) - new Date(s.created_at) > 5000,
      first_trade_date: firstDate,
      last_trade_date: lastDate,
      date_ok: firstDate ? firstDate.slice(0, 10) === String(s.trade_date).slice(0, 10) : null,
      raw_file_id: s.raw_file_id,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })
  }
}

output.integrity = integrity

const outPath = resolve(__dirname, '..', 'audit-output.json')
writeFileSync(outPath, JSON.stringify(output, null, 2))
console.log(`\nDone. Wrote ${outPath}`)
console.log(`  files: ${integrity.files_count}  sessions: ${integrity.sessions_count}  duplicates: ${integrity.duplicates.length}`)
