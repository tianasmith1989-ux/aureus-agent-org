// GET /api/company  -> { profile, persisted }
// PUT /api/company  -> { ok, persisted }   body: { profile }
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { COMPANY_DEFAULT } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return Response.json({ profile: COMPANY_DEFAULT, persisted: false });
  }
  try {
    const db = getDb();
    const sel = await db.from("company").select("profile").limit(1).maybeSingle();
    // Surface DB errors instead of silently falling back to the default profile.
    if (sel.error) {
      return Response.json({ profile: COMPANY_DEFAULT, persisted: false, error: sel.error.message });
    }
    let profile = sel.data?.profile as string | undefined;
    if (!profile) {
      const ins = await db.from("company").insert({ profile: COMPANY_DEFAULT });
      if (ins.error) {
        return Response.json({ profile: COMPANY_DEFAULT, persisted: false, error: ins.error.message });
      }
      profile = COMPANY_DEFAULT;
    }
    return Response.json({ profile, persisted: true });
  } catch (e: any) {
    return Response.json({ profile: COMPANY_DEFAULT, persisted: false, error: e?.message });
  }
}

export async function PUT(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const profile = body?.profile;
  if (typeof profile !== "string" || !profile.trim()) {
    return Response.json({ error: "Missing profile." }, { status: 400 });
  }
  if (!isDbConfigured()) {
    // Nothing to persist to yet — report it so the UI can reflect "not saved".
    return Response.json({ ok: true, persisted: false });
  }
  try {
    const db = getDb();
    const { data } = await db.from("company").select("id").limit(1).maybeSingle();
    const res = data?.id
      ? await db
          .from("company")
          .update({ profile, updated_at: new Date().toISOString() })
          .eq("id", data.id)
      : await db.from("company").insert({ profile });
    if (res.error) {
      return Response.json({ error: res.error.message }, { status: 500 });
    }
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to save profile." }, { status: 500 });
  }
}
