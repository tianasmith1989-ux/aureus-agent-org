// GET    /api/moves            -> { moves }
// PATCH  /api/moves            -> { ok }   body: { id, posted }
//        On posting, logs to the CRM (briefs + accounts) with channel + date.
// DELETE /api/moves            -> { ok }   body: { id } to remove one, else clears all
import { type NextRequest } from "next/server";
import { isDbConfigured, getDb } from "@/lib/supabase";
import { rowToMove } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) return Response.json({ moves: [] });
  try {
    const { data } = await getDb()
      .from("moves")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return Response.json({ moves: (data ?? []).map(rowToMove) });
  } catch (e: any) {
    return Response.json({ moves: [], error: e?.message });
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
    const db = getDb();
    await db
      .from("moves")
      .update({ status: posted ? "posted" : "draft", posted_at: posted ? new Date().toISOString() : null })
      .eq("id", id);

    // Log posted items to the CRM (briefs + accounts) with channel + date.
    if (posted) {
      const { data: m } = await db
        .from("moves")
        .select("community,text")
        .eq("id", id)
        .maybeSingle();
      const community = m?.community ?? "(channel)";
      const today = new Date().toLocaleDateString();
      const excerpt = (m?.text ?? "").replace(/\s+/g, " ").slice(0, 80);

      // Memory/CRM log entry.
      await db.from("briefs").insert({
        directive: `Founder post → ${community}`,
        divisions: "Founder",
        gist: `Posted ${today} · ${community}: ${excerpt}`,
      });

      // Track the channel as a CRM account (de-duped by name).
      const { data: existing } = await db
        .from("accounts")
        .select("id")
        .eq("name", community)
        .maybeSingle();
      if (!existing) {
        await db.from("accounts").insert({
          name: community,
          segment: "Community / Channel",
          stage: "active",
          notes: `Founder posted here on ${today}.`,
        });
      }
    }
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to update move." }, { status: 500 });
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
      await db.from("moves").delete().eq("id", body.id);
    } else {
      await db.from("moves").delete().not("id", "is", null);
    }
    return Response.json({ ok: true, persisted: true });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Failed to delete." }, { status: 500 });
  }
}
