// Idempotent trial-email sender. Claims a (subscription, day) row first so we
// never double-send, then sends via Resend; rolls the claim back on failure.
import { isDbConfigured, getDb } from "./supabase";
import { hasResend, getResend, FROM } from "./resend";
import { TRIAL_EMAILS, type EmailDay } from "./emails";

export async function maybeSendTrialEmail(args: {
  subscriptionId: string;
  day: EmailDay;
  email: string | null;
}): Promise<"sent" | "skipped" | "already" | "error"> {
  const { subscriptionId, day, email } = args;
  if (!email) return "skipped";
  if (!isDbConfigured()) return "skipped"; // need the idempotency log
  if (!hasResend()) return "skipped";

  const db = getDb();

  // Claim the slot. The unique (stripe_subscription_id, day) constraint makes
  // this the dedupe point — a duplicate insert errors and we bail.
  const claim = await db
    .from("trial_emails")
    .insert({ stripe_subscription_id: subscriptionId, day, email })
    .select()
    .maybeSingle();
  if (claim.error) {
    // Unique violation = already sent (or claimed) for this day.
    return "already";
  }

  try {
    const content = TRIAL_EMAILS[day]();
    const { error } = await getResend().emails.send({
      from: FROM,
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (error) throw new Error(error.message);
    return "sent";
  } catch (e: any) {
    console.error(`[trial-emails] send failed (sub=${subscriptionId} day=${day}):`, e?.message);
    // Roll back the claim so a later cron run can retry.
    await db
      .from("trial_emails")
      .delete()
      .eq("stripe_subscription_id", subscriptionId)
      .eq("day", day);
    return "error";
  }
}
