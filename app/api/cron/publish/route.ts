// GET /api/cron/publish — every 15 min. Publishes due scheduled posts via
// Ayrshare. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { hasAyrshare, toAyrsharePlatform, publishToAyrshare } from "@/lib/ayrshare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (e.g. local) — allow
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  if (!isDbConfigured()) {
    return Response.json({ ok: true, note: "DB not configured." });
  }
  if (!hasAyrshare()) {
    return Response.json({ ok: true, note: "AYRSHARE_API_KEY not set; skipping." });
  }

  const db = getDb();
  const { data: due } = await db
    .from("calendar_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  let posted = 0;
  let failed = 0;

  for (const p of due ?? []) {
    const platform = toAyrsharePlatform(p.platform);
    if (!platform) {
      failed += 1;
      await db.from("calendar_posts").update({ status: "failed" }).eq("id", p.id);
      continue;
    }
    const text = (p.post ?? "") + (p.hashtags ? "\n\n" + p.hashtags : "");
    const result = await publishToAyrshare(text, [platform]);
    if (result.ok) {
      posted += 1;
      await db
        .from("calendar_posts")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          external_id: result.id ?? null,
        })
        .eq("id", p.id);
    } else {
      failed += 1;
      console.error(`[cron/publish] post ${p.id} failed:`, result.error);
      await db.from("calendar_posts").update({ status: "failed" }).eq("id", p.id);
    }
  }

  return Response.json({ ok: true, due: due?.length ?? 0, posted, failed });
}
