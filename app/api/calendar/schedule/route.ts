// POST /api/calendar/schedule  body: { id, scheduled_at }  -> { ok }
// Marks a calendar post as scheduled; the publish cron sends it when due.
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = body?.id;
  const scheduled_at = body?.scheduled_at;
  if (!id || !scheduled_at) {
    return Response.json({ error: "Missing id or scheduled_at." }, { status: 400 });
  }
  const when = new Date(scheduled_at);
  if (isNaN(when.getTime())) {
    return Response.json({ error: "Invalid scheduled_at." }, { status: 400 });
  }
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    await getDb()
      .from("calendar_posts")
      .update({ status: "scheduled", scheduled_at: when.toISOString() })
      .eq("id", id);
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to schedule." }, { status: 500 });
  }
}
