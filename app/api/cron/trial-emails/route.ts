// GET /api/cron/trial-emails — daily. Sends the due trial emails for each
// trial subscriber based on how many days since their trial started.
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { EMAIL_DAYS, type EmailDay } from "@/lib/emails";
import { maybeSendTrialEmail } from "@/lib/trial-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (e.g. local) — allow
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isDbConfigured()) {
    return Response.json({ ok: true, note: "DB not configured; nothing to send." });
  }

  const db = getDb();
  const { data: subs } = await db
    .from("subscriptions")
    .select("stripe_subscription_id,email,trial_started_at,status,plan")
    .eq("plan", "trial")
    .not("trial_started_at", "is", null)
    .in("status", ["active", "trialing", "past_due"]);

  const results = { sent: 0, already: 0, skipped: 0, error: 0 };

  for (const s of subs ?? []) {
    const subId = s.stripe_subscription_id as string | null;
    if (!subId) continue;
    const started = new Date(s.trial_started_at as string).getTime();
    const dayIndex = Math.floor((Date.now() - started) / DAY_MS);
    // Catch up any due days not yet sent (normally just one per daily run).
    for (const d of EMAIL_DAYS) {
      if (d > dayIndex) continue;
      const r = await maybeSendTrialEmail({ subscriptionId: subId, day: d as EmailDay, email: s.email });
      results[r] += 1;
    }
  }

  return Response.json({ ok: true, processed: subs?.length ?? 0, ...results });
}
