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

-- No profile seed here on purpose.
-- The app auto-seeds the FULL grounding profile (COMPANY_DEFAULT from lib/roster.ts)
-- on first load via GET /api/company when the company table is empty. Seeding a
-- placeholder row here would block that, leaving you with a stub profile — so
-- leave `company` empty and let the app populate it (or edit it in the UI).
