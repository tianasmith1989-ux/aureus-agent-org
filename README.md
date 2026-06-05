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
- [x] **Step 2** — Clerk auth (gates the app + every API route)
- [x] **Step 3** — Stripe billing ($1 / 7-day trial → $14.99/mo, $99/yr)
- [x] **Step 4** — Resend + the 7 trial emails
- [x] **Step 5** — Ayrshare social posting + Vercel Cron

> Steps 3–5 are built and type-check/compile clean. They call live external services
> (Stripe, Resend, Ayrshare), so end-to-end verification happens at deploy once the keys
> and dashboard objects below exist.

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
- **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** and **`CLERK_SECRET_KEY`** — from the Clerk
  dashboard → API Keys. **Required** now that auth is on: the app + every API route are
  gated behind a Clerk session. Also set `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and
  `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` so Clerk uses the in-app auth pages.

> Since Step 2, **Clerk keys are required for the app to load.** The Supabase keys remain
> optional for a quick agent test (the app falls back to the default profile and skips
> persistence), but auth is mandatory.

### Lock it down to just you

This is a single-operator tool. In the **Clerk dashboard**, restrict who can get in —
e.g. set sign-ups to **invitation-only / restricted**, or remove the public sign-up and
add only your own user. Unauthenticated visitors are redirected to `/sign-in`; signed-in
users see the org and can sign out via the avatar button in the header.

### 3. Create the database tables

In the Supabase SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql).

### 4. Start

```bash
npm run dev
```

Open http://localhost:3000.

## Dashboard setup (Steps 3–5)

### Stripe (Step 3) — create these exact products & prices

In the Stripe dashboard (use **Test mode** first), create **one product per plan**, each with
a recurring price, then copy the **price IDs** (`price_…`) into env:

| Product (name) | Price | Billing period | Env var |
|---|---|---|---|
| **Aureus — 7-day Trial** | **$1.00** | **Weekly** (recurring, every 1 week) | `STRIPE_PRICE_TRIAL` |
| **Aureus — Monthly** | **$14.99** | **Monthly** (recurring) | `STRIPE_PRICE_MONTHLY` |
| **Aureus — Annual** | **$99.00** | **Yearly** (recurring) | `STRIPE_PRICE_ANNUAL` |

How the trial works in code: checkout starts the subscription on the **weekly $1** price, and
the webhook immediately converts it to a **2-phase subscription schedule** — phase 1 = $1 for
one week, phase 2 = $14.99/month ongoing. So the customer pays **$1 for 7 days, then $14.99/mo**.
The Annual plan is a direct $99/year subscription.

Also in Stripe:
- **API keys** → `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Webhook** → add an endpoint pointing at `https://<your-domain>/api/stripe/webhook`,
  subscribe to `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret
  into `STRIPE_WEBHOOK_SECRET`. (Locally, use `stripe listen --forward-to localhost:3000/api/stripe/webhook`.)
- **Billing Portal** → enable it (Settings → Billing → Customer portal) so "Manage subscription" works.

The `/billing` page lets you start the trial or annual plan and manage/cancel.

### Resend (Step 4) — the 7 trial emails

- Verify your **sending domain** in Resend (add the DNS records), then set
  `RESEND_API_KEY` and `RESEND_FROM` (e.g. `"Aureus Plutus <noreply@aureusplutus.app>"`).
- Set `NEXT_PUBLIC_APP_URL` to your deployed URL (used in email CTA links).
- The sequence (days 0,1,2,3,5,6,7) is sent by the daily cron `/api/cron/trial-emails`,
  anchored to each subscriber's trial start. Sends are idempotent (one row per
  subscription+day in `trial_emails`). Copy lives in `lib/emails.ts` — **give it a
  compliance read before going live** (education only, no product names, no guarantees).

### Ayrshare + Vercel Cron (Step 5) — social posting

- Sign up for Ayrshare, connect your LinkedIn / X / Instagram accounts, set `AYRSHARE_API_KEY`.
- In the content calendar, each post has a **Schedule** control → sets `scheduled_at`.
- The cron `/api/cron/publish` (every 15 min) publishes due posts via Ayrshare and records
  the result. Both crons are defined in [`vercel.json`](vercel.json) and protected by `CRON_SECRET`.
- **Verify current Ayrshare pricing/limits and each platform's posting rules before relying on it.**

## Deploy to Vercel

1. Push to GitHub (already on the working branch).
2. In Vercel: **Import** the repo.
3. **Project → Settings → Environment Variables**: add every variable from `.env.local`
   (Anthropic, Supabase, Clerk, Stripe incl. price IDs + webhook secret, Resend, `RESEND_FROM`,
   `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, Ayrshare). Set `NEXT_PUBLIC_APP_URL` to the Vercel URL.
4. Deploy. **Cron jobs in `vercel.json` activate automatically** on the deployed app.
5. Point the Stripe webhook at the deployed `/api/stripe/webhook` URL.

## Notes

- The prototype's live per-agent streaming is consolidated into a single secure
  `/api/run` request: status dots go active while the division works, then the full
  plan / specialist outputs / manager report render together.
- Tailwind is intentionally omitted — the UI is fully inline-styled, ported verbatim
  from the prototype, so there are no Tailwind classes to support.
- Never commit `.env.local`. Secrets live there (and in Vercel's env settings at deploy time).
- Human gates: trial emails are transactional (auto-sent), but **cold/partnership outreach
  and anything that posts publicly stays human-approved** — keep Aria/Quill/Echo output
  reviewed before it goes live, per the compliance rules.
