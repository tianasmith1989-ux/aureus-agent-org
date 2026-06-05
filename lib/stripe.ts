// Server-only Stripe client + plan/price config.
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;

export function hasStripe(): boolean {
  return Boolean(secret);
}

export function getStripe(): Stripe {
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env.local.");
  }
  // No apiVersion pin — use the account/SDK default to avoid mismatches.
  if (!stripe) stripe = new Stripe(secret);
  return stripe;
}

// Price IDs created in the Stripe dashboard (see README — Step 3).
export const PRICES = {
  trial: process.env.STRIPE_PRICE_TRIAL || "", // $1 every 7 days (weekly), 1 iteration
  monthly: process.env.STRIPE_PRICE_MONTHLY || "", // $14.99 / month
  annual: process.env.STRIPE_PRICE_ANNUAL || "", // $99 / year
};

export type PlanKey = "trial" | "annual";

// Map a subscription's active price back to a human plan label.
export function planFromPriceId(priceId: string | undefined | null): string | null {
  if (!priceId) return null;
  if (priceId === PRICES.annual) return "annual";
  if (priceId === PRICES.monthly) return "monthly";
  if (priceId === PRICES.trial) return "trial";
  return null;
}
