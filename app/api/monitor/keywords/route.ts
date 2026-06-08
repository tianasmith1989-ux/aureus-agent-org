// GET    /api/monitor/keywords -> { keywords }
// POST   /api/monitor/keywords -> { ok }   body: { keyword }
// DELETE /api/monitor/keywords -> { ok }   body: { id }
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) return Response.json({ keywords: [] });
  try {
    const { data } = await getDb()
      .from("monitor_keywords")
      .select("id,keyword,active,created_at")
      .order("created_at", { ascending: true })
      .limit(50);
    return Response.json({ keywords: data ?? [] });
  } catch (e: any) {
    return Response.json({ keywords: [], error: e?.message });
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const keyword = String(body?.keyword ?? "").trim();
  if (!keyword) return Response.json({ error: "Missing keyword." }, { status: 400 });
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    const { data } = await getDb()
      .from("monitor_keywords")
      .insert({ keyword, active: true })
      .select()
      .maybeSingle();
    return Response.json({ ok: true, keyword: data });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to add keyword." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body?.id) return Response.json({ error: "Missing id." }, { status: 400 });
  if (!isDbConfigured()) return Response.json({ ok: true, persisted: false });
  try {
    await getDb().from("monitor_keywords").delete().eq("id", body.id);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to delete keyword." }, { status: 500 });
  }
}
