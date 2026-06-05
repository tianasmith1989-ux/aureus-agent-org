# Aureus Growth & Marketing Org

A production Next.js port of the Aureus command-center prototype: a multi-agent
"org" for **Aureus Plutus** (aureusplutus.app). Two AI managers — **Atlas**
(Growth) and **Mercury** (Marketing) — each run a team of specialists. You brief
a manager; it plans, dispatches specialists in parallel, and reports back.

The key difference from the prototype: **the agents run server-side.** Your
Anthropic API key never reaches the browser. Memory, the company profile, and the
content calendar are persisted in your Supabase Postgres database.

## Build status

This is **Step 1** of the kickoff plan:

- [x] **Step 1** — Scaffold, Supabase schema, secure `/api/run` agent route, ported UI
- [ ] Step 2 — Clerk auth (gate the app + all API routes)
- [ ] Step 3 — Stripe billing ($1 / 7-day trial → $14.99/mo, $99/yr)
- [ ] Step 4 — Resend + the 7 trial emails
- [ ] Step 5 — Ayrshare social posting + Vercel Cron

## Architecture

```
Browser (app/page.tsx)  ──▶  /api/run  ──▶  Anthropic API   (key held server-side)
   the UI                     orchestrator  ──▶  Supabase    (profile / memory / calendar)
```

- `app/page.tsx` — the ported command-center UI (client). Talks only to your own API routes.
- `app/api/run/route.ts` — the agent brain: per manager, plan → specialists → synthesize → persist.
- `app/api/company`, `/api/memory`, `/api/calendar`, `/api/calendar/generate` — read/write the DB.
- `lib/agents.ts` — **server-only** personas + system prompts (grounded in the company profile).
- `lib/roster.ts` — client-safe agent metadata + the default company profile (no secrets, no personas).
- `lib/anthropic.ts` — server-only Anthropic client (model: `claude-sonnet-4-6`).
- `lib/supabase.ts` — server-only Supabase client (service-role key).
- `supabase/schema.sql` — the database schema.

The compliance rules from the company profile (general education only; never name
specific financial products; never guarantee returns/outcomes) are injected into
**every** agent system prompt, server-side, and reinforced as a non-negotiable line.

## Run it locally

### 1. Install

```bash
npm install
```

### 2. Add your keys

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local`:

- **`ANTHROPIC_API_KEY`** — create at [console.anthropic.com](https://console.anthropic.com)
  (set a monthly spend limit while you're there). **Required** for the agents to run.
- **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** — from your Aureus Supabase
  project (Project Settings → API). Used server-side to persist profile / memory / calendar.

> You can try the agents with just `ANTHROPIC_API_KEY` set — the app falls back to
> the built-in default profile and skips persistence when Supabase isn't configured.
> Add the Supabase keys to enable saving.

### 3. Create the database tables

In the Supabase SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql).

### 4. Start

```bash
npm run dev
```

Open http://localhost:3000.

## Notes

- The prototype's live per-agent streaming is consolidated into a single secure
  `/api/run` request: status dots go active while the division works, then the full
  plan / specialist outputs / manager report render together.
- Tailwind is intentionally omitted — the UI is fully inline-styled, ported verbatim
  from the prototype, so there are no Tailwind classes to support.
- Never commit `.env.local`. Secrets live there (and in Vercel's env settings at deploy time).
