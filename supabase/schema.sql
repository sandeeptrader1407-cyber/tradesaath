-- ============================================================
--  TradeSaath – Supabase Database Schema
--  Paste this entire script into the Supabase SQL Editor
--  and click "Run".
-- ============================================================

-- ------------------------------------------------------------
-- 0. Extensions
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";   -- provides gen_random_uuid()


-- ============================================================
-- 1. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 1a. users
-- ------------------------------------------------------------
create table if not exists public.users (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  name        text,
  plan        text        not null default 'free',
  clerk_id    text        not null unique,
  created_at  timestamptz not null default now()
);

comment on table  public.users             is 'One row per registered TradeSaath user, synced from Clerk webhooks.';
comment on column public.users.plan        is 'Subscription tier: free | pro | elite';
comment on column public.users.clerk_id    is 'Immutable Clerk user_id (e.g. user_2abc…).';


-- ------------------------------------------------------------
-- 1b. sessions
-- ------------------------------------------------------------
create table if not exists public.sessions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.users (id) on delete cascade,
  date             date,
  broker           text,
  market           text,
  raw_trades_json  jsonb,
  analysis_json    jsonb,
  plan_used        text,
  created_at       timestamptz not null default now()
);

comment on table  public.sessions                  is 'Each uploaded trade-file analysis is stored as one session.';
comment on column public.sessions.raw_trades_json  is 'Parsed trade rows exactly as received from the broker CSV/PDF.';
comment on column public.sessions.analysis_json    is 'Claude AI psychology report stored as structured JSON.';
comment on column public.sessions.plan_used        is 'Subscription plan that was active when the session was created.';


-- ------------------------------------------------------------
-- 1c. payments
-- ------------------------------------------------------------
create table if not exists public.payments (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  amount      integer     not null,          -- in smallest currency unit (paise / cents)
  currency    text        not null default 'INR',
  plan        text        not null,
  provider    text        not null,          -- 'razorpay' | 'stripe'
  status      text        not null default 'pending',  -- pending | captured | failed | refunded
  payment_id  text,                          -- provider-side payment / order ID
  created_at  timestamptz not null default now()
);

comment on table  public.payments            is 'Immutable ledger of every payment attempt.';
comment on column public.payments.amount     is 'Amount in smallest unit: paise for INR, cents for USD.';
comment on column public.payments.payment_id is 'Razorpay payment_id or Stripe PaymentIntent id.';


-- ------------------------------------------------------------
-- 1d. journal_notes
-- ------------------------------------------------------------
create table if not exists public.journal_notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  session_id  uuid        references public.sessions (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

comment on table  public.journal_notes            is 'Free-form trading journal entries, optionally linked to a session.';
comment on column public.journal_notes.session_id is 'Optional link to the session this note relates to.';


-- ============================================================
-- 2. INDEXES  (improves query speed on common lookups)
-- ============================================================
create index if not exists idx_sessions_user_id      on public.sessions      (user_id);
create index if not exists idx_payments_user_id      on public.payments      (user_id);
create index if not exists idx_journal_notes_user_id on public.journal_notes (user_id);
create index if not exists idx_journal_notes_session on public.journal_notes (session_id);
create index if not exists idx_users_clerk_id        on public.users         (clerk_id);


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
-- The helper function below converts the Clerk JWT sub claim
-- (stored as app_metadata or a custom JWT claim) into the
-- matching users.id so every policy stays a simple equality.
--
-- HOW IT WORKS:
--   • Clerk issues a JWT; you add a Supabase custom claim that
--     stores the users.id in the JWT under "supabase_user_id".
--   • The helper reads that claim and casts it to uuid.
--   • All policies call auth_user_id() instead of auth.uid()
--     because Clerk users are not Supabase Auth users.
-- ============================================================

create or replace function public.auth_user_id()
returns uuid
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'supabase_user_id',
    ''
  )::uuid;
$$;

comment on function public.auth_user_id is
  'Returns the TradeSaath users.id embedded in the Clerk JWT custom claim "supabase_user_id".';


-- Enable RLS on every table
alter table public.users         enable row level security;
alter table public.sessions      enable row level security;
alter table public.payments      enable row level security;
alter table public.journal_notes enable row level security;


-- ------------------------------------------------------------
-- 3a. users policies
-- ------------------------------------------------------------
-- SELECT: a user may read only their own row
create policy "users: select own row"
  on public.users
  for select
  using ( id = public.auth_user_id() );

-- INSERT: a user may create only their own row
create policy "users: insert own row"
  on public.users
  for insert
  with check ( id = public.auth_user_id() );

-- UPDATE: a user may update only their own row
create policy "users: update own row"
  on public.users
  for update
  using     ( id = public.auth_user_id() )
  with check( id = public.auth_user_id() );

-- DELETE: intentionally not granted to end-users
--   (handle account deletion via a server-side function)


-- ------------------------------------------------------------
-- 3b. sessions policies
-- ------------------------------------------------------------
create policy "sessions: select own"
  on public.sessions
  for select
  using ( user_id = public.auth_user_id() );

create policy "sessions: insert own"
  on public.sessions
  for insert
  with check ( user_id = public.auth_user_id() );

create policy "sessions: update own"
  on public.sessions
  for update
  using     ( user_id = public.auth_user_id() )
  with check( user_id = public.auth_user_id() );

create policy "sessions: delete own"
  on public.sessions
  for delete
  using ( user_id = public.auth_user_id() );


-- ------------------------------------------------------------
-- 3c. payments policies
-- ------------------------------------------------------------
-- Users can VIEW their own payments but never INSERT / UPDATE
-- directly from the client — that happens server-side via the
-- Razorpay / Stripe webhook handler.
create policy "payments: select own"
  on public.payments
  for select
  using ( user_id = public.auth_user_id() );

-- Server-side API routes run with the service role key and
-- bypass RLS entirely, so no insert/update policy is needed
-- for payments on the client side.


-- ------------------------------------------------------------
-- 3d. journal_notes policies
-- ------------------------------------------------------------
create policy "journal_notes: select own"
  on public.journal_notes
  for select
  using ( user_id = public.auth_user_id() );

create policy "journal_notes: insert own"
  on public.journal_notes
  for insert
  with check ( user_id = public.auth_user_id() );

create policy "journal_notes: update own"
  on public.journal_notes
  for update
  using     ( user_id = public.auth_user_id() )
  with check( user_id = public.auth_user_id() );

create policy "journal_notes: delete own"
  on public.journal_notes
  for delete
  using ( user_id = public.auth_user_id() );


-- ============================================================
-- 4. REALTIME  (optional – uncomment to enable live updates)
-- ============================================================
-- alter publication supabase_realtime add table public.sessions;
-- alter publication supabase_realtime add table public.journal_notes;


-- ============================================================
-- Done. All tables, indexes, and RLS policies are in place.
-- ============================================================
