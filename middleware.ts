import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything is private except the auth pages. The whole org — the UI AND every
// API route (/api/run, /api/company, /api/memory, /api/calendar*) — requires a
// signed-in session. This is what makes it *your* org, not the public's.
// /api/stripe/webhook and the cron endpoints authenticate via their own secrets
// (Stripe signature / CRON_SECRET), not a Clerk session — so they must be public.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook",
  "/api/cron/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
