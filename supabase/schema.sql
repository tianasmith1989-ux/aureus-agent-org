-- Aureus Agent Org — database schema (Step 1)
-- Run this in the Supabase SQL editor for your Aureus project.
-- Mirrors the prototype's three persisted objects (profile, memory, calendar)
-- and adds real CRM tables used in later steps.

-- One row per company; holds the editable profile the agents read.
create table if not exists company (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Aureus Plutus',
  profile text not null,            -- the grounding text from the prototype
  updated_at timestamptz default now()
);

-- Memory log of every brief the org ran (the "Memory / CRM" panel).
create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  directive text not null,
  divisions text,                   -- 'Growth', 'Marketing', 'Growth + Marketing'
  gist text,
  report jsonb,                     -- full structured output per manager
  created_at timestamptz default now()
);

-- Real CRM: accounts & contacts the agents act on (wired up in later steps).
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,
  website text,
  notes text,
  stage text default 'prospect',    -- prospect | qualified | demo | proposal | won | lost
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  name text,
  title text,
  email text,
  linkedin text
);

-- Lyra's content calendar.
create table if not exists calendar_posts (
  id uuid primary key default gen_random_uuid(),
  day int,
  platform text,                    -- LinkedIn | X | Instagram
  hook text,
  post text,
  hashtags text,
  status text default 'draft',      -- draft | scheduled | posted | failed
  scheduled_at timestamptz,
  posted_at timestamptz,
  external_id text,                 -- id returned by the posting API (Step 5)
  created_at timestamptz default now()
);

-- Stripe billing state, one row per Clerk user (Step 3).
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  email text,                       -- billing email (used by the trial-email cron)
  plan text,                        -- trial | monthly | annual
  status text default 'none',       -- none | active | trialing | past_due | canceled | incomplete
  trial_started_at timestamptz,     -- set when the $1 trial checkout completes
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

-- Idempotency log for the 7 trial emails (Step 4) — one row per (subscription, day).
create table if not exists trial_emails (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null,
  day int not null,                 -- 0,1,2,3,5,6,7
  email text,
  sent_at timestamptz default now(),
  unique (stripe_subscription_id, day)
);

-- No profile seed here on purpose.
-- The app auto-seeds the FULL grounding profile (COMPANY_DEFAULT from lib/roster.ts)
-- on first load via GET /api/company when the company table is empty. Seeding a
-- placeholder row here would block that, leaving you with a stub profile — so
-- leave `company` empty and let the app populate it (or edit it in the UI).
