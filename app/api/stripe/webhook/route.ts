// POST /api/stripe/webhook — Stripe events (public route, signature-verified).
// On the $1/7-day trial checkout, converts the new subscription into a 2-phase
// schedule: phase 1 = $1 weekly (1 iteration = 7 days), phase 2 = $14.99/month.
import { type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, hasStripe, PRICES, planFromPriceId } from "@/lib/stripe";
import { updateByCustomer } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!hasStripe()) {
    return new Response("Stripe not configured", { status: 500 });
  }
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return new Response("Missing signature or STRIPE_WEBHOOK_SECRET", { status: 400 });
  }

  const body = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e: any) {
    return new Response(`Webhook signature verification failed: ${e?.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subId = session.subscription as string | null;
        const plan = (session.metadata?.plan as string) ?? null;

        // Convert the $1 trial subscription into the 2-phase schedule.
        if (plan === "trial" && subId && PRICES.trial && PRICES.monthly) {
          try {
            const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subId });
            // Phase 1: $1 trial price for one week (7 days). Phase 2: $14.99/month, ongoing.
            // The first phase is already active (started at checkout); Stripe infers its
            // start, so we only set its duration.
            await stripe.subscriptionSchedules.update(schedule.id, {
              end_behavior: "release",
              phases: [
                {
                  items: [{ price: PRICES.trial, quantity: 1 }],
                  duration: { interval: "week", interval_count: 1 },
                },
                {
                  items: [{ price: PRICES.monthly, quantity: 1 }],
                },
              ],
            });
          } catch (e) {
            console.error("[stripe webhook] schedule conversion failed:", e);
          }
        }

        await updateByCustomer(customerId, {
          stripe_subscription_id: subId,
          plan,
          status: "active",
          email: session.customer_details?.email ?? null,
          // Anchor the 7-day email sequence at the trial checkout.
          ...(plan === "trial" ? { trial_started_at: new Date().toISOString() } : {}),
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items?.data?.[0]?.price?.id;
        // current_period_end can live on the sub or per-item depending on API version.
        const cpe =
          (sub as any).current_period_end ??
          (sub as any).items?.data?.[0]?.current_period_end ??
          null;
        await updateByCustomer(customerId, {
          stripe_subscription_id: sub.id,
          plan: planFromPriceId(priceId),
          status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
          current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
        });
        break;
      }

      default:
        // ignore other events
        break;
    }
  } catch (e: any) {
    console.error("[stripe webhook] handler error:", e?.message);
    // Return 200 so Stripe doesn't endlessly retry on our own downstream errors.
  }

  return Response.json({ received: true });
}
