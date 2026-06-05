// GET /api/subscription -> { plan, status, current_period_end }
// The signed-in user's billing state (for the /billing page).
import { auth } from "@clerk/nextjs/server";
import { getSubscriptionByUser } from "@/lib/subscription";
import { hasStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Not signed in." }, { status: 401 });
  const sub = await getSubscriptionByUser(userId);
  return Response.json({
    stripeConfigured: hasStripe(),
    plan: sub?.plan ?? null,
    status: sub?.status ?? "none",
    current_period_end: sub?.current_period_end ?? null,
  });
}
