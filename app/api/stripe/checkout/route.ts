// POST /api/stripe/checkout  body: { plan: "trial" | "annual" }  -> { url }
// Creates a Stripe Checkout Session for the signed-in Clerk user.
//  - "trial"  -> $1 / 7-day price; the webhook then converts it to a 2-phase
//                subscription schedule (phase 1 = $1 weekly x1, phase 2 = $14.99/mo).
//  - "annual" -> $99 / year price.
import { type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe, hasStripe, PRICES, type PlanKey } from "@/lib/stripe";
import { getSubscriptionByUser, upsertCustomerForUser } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!hasStripe()) {
    return Response.json({ error: "STRIPE_SECRET_KEY is not set on the server." }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const plan: PlanKey = body?.plan === "annual" ? "annual" : "trial";
  const price = plan === "annual" ? PRICES.annual : PRICES.trial;
  if (!price) {
    return Response.json(
      { error: `Stripe price for "${plan}" is not configured (set STRIPE_PRICE_${plan.toUpperCase()}).` },
      { status: 500 },
    );
  }

  const stripe = getStripe();

  // Reuse an existing customer for this user, or create one.
  let customerId = (await getSubscriptionByUser(userId))?.stripe_customer_id ?? null;
  if (!customerId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    const customer = await stripe.customers.create({
      email,
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
    await upsertCustomerForUser(userId, customerId);
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { clerkUserId: userId, plan } },
    metadata: { clerkUserId: userId, plan },
    allow_promotion_codes: true,
    success_url: `${origin}/billing?status=success`,
    cancel_url: `${origin}/billing?status=cancelled`,
  });

  return Response.json({ url: session.url });
}
