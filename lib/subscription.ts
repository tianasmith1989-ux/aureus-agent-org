// Server-only helpers for the `subscriptions` table (one row per Clerk user).
import { isDbConfigured, getDb } from "./supabase";

export interface SubscriptionRecord {
  clerk_user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  email: string | null;
  plan: string | null; // trial | monthly | annual
  status: string | null; // none | active | trialing | past_due | canceled | incomplete
  trial_started_at: string | null;
  current_period_end: string | null;
}

export async function getSubscriptionByUser(userId: string): Promise<SubscriptionRecord | null> {
  if (!isDbConfigured()) return null;
  const { data } = await getDb()
    .from("subscriptions")
    .select("*")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  return (data as SubscriptionRecord) ?? null;
}

export async function getCustomerIdForUser(userId: string): Promise<string | null> {
  const sub = await getSubscriptionByUser(userId);
  return sub?.stripe_customer_id ?? null;
}

// Link a Stripe customer to a Clerk user (called at checkout).
export async function upsertCustomerForUser(userId: string, customerId: string): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb()
    .from("subscriptions")
    .upsert(
      { clerk_user_id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
      { onConflict: "clerk_user_id" },
    );
}

// Update subscription state by Stripe customer id (called from the webhook).
export async function updateByCustomer(
  customerId: string,
  fields: Partial<Omit<SubscriptionRecord, "clerk_user_id" | "stripe_customer_id">>,
): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb()
    .from("subscriptions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
}
