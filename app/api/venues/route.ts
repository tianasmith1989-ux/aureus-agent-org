// GET    /api/venues          -> { venues }   (active, ranked)
// PATCH  /api/venues          -> { ok }        body: { id, status }  (archive/active)
// DELETE /api/venues          -> { ok }        body: { id } to remove one, else clear all
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { rowToVenue } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) return Response.json({ venues: [] });
  try {
    const { data } = await getDb()
      .from("venues")
      .select("*")
      .eq("status", "active")
      .order("rank", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    return Response.json({ venues: (data ?? []).map(rowToVenue) });
  } catch (e: any) {
    return Response.json({ venues: [], error: e?.message });
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
  const status = body?.status === "archived" ? "archived" : "active";
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    await getDb().from("venues").update({ status }).eq("id", id);
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to update venue." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* no body = clear all */
  }
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    const db = getDb();
    if (body?.id) {
      await db.from("venues").delete().eq("id", body.id);
    } else {
      await db.from("venues").delete().not("id", "is", null);
    }
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to delete." }, { status: 500 });
  }
}
