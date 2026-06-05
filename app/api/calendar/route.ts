// GET    /api/calendar -> { posts }
// PATCH  /api/calendar -> { ok }   body: { id, posted }
// DELETE /api/calendar -> { ok }
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { rowToPost } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) return Response.json({ posts: [] });
  try {
    const { data } = await getDb()
      .from("calendar_posts")
      .select("*")
      .order("day", { ascending: true })
      .order("created_at", { ascending: true });
    return Response.json({ posts: (data ?? []).map(rowToPost) });
  } catch (e: any) {
    return Response.json({ posts: [], error: e?.message });
  }
}

export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = body?.id;
  const posted = Boolean(body?.posted);
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    await getDb()
      .from("calendar_posts")
      .update({
        status: posted ? "posted" : "draft",
        posted_at: posted ? new Date().toISOString() : null,
      })
      .eq("id", id);
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to update post." }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    await getDb().from("calendar_posts").delete().not("id", "is", null);
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to clear calendar." }, { status: 500 });
  }
}
