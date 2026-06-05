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
    let { data } = await db.from("company").select("profile").limit(1).maybeSingle();
    if (!data) {
      await db.from("company").insert({ profile: COMPANY_DEFAULT });
      data = { profile: COMPANY_DEFAULT } as any;
    }
    return Response.json({ profile: data!.profile, persisted: true });
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
    if (data?.id) {
      await db
        .from("company")
        .update({ profile, updated_at: new Date().toISOString() })
        .eq("id", data.id);
    } else {
      await db.from("company").insert({ profile });
    }
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to save profile." }, { status: 500 });
  }
}
