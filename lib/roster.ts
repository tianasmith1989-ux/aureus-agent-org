// Client-safe roster: metadata only (id, name, role, glyph, division).
// No personas and no secrets live here — safe to import into the browser bundle.
// The personas + system prompts live server-side in lib/agents.ts.

export interface AgentMeta {
  id: string;
  name: string;
  role: string;
  glyph: string;
  social?: boolean;
}

export interface ManagerMeta {
  id: string;
  name: string;
  role: string;
  glyph: string;
  division: string;
  agents: AgentMeta[];
}

export const SALES_AGENTS_META: AgentMeta[] = [
  { id: "scout", name: "Scout", role: "Partnerships · Prospecting", glyph: "◎" },
  { id: "echo", name: "Echo", role: "Lifecycle · Outreach", glyph: "✶" },
  { id: "sage", name: "Sage", role: "Conversion · Activation", glyph: "◇" },
  { id: "vault", name: "Vault", role: "Trust · Security", glyph: "⬡" },
  { id: "forge", name: "Forge", role: "Offers · Retention", glyph: "▲" },
  { id: "ledger", name: "Ledger", role: "Subscription Metrics", glyph: "▤" },
];

export const MKTG_AGENTS_META: AgentMeta[] = [
  { id: "lyra", name: "Lyra", role: "Social Media", glyph: "✦", social: true },
  { id: "quill", name: "Quill", role: "Content · SEO", glyph: "✎" },
  { id: "aria", name: "Aria", role: "Brand · Campaigns", glyph: "◬" },
  { id: "pulse", name: "Pulse", role: "Growth · Analytics", glyph: "∿" },
];

export const MANAGERS_META: Record<string, ManagerMeta> = {
  atlas: {
    id: "atlas",
    name: "Atlas",
    role: "Growth Director",
    glyph: "❖",
    division: "Growth",
    agents: SALES_AGENTS_META,
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    role: "Marketing Manager",
    glyph: "☿",
    division: "Marketing",
    agents: MKTG_AGENTS_META,
  },
};

export const ALL_AGENTS_META: AgentMeta[] = [...SALES_AGENTS_META, ...MKTG_AGENTS_META];

// The grounding profile — source of truth, injected server-side into every agent call.
// Editable in the UI (persisted to the `company` table).
export const COMPANY_DEFAULT = `Company: Aureus Plutus (aureusplutus.app) — ABN 32 306 872 259. Australian, with UK support.

What it is: An AI budgeting and wealth coach. Self-description: "Your AI budgeting assistant — I'll help you understand your money, pay your mortgage off years early, and eliminate debt." It doesn't just show numbers; an AI coach guides the user one step at a time.

Who it's for: Everyday Australians (and UK users) — individuals, couples, and families — who want to get out of debt, pay their mortgage off early, build savings, and reach financial independence (FIRE). A "Business mode" also serves side-hustlers and small business owners.

Business model: Consumer subscription (Stripe), self-serve B2C (not enterprise). Pricing: 7-day trial for $1, then $14.99/month, or $99/year (annual saves ~$81 vs monthly — roughly 45% cheaper). Auth via Clerk.

How it works — the method: A 7-step "Baby Steps" plan (Dave Ramsey style):
1) $2,000 starter emergency fund  2) Kill bad debt (credit cards, personal loans, Afterpay/Zip — not HECS/mortgage)  3) 3–6 months full emergency fund  4) Invest ~15%  5) Future goals  6) Accelerate the mortgage (pay off in 7–10 yrs, not 30)  7) Build wealth & give. Uses debt snowball/avalanche.

Key features: AI chat coach ("Ask Aureus"); income/expense budgeting with a payment calendar; debt tracker & payoff; net-worth tracking + history; Mortgage Accelerator (extra-repayment scenarios, offset, fortnightly); FIRE number calculator; Superannuation tracker (fee comparison); tax estimator; sinking funds & goals with reminders; passive-income "quests" (high-interest savings, cashback, dividend ETFs, side hustle); investment-property tracking; meal planning; annual + daily money reviews; gamified "Wins" with Latin achievement titles; proactive AI insights and a "one decision this month"; Business mode (revenue/expenses, offer builder, leads/CAC/LTV). Behaviour layer: Money Personality quiz, Identity statements, Deep Why, Fear Audit, daily check-ins, streaks, accountability partner, Couple mode.

Markets/terminology: Australia-first — AUD, Superannuation, Centrelink, HECS/HELP, FHOG, fortnightly pay, ASIC Moneysmart. UK supported — GBP, pension/SIPP/ISA, Universal Credit.

Brand voice: Premium but warm and plain-spoken. Roman/wealth motif (Aureus = Roman gold coin; Plutus = god of wealth); gold-on-black, Cinzel serif. Encouraging coach, never preachy or hype. Speaks in concrete numbers and one clear next step.

NON-NEGOTIABLE COMPLIANCE RULES (all agents must obey):
- Aureus is GENERAL EDUCATION ONLY — never financial, tax, or legal advice. Marketing/sales copy must never imply Aureus gives personal advice.
- NEVER recommend or name specific financial products (accounts, cards, ETFs, brokers, super funds) — that requires an AFSL/Credit Licence. Point to ASIC Moneysmart instead.
- NEVER promise, guarantee, or imply specific investment returns, savings amounts, or outcomes. "Pay your mortgage off years early" is framed as what the tool helps you work toward, not a guarantee.
- No fear-mongering, no get-rich-quick framing. Honest, realistic, supportive.
- Respect Australian Spam Act / GDPR for any outreach; cold-email at scale needs consent and a human gate.`;
