-- Aureus Agent Org — database schema
-- Run this in the Supabase SQL editor for the dedicated Agent-Org project
-- (separate from the Aureus Plutus consumer app's database).
-- Covers all of Steps 1–5: profile, brief memory, CRM, content calendar,
-- Stripe subscriptions, and the trial-email idempotency log.

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

-- Founder Cockpit — Venue Map (2a): ranked places to post, across all platforms.
create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  platform text,                    -- Reddit | Facebook | Instagram | LinkedIn | TikTok | Discord | YouTube | Creator
  name text,
  link text,
  size text,                        -- rough size / activity
  fit text,                         -- why it fits the audience
  rules text,                       -- posting rules / self-promo policy
  angle text,                       -- the value-first angle to lead with
  rank int default 0,               -- lower = higher priority
  status text default 'active',     -- active | archived
  created_at timestamptz default now()
);

-- Founder Cockpit — "Today's Moves" drafts (drafting only; a human posts).
create table if not exists moves (
  id uuid primary key default gen_random_uuid(),
  directive text,                   -- the brief that generated this draft
  community text,                   -- target community / channel
  angle text,                       -- the angle for the post
  text text,                        -- the ready-to-post draft (founder voice)
  status text default 'draft',      -- draft | posted
  source text default 'founder',    -- founder | adapt | monitor
  source_url text,                  -- for monitor: the thread/video being replied to
  posted_at timestamptz,
  created_at timestamptz default now()
);
-- If `moves` already exists from Phase 1, add the new columns:
alter table moves add column if not exists source text default 'founder';
alter table moves add column if not exists source_url text;

-- Founder Cockpit — monitoring keywords (2c): Reddit + YouTube only.
create table if not exists monitor_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  active boolean default true,
  created_at timestamptz default now()
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
