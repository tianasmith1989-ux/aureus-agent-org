// POST /api/stripe/portal -> { url }
// Opens the Stripe Billing Portal so the user can manage/cancel their subscription.
import { type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe, hasStripe } from "@/lib/stripe";
import { getCustomerIdForUser } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (!hasStripe()) {
    return Response.json({ error: "STRIPE_SECRET_KEY is not set on the server." }, { status: 500 });
  }

  const customerId = await getCustomerIdForUser(userId);
  if (!customerId) {
    return Response.json({ error: "No Stripe customer for this user yet." }, { status: 400 });
  }

  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/billing`,
  });
  return Response.json({ url: session.url });
}
