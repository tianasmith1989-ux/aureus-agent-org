// The 7-day trial conversion sequence (from aureus-trial-sequence.md).
// Education-only, no product names, no guaranteed outcomes. One CTA each.
// Days: 0, 1, 2, 3, 5, 6, 7 (no day-4 email by design).

export const EMAIL_DAYS = [0, 1, 2, 3, 5, 6, 7] as const;
export type EmailDay = (typeof EMAIL_DAYS)[number];

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aureusplutus.app";

function shell(bodyHtml: string, cta: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1712;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-family:Georgia,serif;font-size:22px;color:#1a1712;letter-spacing:.5px;">Aureus Plutus<span style="color:#C9A227;">.</span></div>
    <div style="height:1px;background:#e3ddcd;margin:18px 0 24px;"></div>
    <div style="font-size:15px;line-height:1.65;color:#2a2419;">${bodyHtml}</div>
    <div style="margin:28px 0;">
      <a href="${cta.href}" style="display:inline-block;background:#C9A227;color:#100d06;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:8px;">${cta.label}</a>
    </div>
    <div style="height:1px;background:#e3ddcd;margin:24px 0 16px;"></div>
    <div style="font-size:11px;line-height:1.6;color:#8a8270;">
      Aureus Plutus — ABN 32 306 872 259. General education only, not financial, tax or legal advice.
      <br/>You're receiving this because you started an Aureus trial. <a href="${APP_URL}/account" style="color:#8a8270;">Manage email preferences</a>.
    </div>
  </div></body></html>`;
}

function build(subject: string, paras: string[], cta: { label: string; href: string }): EmailContent {
  const html = shell(paras.map((p) => `<p style="margin:0 0 14px;">${p}</p>`).join(""), cta);
  const text = paras.map((p) => p.replace(/<[^>]+>/g, "")).join("\n\n") + `\n\n${cta.label}: ${cta.href}`;
  return { subject, html, text };
}

const cta = (label: string, path = "/") => ({ label, href: `${APP_URL}${path}` });

// day -> content builder
export const TRIAL_EMAILS: Record<EmailDay, () => EmailContent> = {
  0: () =>
    build(
      "You're in. Let's find your number.",
      [
        "Welcome to Aureus.",
        "For the next 7 days you've got the full thing for a dollar. Here's the fastest way to make it worth far more than that: finish your setup so Aureus can show you your real money picture.",
        "It takes about 5 minutes — your income, your expenses, and a couple of quick questions about how you think about money. The moment you're done, you'll see your monthly surplus and exactly where you're standing.",
        "— The Aureus team",
      ],
      cta("Finish my setup", "/setup"),
    ),
  1: () =>
    build(
      "Your money picture is 5 minutes away",
      [
        "You started — nice. You haven't finished setting up yet, and that's the bit that unlocks everything.",
        "Once your income and expenses are in, Aureus shows you one number most people never calculate: your real monthly surplus. From there it maps your Baby Step — the single thing to focus on next.",
        "No spreadsheets. No judgement. Just clarity.",
      ],
      cta("See my surplus", "/setup"),
    ),
  2: () =>
    build(
      "Want to see your mortgage disappear years early?",
      [
        "Here's where Aureus earns its keep.",
        "Pop your home loan into the <strong>Mortgage Accelerator</strong> and it'll show you — based on your numbers — how many years and how much interest you could cut by paying a little extra. Most people are stunned by the early years: in year one of a typical 30-year loan, around 90% of each repayment is interest, not the actual debt.",
        "Seeing your own projection changes how the next decade feels.",
        "<em style='color:#8a8270;'>Aureus is general education only and shows projections based on the figures you enter — not financial advice.</em>",
      ],
      cta("Run my numbers", "/mortgage"),
    ),
  3: () =>
    build(
      "Ask Aureus anything about your money",
      [
        "Stuck on a money question? That's what the coach is for. Ask it anything — \"what should I focus on first?\", \"how does an offset account work?\", \"is my emergency fund enough?\" — and it answers using <em>your</em> actual numbers.",
        "While you're in there, do today's check-in. It's 2 minutes, and people who check in regularly build the habit that makes all of this stick.",
      ],
      cta("Open Aureus", "/"),
    ),
  5: () =>
    build(
      "Look what you've built in 5 days",
      [
        "In under a week you've gone from \"I'll sort my money out eventually\" to actually seeing it. Quick recap of what's now set up for you in Aureus:",
        "• Your full income, expenses and surplus<br/>• Your current Baby Step and roadmap<br/>• Your projections and goals",
        "Your $1 week wraps up in 2 days, then Aureus continues at <strong>$14.99/month</strong> — less than most people spend on coffee in a week, for a coach that's working on your biggest financial decisions every day.",
      ],
      cta("Keep my momentum going", "/"),
    ),
  6: () =>
    build(
      "Tomorrow your $1 week becomes a habit",
      [
        "Tomorrow your trial rolls into a full Aureus membership at <strong>$14.99/month</strong>. You don't need to do anything to continue — your roadmap, your numbers and your streak all stay exactly where they are.",
        "One thing worth a look: switching to the <strong>annual plan ($99/year)</strong> saves you around <strong>$81</strong> versus paying monthly. Same Aureus, less cost — a very on-brand move.",
        "Either way, you're set. We're glad you're here.",
      ],
      cta("Switch to annual & save ~$81", "/billing"),
    ),
  7: () =>
    build(
      "You're officially in 🏛️",
      [
        "Your membership is live. You've done the hard part — setting it all up. Now Aureus does its part: nudging you toward the one decision each month that moves the needle most.",
        "This week, pick one thing from your roadmap and tick the first step. That's how this compounds.",
      ],
      cta("See my next move", "/"),
    ),
};
